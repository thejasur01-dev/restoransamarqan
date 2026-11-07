import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { AdminAuthError, audit, requireAdmin } from "@/lib/admin/auth";
import { csvResponse, toCsv } from "@/lib/admin/csv";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Sales per event within the period (by payment time), plus each event's current fill
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

  const rows = await db.execute<{
    title: string; city: string; venue: string; starts_at: string; status: string; capacity: string; sold: string; checked_in: string;
    period_orders: string; period_tickets: string; period_revenue: string; total_revenue: string;
  }>(sql`
    with paid as (
      select o.* from orders o where o.status = 'paid'
        and o.paid_at >= (${from}::date at time zone 'Asia/Tashkent')
        and o.paid_at < ((${to}::date + 1) at time zone 'Asia/Tashkent')
    )
    select e.title, e.city, v.name as venue, e.starts_at, e.status,
      (select count(*) from event_seats s where s.event_id = e.id and s.status <> 'blocked') as capacity,
      (select count(*) from event_seats s where s.event_id = e.id and s.status = 'sold') as sold,
      (select count(*) from order_items i join orders o on o.id = i.order_id where o.event_id = e.id and o.status = 'paid' and i.checked_in_at is not null) as checked_in,
      (select count(*) from paid p where p.event_id = e.id) as period_orders,
      (select count(*) from order_items i join paid p on p.id = i.order_id where p.event_id = e.id) as period_tickets,
      (select coalesce(sum(p.total), 0) from paid p where p.event_id = e.id) as period_revenue,
      (select coalesce(sum(o.total), 0) from orders o where o.event_id = e.id and o.status = 'paid') as total_revenue
    from events e join venues v on v.id = e.venue_id
    order by e.starts_at desc`);

  const fmt = (d: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", dateStyle: "short", timeStyle: "short" }).format(new Date(d));
  await audit(admin.id, "export", "events", null, { from, to });
  return csvResponse(
    `tadbirlar_${from}_${to}.csv`,
    toCsv(
      ["Tadbir", "Shahar", "Joy", "Sana", "Holat", "Sig'im", "Sotilgan", "Kirgan", "Davrdagi buyurtmalar", "Davrdagi chiptalar", "Davrdagi daromad (so'm)", "Jami daromad (so'm)"],
      rows.map((r) => [
        r.title, r.city, r.venue, fmt(r.starts_at), r.status, Number(r.capacity), Number(r.sold), Number(r.checked_in),
        Number(r.period_orders), Number(r.period_tickets), Number(r.period_revenue), Number(r.total_revenue),
      ]),
    ),
  );
}
