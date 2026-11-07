import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminAuthError, audit, requireAdmin } from "@/lib/admin/auth";
import { csvResponse, toCsv } from "@/lib/admin/csv";

// Door list for one event: every paid ticket with seat, code, buyer and check-in time
export async function GET(request: NextRequest) {
  let admin;
  try {
    admin = await requireAdmin("orders");
  } catch (e) {
    if (e instanceof AdminAuthError) return new Response("Forbidden", { status: 403 });
    throw e;
  }
  const eventId = Number(request.nextUrl.searchParams.get("event"));
  if (!Number.isInteger(eventId) || eventId <= 0) return new Response("event required", { status: 400 });

  const rows = await db.execute<{ section: string; row: string; place: string; code: string | null; number: number; phone: string; email: string | null; price: number; checked_in_at: string | null }>(sql`
    select s.section, s.row, s.place, i.ticket_code as code, o.number, o.phone, o.email, i.price, i.checked_in_at
    from order_items i
    join orders o on o.id = i.order_id
    join event_seats s on s.id = i.seat_id
    where o.event_id = ${eventId} and o.status = 'paid'
    order by s.section, s.row, s.place`);

  const fmt = (d: string | null) => (d ? new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", timeStyle: "short", dateStyle: "short" }).format(new Date(d)) : "");
  await audit(admin.id, "export", "attendees", eventId, { rows: rows.length });
  return csvResponse(
    `mehmonlar_${eventId}.csv`,
    toCsv(
      ["Bo'lim", "Qator", "O'rin", "Chipta kodi", "Buyurtma", "Telefon", "Email", "Narx (so'm)", "Kirgan vaqt"],
      rows.map((r) => [r.section, r.row, r.place, r.code, r.number, r.phone, r.email, r.price, fmt(r.checked_in_at)]),
    ),
  );
}
