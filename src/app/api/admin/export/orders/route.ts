import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminAuthError, audit, requireAdmin } from "@/lib/admin/auth";
import { csvResponse, toCsv } from "@/lib/admin/csv";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS: Record<string, string> = { pending: "Kutilmoqda", paid: "To'langan", cancelled: "Bekor", expired: "Muddati o'tgan", refunded: "Qaytarilgan" };

// Paid orders in the period (by payment time), one row per order
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin("reports");
  } catch (e) {
    if (e instanceof AdminAuthError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const sp = request.nextUrl.searchParams;
  const from = DATE.test(sp.get("from") ?? "") ? sp.get("from")! : "2000-01-01";
  const to = DATE.test(sp.get("to") ?? "") ? sp.get("to")! : "2100-01-01";
  const eventId = Number(sp.get("event")) || null;

  const rows = await db.execute<{
    number: number; status: string; total: number; email: string | null; phone: string; title: string; starts_at: string;
    paid_at: string | null; created_at: string; provider: string | null; txn: string | null; tickets: string; seats: string | null;
  }>(sql`
    select o.number, o.status, o.total, o.email, o.phone, e.title, e.starts_at, o.paid_at, o.created_at,
      o.payment_provider as provider, o.provider_transaction_id as txn,
      (select count(*) from order_items i where i.order_id = o.id) as tickets,
      (select string_agg(s.section || ' ' || s.row || '-' || s.place, ', ' order by s.id)
        from order_items i join event_seats s on s.id = i.seat_id where i.order_id = o.id) as seats
    from orders o join events e on e.id = o.event_id
    where o.status = 'paid'
      and o.paid_at >= (${from}::date at time zone 'Asia/Tashkent')
      and o.paid_at < ((${to}::date + 1) at time zone 'Asia/Tashkent')
      ${eventId ? sql`and o.event_id = ${eventId}` : sql``}
    order by o.paid_at`);

  const fmt = (d: string | null) =>
    d ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" }).format(new Date(d)) : "";

  await audit(admin.id, "export", "orders", null, { from, to, eventId, rows: rows.length });
  return csvResponse(
    `buyurtmalar_${from}_${to}.csv`,
    toCsv(
      ["Raqam", "Holat", "Summa (so'm)", "Chiptalar", "O'rinlar", "Tadbir", "Tadbir sanasi", "Telefon", "Email", "To'langan vaqt", "To'lov tizimi", "Tranzaksiya"],
      rows.map((r) => [r.number, STATUS[r.status] ?? r.status, r.total, Number(r.tickets), r.seats, r.title, fmt(r.starts_at), r.phone, r.email, fmt(r.paid_at), r.provider, r.txn]),
    ),
  );
}
