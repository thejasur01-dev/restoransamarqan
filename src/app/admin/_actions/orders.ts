"use server";

import { updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { normalizeUzPhone } from "@/lib/phone";
import { markOrderPaid, SaleError } from "@/lib/seating";
import { cancelOrRefundOrder } from "@/lib/seating-admin";
import type { FormState } from "./auth";

const { orders, events } = schema;

async function refreshEventOf(orderId: string) {
  const [row] = await db.select({ slug: events.slug }).from(orders).innerJoin(events, eq(events.id, orders.eventId)).where(eq(orders.id, orderId));
  updateTag("events");
  if (row) updateTag(`event:${row.slug}`);
}

const ContactBody = z.object({
  orderId: z.uuid(),
  phone: z.string().max(40),
  email: z.string().trim().toLowerCase().max(200),
  comment: z.string().trim().max(500),
});

/** Fixes a buyer's mistyped contacts (the main support request). */
export async function updateContactsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("orders");
  const parsed = ContactBody.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ma'lumotlarni tekshiring" };
  const phone = normalizeUzPhone(parsed.data.phone);
  if (!phone) return { error: "Telefonni +998 XX XXX XX XX ko'rinishida kiriting" };
  if (parsed.data.email && !z.email().safeParse(parsed.data.email).success) return { error: "Email noto'g'ri" };

  const [before] = await db.select({ phone: orders.phone, email: orders.email }).from(orders).where(eq(orders.id, parsed.data.orderId));
  if (!before) return { error: "Buyurtma topilmadi" };
  await db
    .update(orders)
    .set({ phone, email: parsed.data.email || null, comment: parsed.data.comment || null })
    .where(eq(orders.id, parsed.data.orderId));
  await audit(admin.id, "update_contacts", "order", parsed.data.orderId, { before, after: { phone, email: parsed.data.email || null } });
  return { ok: "Saqlandi" };
}

export async function cancelOrderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("orders");
  const orderId = String(formData.get("orderId"));
  if (!z.uuid().safeParse(orderId).success) return { error: "Buyurtma topilmadi" };
  try {
    const result = await cancelOrRefundOrder(orderId);
    await audit(admin.id, result === "refunded" ? "refund" : "cancel", "order", orderId);
    await refreshEventOf(orderId);
    return {
      ok:
        result === "refunded"
          ? "Buyurtma qaytarildi: o'rinlar sotuvga qaytdi, chiptalar yaroqsiz. Pulni to'lov tizimi kabinetidan qaytaring."
          : "Buyurtma bekor qilindi, o'rinlar sotuvga qaytdi.",
    };
  } catch (e) {
    if (e instanceof SaleError) return { error: e.message };
    throw e;
  }
}

/** Confirms a payment received outside the website (cash, bank transfer). */
export async function markPaidAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("orders");
  const orderId = String(formData.get("orderId"));
  if (!z.uuid().safeParse(orderId).success) return { error: "Buyurtma topilmadi" };
  try {
    const ok = await markOrderPaid(orderId, "manual", `MANUAL-${admin.id}-${Date.now()}`);
    if (!ok) return { error: "Buyurtmani to'langan qilib bo'lmadi" };
    await audit(admin.id, "mark_paid", "order", orderId);
    await refreshEventOf(orderId);
    return { ok: "To'lov tasdiqlandi, chiptalar yaratildi" };
  } catch (e) {
    if (e instanceof SaleError) return { error: `${e.message}: o'rinlar bo'shab ketgan. Kassa orqali yangi buyurtma yarating.` };
    throw e;
  }
}
