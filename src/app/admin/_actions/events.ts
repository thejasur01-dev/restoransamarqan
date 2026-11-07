"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { fromLocalInput } from "@/components/admin/format";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { SLUG_RE, slugify } from "@/lib/admin/slug";
import { generateHall } from "@/lib/hall-builder";
import { normalizeUzPhone } from "@/lib/phone";
import { SaleError } from "@/lib/seating";
import { createBoxOfficeOrder, generateEventSeats, setSeatsBlocked, setSeatsCategory } from "@/lib/seating-admin";
import type { FormState } from "./auth";

const { events, venues, organizers, priceCategories, eventSeats, orders } = schema;

/** Public pages read events through a cache; refresh it right after an admin change. */
function refreshPublic(...slugs: string[]) {
  updateTag("events");
  for (const s of slugs) updateTag(`event:${s}`);
}

const EventBody = z.object({
  title: z.string().trim().min(3, "Nomi kamida 3 belgi").max(200),
  slug: z.string().trim().max(90).optional(),
  type: z.string().trim().min(2, "Turini kiriting").max(60),
  venueId: z.coerce.number().int().positive("Joyni tanlang"),
  organizerId: z.coerce.number().int().positive("Tashkilotchini tanlang"),
  startsAt: z.string().transform((v, ctx) => fromLocalInput(v) ?? (ctx.addIssue({ code: "custom", message: "Sana va vaqtni kiriting" }), z.NEVER)),
  ageLimit: z.coerce.number().int().min(0).max(21),
  imageUrl: z.string().trim().min(1, "Afisha rasmini yuklang").max(300),
  description: z.string().trim().max(10000),
  officialUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^https?:\/\//.test(v), "Havola http:// yoki https:// bilan boshlansin")
    .transform((v) => v || null),
  status: z.enum(["draft", "published", "cancelled"]),
  holdMinutes: z.coerce.number().int().min(5).max(60),
});

async function uniqueSlug(base: string, exceptId?: number) {
  let slug = base;
  for (let n = 2; ; n++) {
    const [taken] = await db
      .select({ id: events.id })
      .from(events)
      .where(exceptId ? and(eq(events.slug, slug), ne(events.id, exceptId)) : eq(events.slug, slug))
      .limit(1);
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
}

export async function saveEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("events");
  const id = Number(formData.get("id")) || null;
  const parsed = EventBody.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring" };
  const data = parsed.data;

  const [venue] = await db.select({ city: venues.city }).from(venues).where(eq(venues.id, data.venueId));
  const [organizer] = await db.select({ id: organizers.id }).from(organizers).where(eq(organizers.id, data.organizerId));
  if (!venue || !organizer) return { error: "Joy yoki tashkilotchi topilmadi" };

  const requested = data.slug ? slugify(data.slug) : slugify(data.title);
  if (data.slug && !SLUG_RE.test(requested)) return { error: "Havola nomida faqat lotin harflari, raqam va - bo'lsin" };
  const slug = await uniqueSlug(requested, id ?? undefined);

  const existing = id ? (await db.select().from(events).where(eq(events.id, id)))[0] : null;
  if (id && !existing) return { error: "Tadbir topilmadi" };

  const [seatCount] = id ? await db.select({ n: sql<number>`count(*)::int` }).from(eventSeats).where(eq(eventSeats.eventId, id)) : [{ n: 0 }];
  if (existing && existing.venueId !== data.venueId && seatCount.n > 0) {
    return { error: "O'rindiqlari yaratilgan tadbirning joyini o'zgartirib bo'lmaydi. Avval «Narxlar va zal» bo'limida zalni qayta yarating." };
  }
  if (data.status === "published" && seatCount.n === 0) {
    return { error: "E'lon qilishdan oldin «Narxlar va zal» bo'limida o'rindiqlarni yarating. Hozircha «Qoralama» sifatida saqlang." };
  }

  const values = {
    title: data.title,
    slug,
    type: data.type,
    city: venue.city,
    startsAt: data.startsAt,
    venueId: data.venueId,
    organizerId: data.organizerId,
    ageLimit: data.ageLimit,
    imageUrl: data.imageUrl,
    description: data.description,
    officialUrl: data.officialUrl,
    status: data.status,
    holdMinutes: data.holdMinutes,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(events).set(values).where(eq(events.id, existing.id));
    await audit(admin.id, "update", "event", existing.id, { title: data.title, status: data.status });
    refreshPublic(existing.slug, slug);
    return { ok: "Saqlandi" };
  }

  const [created] = await db.insert(events).values(values).returning({ id: events.id });
  await audit(admin.id, "create", "event", created.id, { title: data.title });
  refreshPublic(slug);
  redirect(`/admin/events/${created.id}/seating`);
}

export async function deleteEventAction(formData: FormData) {
  const admin = await requireAdmin("events");
  const id = Number(formData.get("id"));
  const [event] = await db.select({ slug: events.slug, title: events.title }).from(events).where(eq(events.id, id));
  if (!event) redirect("/admin/events");
  const [hasOrders] = await db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.eventId, id));
  if (hasOrders.n > 0) redirect(`/admin/events/${id}?error=has_orders`);
  await db.delete(events).where(eq(events.id, id));
  await audit(admin.id, "delete", "event", id, { title: event.title });
  refreshPublic(event.slug);
  redirect("/admin/events");
}

