import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { HallLayout } from "@/db/schema";
import { UPCOMING_GRACE } from "./events";

const { events, venues, eventSeats, priceCategories, orders, orderItems } = schema;

export const MAX_SEATS_PER_ORDER = 20;

export class SaleError extends Error {
  constructor(
    public code: "not_found" | "closed" | "taken" | "limit" | "expired" | "empty",
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type SeatState = "free" | "taken" | "mine";

export type SeatMap = {
  event: { id: number; slug: string; title: string; startsAt: string; venueName: string; layout: HallLayout | null };
  categories: Array<{ id: number; name: string; price: number; color: string }>;
  seats: Array<{ id: number; categoryId: number; section: string; row: string; place: string; group: string; x: number; y: number; state: SeatState }>;
  /** When the current visitor's cart is released, if they hold anything */
  cartExpiresAt: string | null;
  /** Server clock, so the countdown is right even if the visitor's clock is off */
  serverNow: number;
};

/** Live (uncached) lookup: sales decisions must never use stale data. */
export async function getSaleEvent(slug: string) {
  const [row] = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      startsAt: events.startsAt,
      holdMinutes: events.holdMinutes,
      venueName: venues.name,
      layout: venues.layout,
      onSale: sql<boolean>`${events.startsAt} >= now() - ${UPCOMING_GRACE}`,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);
  return row ?? null;
}

export type SaleEvent = NonNullable<Awaited<ReturnType<typeof getSaleEvent>>>;

function assertOnSale(event: SaleEvent | null): asserts event is SaleEvent {
  if (!event) throw new SaleError("not_found", "Tadbir topilmadi", 404);
  if (!event.onSale) throw new SaleError("closed", "Bu tadbirga chipta sotuvi yakunlangan", 410);
}

// A hold is "mine" only while it has not expired; expired holds count as free for everyone.
const heldByMe = (token: string | null) =>
  token
    ? sql`(${eventSeats.status} = 'held' and ${eventSeats.holdToken} = ${token} and ${eventSeats.holdExpiresAt} > now())`
    : sql`false`;

export async function getSeatMap(event: SaleEvent, token: string | null): Promise<SeatMap> {
  const [categories, seats, [cart]] = await Promise.all([
    db
      .select({ id: priceCategories.id, name: priceCategories.name, price: priceCategories.price, color: priceCategories.color })
      .from(priceCategories)
      .where(eq(priceCategories.eventId, event.id))
      .orderBy(priceCategories.price),
    db
      .select({
        id: eventSeats.id,
        categoryId: eventSeats.priceCategoryId,
        section: eventSeats.section,
        row: eventSeats.row,
        place: eventSeats.place,
        group: sql<string>`coalesce(${eventSeats.groupKey}, 's' || ${eventSeats.id})`,
        x: eventSeats.x,
        y: eventSeats.y,
        state: sql<SeatState>`case
          when ${heldByMe(token)} then 'mine'
          when ${eventSeats.status} = 'available' or (${eventSeats.status} = 'held' and ${eventSeats.holdExpiresAt} <= now()) then 'free'
          else 'taken' end`,
      })
      .from(eventSeats)
      .where(eq(eventSeats.eventId, event.id))
      .orderBy(eventSeats.id),
    db
      .select({ expiresAt: sql<Date | null>`min(${eventSeats.holdExpiresAt})` })
      .from(eventSeats)
      .where(and(eq(eventSeats.eventId, event.id), heldByMe(token))),
  ]);

  return {
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      venueName: event.venueName,
      layout: event.layout,
    },
    categories,
    seats,
    cartExpiresAt: cart?.expiresAt ? new Date(cart.expiresAt).toISOString() : null,
    serverNow: Date.now(),
  };
}

/**
 * Holds the whole group (e.g. a table) that `seatId` belongs to, or nothing.
 *
 * Safety under concurrency: the UPDATE row-locks every seat it touches. A competing
 * transaction blocks on those locks, then re-evaluates the WHERE clause against the
 * committed rows (READ COMMITTED), sees they are now held by someone else, and
 * updates fewer rows than the group size, so it rolls back. No seat is ever held by two carts.
 */
