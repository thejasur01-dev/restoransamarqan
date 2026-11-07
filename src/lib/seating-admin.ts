import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import type { HallLayout } from "@/db/schema";
import { newTicketCode, SaleError } from "./seating";

const { events, eventSeats, priceCategories, orders, orderItems } = schema;

// Admin-side inventory operations. They share the locking rules of the public sale flow
// in seating.ts, so the box office and the website can never sell the same seat.

/**
 * Replaces an event's seats with the venue's current plan, mapping each builder block
 * to a price category. Refused once anything is held, sold or ordered, so live sales
 * are never disturbed.
 */
export async function generateEventSeats(
  eventId: number,
  plan: { layout: HallLayout; seats: Array<{ blockId: string; section: string; row: string; place: string; group: string; x: number; y: number }> },
  categoryByBlock: Record<string, number>,
) {
  return db.transaction(async (tx) => {
    // Lock the event row so two admins can't regenerate at the same time
    await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).for("update");

    const [busy] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(eventSeats)
      .where(and(eq(eventSeats.eventId, eventId), sql`(${eventSeats.status} = 'sold' or (${eventSeats.status} = 'held' and ${eventSeats.holdExpiresAt} > now()))`));
    const [ordered] = await tx.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.eventId, eventId));
    if (busy.n > 0 || ordered.n > 0) {
      throw new SaleError("taken", "Bu tadbirda buyurtmalar bor — zalni qayta yaratib bo'lmaydi. O'rindiqlarni «Zal» bo'limida tahrirlang.", 409);
    }

    const validCategories = new Set(
      (await tx.select({ id: priceCategories.id }).from(priceCategories).where(eq(priceCategories.eventId, eventId))).map((c) => c.id),
    );
    for (const s of plan.seats) {
      if (!validCategories.has(categoryByBlock[s.blockId])) throw new SaleError("not_found", "Har bir blok uchun narx toifasini tanlang", 400);
    }

    await tx.delete(eventSeats).where(eq(eventSeats.eventId, eventId));
    // Insert in chunks: one statement has a parameter limit
    for (let i = 0; i < plan.seats.length; i += 500) {
      await tx.insert(eventSeats).values(
        plan.seats.slice(i, i + 500).map((s) => ({
          eventId,
          priceCategoryId: categoryByBlock[s.blockId],
          section: s.section,
          row: s.row,
          place: s.place,
          groupKey: s.group,
          x: s.x,
          y: s.y,
        })),
      );
    }
    await tx.update(events).set({ layout: plan.layout, updatedAt: new Date() }).where(eq(events.id, eventId));
    return plan.seats.length;
  });
}

// Seats nobody is buying right now: free, blocked, or held by a cart that ran out
const notInUse = sql`(${eventSeats.status} in ('available', 'blocked') or (${eventSeats.status} = 'held' and ${eventSeats.holdExpiresAt} <= now()))`;

/** Moves seats to another price category. */
export async function setSeatsCategory(eventId: number, seatIds: number[], categoryId: number) {
  const [cat] = await db
    .select({ id: priceCategories.id })
    .from(priceCategories)
    .where(and(eq(priceCategories.id, categoryId), eq(priceCategories.eventId, eventId)));
  if (!cat) throw new SaleError("not_found", "Narx toifasi topilmadi", 404);
  const updated = await db
    .update(eventSeats)
    .set({ priceCategoryId: categoryId })
    .where(and(eq(eventSeats.eventId, eventId), inArray(eventSeats.id, seatIds), notInUse))
    .returning({ id: eventSeats.id });
  return updated.length;
}

/** Takes seats off sale (e.g. reserved for guests) or puts them back. */
export async function setSeatsBlocked(eventId: number, seatIds: number[], blocked: boolean) {
  const updated = await db
    .update(eventSeats)
    .set(blocked ? { status: "blocked", holdToken: null, holdExpiresAt: null } : { status: "available" })
    .where(and(eq(eventSeats.eventId, eventId), inArray(eventSeats.id, seatIds), blocked ? notInUse : eq(eventSeats.status, "blocked")))
    .returning({ id: eventSeats.id });
  return updated.length;
}

/**
 * Box-office sale paid in cash: the seats go straight to "sold" with ticket codes.
 * Locks the rows like an online purchase, so a seat can't be sold twice.
 */