const CategoryBody = z.object({
  eventId: z.coerce.number().int().positive(),
  id: z.coerce.number().int().positive().optional().or(z.literal("").transform(() => undefined)),
  name: z.string().trim().min(1, "Toifa nomini kiriting").max(60),
  price: z.coerce.number().int("Narx butun so'mda bo'lsin").min(0, "Narx manfiy bo'lmasin").max(100_000_000),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Rangni tanlang"),
});

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("events");
  const parsed = CategoryBody.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring" };
  const { eventId, id, name, price, color } = parsed.data;
  const [event] = await db.select({ slug: events.slug }).from(events).where(eq(events.id, eventId));
  if (!event) return { error: "Tadbir topilmadi" };

  if (id) {
    // Price changes apply to new carts; paid orders keep the price they were bought at
    await db.update(priceCategories).set({ name, price, color }).where(and(eq(priceCategories.id, id), eq(priceCategories.eventId, eventId)));
    await audit(admin.id, "update", "price_category", id, { name, price });
  } else {
    const [c] = await db.insert(priceCategories).values({ eventId, name, price, color }).returning({ id: priceCategories.id });
    await audit(admin.id, "create", "price_category", c.id, { eventId, name, price });
  }
  refreshPublic(event.slug);
  return { ok: "Saqlandi" };
}

export async function deleteCategoryAction(formData: FormData) {
  const admin = await requireAdmin("events");
  const id = Number(formData.get("id"));
  const eventId = Number(formData.get("eventId"));
  const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(eventSeats).where(eq(eventSeats.priceCategoryId, id));
  if (used.n > 0) redirect(`/admin/events/${eventId}/seating?error=category_in_use`);
  await db.delete(priceCategories).where(and(eq(priceCategories.id, id), eq(priceCategories.eventId, eventId)));
  await audit(admin.id, "delete", "price_category", id, { eventId });
  redirect(`/admin/events/${eventId}/seating`);
}

export async function generateSeatsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("events");
  const eventId = Number(formData.get("eventId"));
  const [event] = await db
    .select({ slug: events.slug, blocks: venues.blocks })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.id, eventId));
  if (!event) return { error: "Tadbir topilmadi" };
  if (!event.blocks?.length) return { error: "Bu joyning zal sxemasi hali chizilmagan. «Joylar va zallar» bo'limida yarating." };

  const mapping: Record<string, number> = {};
  for (const b of event.blocks) {
    if (b.kind === "stage") continue;
    mapping[b.id] = Number(formData.get(`block:${b.id}`));
  }
  try {
    const n = await generateEventSeats(eventId, generateHall(event.blocks), mapping);
    await audit(admin.id, "generate_seats", "event", eventId, { seats: n });
    refreshPublic(event.slug);
    return { ok: `${n} ta o'rindiq yaratildi` };
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
    throw e;
  }
}

const SeatOp = z.object({
  eventId: z.number().int().positive(),
  seatIds: z.array(z.number().int().positive()).min(1, "O'rindiqlarni tanlang").max(5000),
  op: z.enum(["category", "block", "unblock"]),
  categoryId: z.number().int().positive().optional(),
});

/** Called from the admin hall plan with the selected seats. */
export async function seatOpAction(input: z.input<typeof SeatOp>): Promise<FormState> {
  const admin = await requireAdmin("events");
  const parsed = SeatOp.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Noto'g'ri so'rov" };
  const { eventId, seatIds, op, categoryId } = parsed.data;
  const [event] = await db.select({ slug: events.slug }).from(events).where(eq(events.id, eventId));
  if (!event) return { error: "Tadbir topilmadi" };

  try {
    let n: number;
    if (op === "category") {
      if (!categoryId) return { error: "Narx toifasini tanlang" };
      n = await setSeatsCategory(eventId, seatIds, categoryId);
    } else {
      n = await setSeatsBlocked(eventId, seatIds, op === "block");
    }
    await audit(admin.id, `seats_${op}`, "event", eventId, { seats: seatIds.length, changed: n, categoryId });
    refreshPublic(event.slug);
    const skipped = seatIds.length - n;
    return { ok: `${n} ta o'rindiq o'zgartirildi${skipped ? ` (${skipped} tasi band yoki sotilgan — o'zgarmadi)` : ""}` };
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
    throw e;
  }
}

const BoxOffice = z.object({
  eventId: z.number().int().positive(),
  seatIds: z.array(z.number().int().positive()).min(1, "O'rindiqlarni tanlang").max(200),
  phone: z.string().max(40),
  email: z.string().trim().max(200).optional(),
  comment: z.string().trim().max(500).optional(),
});

export async function boxOfficeSaleAction(input: z.input<typeof BoxOffice>): Promise<FormState & { orderId?: string }> {
  const admin = await requireAdmin("orders");
  const parsed = BoxOffice.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Noto'g'ri so'rov" };
  const phone = normalizeUzPhone(parsed.data.phone);
  if (!phone) return { error: "Xaridor telefonini +998 XX XXX XX XX ko'rinishida kiriting" };
  const email = parsed.data.email ? z.email().safeParse(parsed.data.email.toLowerCase()) : null;
  if (email && !email.success) return { error: "Email noto'g'ri" };

  const [event] = await db.select({ slug: events.slug }).from(events).where(eq(events.id, parsed.data.eventId));
  if (!event) return { error: "Tadbir topilmadi" };
  try {
    const order = await createBoxOfficeOrder(parsed.data.eventId, parsed.data.seatIds, { phone, email: email?.data ?? null, comment: parsed.data.comment || null }, admin.id);
    await audit(admin.id, "box_office_sale", "order", order.id, { eventId: parsed.data.eventId, seats: parsed.data.seatIds.length });
    refreshPublic(event.slug);
    return { ok: `Buyurtma № ${order.number} yaratildi`, orderId: order.id };
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
    throw e;
  }
}