export async function holdSeatGroup(event: SaleEvent | null, token: string, seatId: number) {
  assertOnSale(event);

  await db.transaction(async (tx) => {
    const [seat] = await tx
      .select({ groupKey: eventSeats.groupKey })
      .from(eventSeats)
      .where(and(eq(eventSeats.id, seatId), eq(eventSeats.eventId, event.id)))
      .limit(1);
    if (!seat) throw new SaleError("not_found", "O'rindiq topilmadi", 404);

    const inGroup = seat.groupKey ? eq(eventSeats.groupKey, seat.groupKey) : eq(eventSeats.id, seatId);
    const sameGroup = and(eq(eventSeats.eventId, event.id), inGroup);

    const [{ groupSize, alreadyMine }] = await tx
      .select({
        groupSize: sql<number>`count(*)::int`,
        alreadyMine: sql<number>`count(*) filter (where ${heldByMe(token)})::int`,
      })
      .from(eventSeats)
      .where(sameGroup);

    const [{ cartSize }] = await tx
      .select({ cartSize: sql<number>`count(*)::int` })
      .from(eventSeats)
      .where(and(eq(eventSeats.eventId, event.id), heldByMe(token)));
    if (cartSize - alreadyMine + groupSize > MAX_SEATS_PER_ORDER) {
      throw new SaleError("limit", `Bitta buyurtmada ${MAX_SEATS_PER_ORDER} tadan ortiq chipta bo'lishi mumkin emas`, 422);
    }

    // The whole cart shares one deadline, set by the first seat taken (like the reference site)
    const expiresAt = sql`coalesce(
      (select min(s.hold_expires_at) from event_seats s
        where s.event_id = ${event.id} and s.hold_token = ${token} and s.status = 'held' and s.hold_expires_at > now()),
      now() + make_interval(mins => ${event.holdMinutes}))`;

    const updated = await tx
      .update(eventSeats)
      .set({ status: "held", holdToken: token, holdExpiresAt: expiresAt })
      .where(
        and(
          sameGroup,
          sql`(${eventSeats.status} = 'available'
            or (${eventSeats.status} = 'held' and (${eventSeats.holdExpiresAt} <= now() or ${eventSeats.holdToken} = ${token})))`,
        ),
      )
      .returning({ id: eventSeats.id });

    if (updated.length !== groupSize) {
      throw new SaleError("taken", "Afsuski, bu o'rinlarni boshqa xaridor band qildi", 409);
    }
  });
}

export async function releaseSeatGroup(event: SaleEvent | null, token: string, seatId: number) {
  if (!event) throw new SaleError("not_found", "Tadbir topilmadi", 404);

  await db.transaction(async (tx) => {
    const [seat] = await tx
      .select({ groupKey: eventSeats.groupKey })
      .from(eventSeats)
      .where(and(eq(eventSeats.id, seatId), eq(eventSeats.eventId, event.id)))
      .limit(1);
    if (!seat) return;

    const inGroup = seat.groupKey ? eq(eventSeats.groupKey, seat.groupKey) : eq(eventSeats.id, seatId);
    await tx
      .update(eventSeats)
      .set({ status: "available", holdToken: null, holdExpiresAt: null })
      .where(and(eq(eventSeats.eventId, event.id), inGroup, eq(eventSeats.status, "held"), eq(eventSeats.holdToken, token)));

    // The cart changed, so an unpaid order built from it no longer matches
    await cancelPendingOrders(tx, event.id, token);
  });
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function cancelPendingOrders(tx: Tx, eventId: number, token: string) {
  await tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.eventId, eventId), eq(orders.holdToken, token), eq(orders.status, "pending")));
}

export type Buyer = { email: string; phone: string; comment: string | null };