export async function createBoxOfficeOrder(
  eventId: number,
  seatIds: number[],
  buyer: { phone: string; email: string | null; comment: string | null },
  adminId: number,
) {
  return db.transaction(async (tx) => {
    const seats = await tx
      .select({ id: eventSeats.id, price: priceCategories.price, status: eventSeats.status, expires: eventSeats.holdExpiresAt })
      .from(eventSeats)
      .innerJoin(priceCategories, eq(priceCategories.id, eventSeats.priceCategoryId))
      .where(and(eq(eventSeats.eventId, eventId), inArray(eventSeats.id, seatIds)))
      .for("update", { of: eventSeats });

    const now = new Date();
    const free = seats.filter((s) => s.status === "available" || s.status === "blocked" || (s.status === "held" && s.expires! <= now));
    if (seats.length !== seatIds.length || free.length !== seats.length) {
      throw new SaleError("taken", "Tanlangan o'rinlarning bir qismi band yoki sotilgan. Sahifani yangilang.", 409);
    }

    const token = crypto.randomUUID();
    const [order] = await tx
      .insert(orders)
      .values({
        eventId,
        holdToken: token,
        email: buyer.email,
        phone: buyer.phone,
        comment: buyer.comment,
        total: seats.reduce((sum, s) => sum + s.price, 0),
        status: "paid",
        paymentProvider: "cash",
        providerTransactionId: `CASH-${adminId}-${token.slice(0, 8)}`,
        expiresAt: now,
        paidAt: now,
      })
      .returning({ id: orders.id, number: orders.number });

    await tx.insert(orderItems).values(seats.map((s) => ({ orderId: order.id, seatId: s.id, price: s.price, ticketCode: newTicketCode() })));
    await tx.update(eventSeats).set({ status: "sold", orderId: order.id, holdToken: null, holdExpiresAt: null }).where(inArray(eventSeats.id, seatIds));
    return order;
  });
}

/**
 * Cancels an unpaid order (seats it still holds go back on sale) or refunds a paid one
 * (seats go back on sale, its tickets stop working at the door). The money itself is
 * returned through the payment provider's cabinet.
 */
export async function cancelOrRefundOrder(orderId: string) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new SaleError("not_found", "Buyurtma topilmadi", 404);

    if (order.status === "pending") {
      await tx
        .update(eventSeats)
        .set({ status: "available", holdToken: null, holdExpiresAt: null })
        .where(and(eq(eventSeats.eventId, order.eventId), eq(eventSeats.status, "held"), eq(eventSeats.holdToken, order.holdToken)));
      await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
      return "cancelled" as const;
    }
    if (order.status === "paid") {
      await tx.update(eventSeats).set({ status: "available", orderId: null }).where(and(eq(eventSeats.orderId, orderId), eq(eventSeats.status, "sold")));
      await tx.update(orders).set({ status: "refunded" }).where(eq(orders.id, orderId));
      return "refunded" as const;
    }
    throw new SaleError("closed", "Bu buyurtmani o'zgartirib bo'lmaydi", 409);
  });
}

export type CheckInResult =
  | { ok: true; seat: string; event: string; orderNumber: number }
  | { ok: false; reason: "not_found" | "not_paid" | "used" | "other_event"; message: string; seat?: string; usedAt?: string; event?: string };

/** Marks a ticket as used. The conditional UPDATE makes double entry impossible even with two scanners. */
export async function checkInTicket(rawCode: string, eventId: number | null, adminId: number): Promise<CheckInResult> {
  const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (code.length !== 10) return { ok: false, reason: "not_found", message: "Bunday chipta topilmadi" };

  const [t] = await db
    .select({
      itemId: orderItems.id,
      checkedInAt: orderItems.checkedInAt,
      status: orders.status,
      orderNumber: orders.number,
      eventId: events.id,
      event: events.title,
      section: eventSeats.section,
      row: eventSeats.row,
      place: eventSeats.place,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(events, eq(events.id, orders.eventId))
    .innerJoin(eventSeats, eq(eventSeats.id, orderItems.seatId))
    .where(eq(orderItems.ticketCode, code))
    .limit(1);

  if (!t) return { ok: false, reason: "not_found", message: "Bunday chipta topilmadi" };
  const seat = `${t.section}, ${t.row}-qator, ${t.place}-o'rin`;
  if (t.status !== "paid") {
    return { ok: false, reason: "not_paid", message: t.status === "refunded" ? "Chipta qaytarilgan — yaroqsiz" : "Chipta to'lanmagan", seat, event: t.event };
  }
  if (eventId && t.eventId !== eventId) return { ok: false, reason: "other_event", message: "Bu chipta boshqa tadbir uchun", seat, event: t.event };

  const [marked] = await db
    .update(orderItems)
    .set({ checkedInAt: new Date(), checkedInBy: adminId })
    .where(and(eq(orderItems.id, t.itemId), sql`${orderItems.checkedInAt} is null`))
    .returning({ id: orderItems.id });
  if (!marked) {
    const [again] = await db.select({ at: orderItems.checkedInAt }).from(orderItems).where(eq(orderItems.id, t.itemId));
    const at = again?.at ?? t.checkedInAt;
    return { ok: false, reason: "used", message: "Chipta allaqachon ishlatilgan", seat, usedAt: at ? at.toISOString() : undefined, event: t.event };
  }
  return { ok: true, seat, event: t.event, orderNumber: t.orderNumber };
}