/** Turns the visitor's current cart into a pending order awaiting payment. */
export async function createOrder(event: SaleEvent | null, token: string, buyer: Buyer) {
  assertOnSale(event);

  return db.transaction(async (tx) => {
    // Lock the cart rows so they can't be released or re-held while the order is written
    const seats = await tx
      .select({ id: eventSeats.id, price: priceCategories.price, expiresAt: eventSeats.holdExpiresAt })
      .from(eventSeats)
      .innerJoin(priceCategories, eq(priceCategories.id, eventSeats.priceCategoryId))
      .where(and(eq(eventSeats.eventId, event.id), heldByMe(token)))
      .for("update", { of: eventSeats });

    if (seats.length === 0) {
      throw new SaleError("empty", "Bron muddati tugagan yoki savat bo'sh. O'rindiqlarni qaytadan tanlang.", 409);
    }

    await cancelPendingOrders(tx, event.id, token);

    const total = seats.reduce((sum, s) => sum + s.price, 0);
    const expiresAt = new Date(Math.min(...seats.map((s) => s.expiresAt!.getTime())));

    const [order] = await tx
      .insert(orders)
      .values({ eventId: event.id, holdToken: token, email: buyer.email, phone: buyer.phone, comment: buyer.comment, total, expiresAt })
      .returning({ id: orders.id, number: orders.number, total: orders.total });

    await tx.insert(orderItems).values(seats.map((s) => ({ orderId: order.id, seatId: s.id, price: s.price })));
    return order;
  });
}

/**
 * Called by the payment provider callback once money is confirmed (Click integration).
 * Idempotent: a repeated callback for an already-paid order is a no-op.
 * Returns false when the seats are no longer reserved for this order, so the payment must be refused/refunded.
 */
export async function markOrderPaid(orderId: string, provider: string, transactionId: string) {
  try {
    return await markOrderPaidTx(orderId, provider, transactionId);
  } catch (e) {
    // The provider transaction already paid a different order (unique index orders_provider_txn_uq)
    if (isUniqueViolation(e)) return false;
    throw e;
  }
}

function isUniqueViolation(e: unknown): boolean {
  for (let cur = e as { code?: string; cause?: unknown } | undefined; cur; cur = cur.cause as typeof cur) {
    if (cur.code === "23505") return true;
  }
  return false;
}

async function markOrderPaidTx(orderId: string, provider: string, transactionId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update").limit(1);
    if (!order) return false;
    if (order.status === "paid") return order.providerTransactionId === transactionId;
    if (order.status !== "pending") return false;

    // One provider transaction can pay for exactly one order
    const [reused] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(eq(orders.paymentProvider, provider), eq(orders.providerTransactionId, transactionId)))
      .limit(1);
    if (reused) return false;

    const items = await tx.select({ seatId: orderItems.seatId }).from(orderItems).where(eq(orderItems.orderId, orderId));
    const sold = await tx
      .update(eventSeats)
      .set({ status: "sold", orderId, holdToken: null, holdExpiresAt: null })
      .where(
        and(
          inArray(eventSeats.id, items.map((i) => i.seatId)),
          eq(eventSeats.status, "held"),
          eq(eventSeats.holdToken, order.holdToken),
          sql`${eventSeats.holdExpiresAt} > now()`,
        ),
      )
      .returning({ id: eventSeats.id });

    if (sold.length !== items.length) {
      // Throwing rolls back the partial update; the caller reports the failure to the provider
      throw new SaleError("expired", "Buyurtma muddati tugagan", 409);
    }

    await tx
      .update(orders)
      .set({ status: "paid", paidAt: new Date(), paymentProvider: provider, providerTransactionId: transactionId })
      .where(eq(orders.id, orderId));
    return true;
  });
}

export async function getOrder(orderId: string) {
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      total: orders.total,
      email: orders.email,
      phone: orders.phone,
      expiresAt: orders.expiresAt,
      createdAt: orders.createdAt,
      expired: sql<boolean>`${orders.status} = 'pending' and ${orders.expiresAt} <= now()`,
      event: { slug: events.slug, title: events.title, startsAt: events.startsAt, venueName: venues.name, address: venues.address, city: venues.city },
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!order) return null;

  const items = await db
    .select({ section: eventSeats.section, row: eventSeats.row, place: eventSeats.place, price: orderItems.price, category: priceCategories.name })
    .from(orderItems)
    .innerJoin(eventSeats, eq(eventSeats.id, orderItems.seatId))
    .innerJoin(priceCategories, eq(priceCategories.id, eventSeats.priceCategoryId))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(eventSeats.id);

  return { ...order, items };
}
