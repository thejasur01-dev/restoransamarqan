import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// Day boundaries are Tashkent days, not server (UTC) days
const TZ = "Asia/Tashkent";
const startOfTodaySql = sql.raw(`(date_trunc('day', now() at time zone '${TZ}') at time zone '${TZ}')`);

export type Totals = { revenue: number; orders: number; tickets: number };

/** Paid sales since `daysBack` Tashkent midnights ago (0 = today). Optionally for one event. */
export async function salesTotals(daysBack: number, eventId?: number): Promise<Totals> {
  const rows = await db.execute<{ revenue: string | null; orders: string; tickets: string }>(sql`
    select coalesce(sum(o.total), 0) as revenue, count(*) as orders,
      coalesce(sum((select count(*) from order_items i where i.order_id = o.id)), 0) as tickets
    from orders o
    where o.status = 'paid' and o.paid_at >= ${startOfTodaySql} - make_interval(days => ${daysBack})
      ${eventId ? sql`and o.event_id = ${eventId}` : sql``}`);
  const r = rows[0];
  return { revenue: Number(r.revenue ?? 0), orders: Number(r.orders), tickets: Number(r.tickets) };
}

export async function salesBetween(from: string, to: string, eventId?: number): Promise<Totals> {
  const rows = await db.execute<{ revenue: string | null; orders: string; tickets: string }>(sql`
    select coalesce(sum(o.total), 0) as revenue, count(*) as orders,
      coalesce(sum((select count(*) from order_items i where i.order_id = o.id)), 0) as tickets
    from orders o
    where o.status = 'paid'
      and o.paid_at >= (${from}::date at time zone ${TZ})
      and o.paid_at < ((${to}::date + 1) at time zone ${TZ})
      ${eventId ? sql`and o.event_id = ${eventId}` : sql``}`);
  const r = rows[0];
  return { revenue: Number(r.revenue ?? 0), orders: Number(r.orders), tickets: Number(r.tickets) };
}

/** Revenue and tickets per Tashkent day, including days with no sales. */
export async function dailySales(from: string, to: string, eventId?: number) {
  const rows = await db.execute<{ day: string; revenue: string; tickets: string }>(sql`
    with days as (select generate_series(${from}::date, ${to}::date, interval '1 day')::date as day)
    select to_char(d.day, 'YYYY-MM-DD') as day,
      coalesce(sum(o.total), 0) as revenue,
      coalesce(sum((select count(*) from order_items i where i.order_id = o.id)), 0) as tickets
    from days d
    left join orders o on o.status = 'paid'
      and (o.paid_at at time zone ${TZ})::date = d.day
      ${eventId ? sql`and o.event_id = ${eventId}` : sql``}
    group by d.day order by d.day`);
  return rows.map((r) => ({ day: r.day, revenue: Number(r.revenue), tickets: Number(r.tickets) }));
}

export type EventSummary = {
  id: number;
  slug: string;
  title: string;
  status: "draft" | "published" | "cancelled";
  startsAt: Date;
  venueName: string;
  city: string;
  capacity: number;
  sold: number;
  held: number;
  checkedIn: number;
  revenue: number;
};

/** Per-event inventory and revenue, for the dashboard and events list. */
export async function eventSummaries(opts: { scope: "upcoming" | "past" | "all"; q?: string; status?: string; limit?: number; offset?: number }) {
  const where = [sql`true`];
  if (opts.scope === "upcoming") where.push(sql`e.starts_at >= now() - interval '2 hours'`);
  if (opts.scope === "past") where.push(sql`e.starts_at < now() - interval '2 hours'`);
  if (opts.status) where.push(sql`e.status = ${opts.status}::event_status`);
  if (opts.q) where.push(sql`(e.title ilike ${`%${opts.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`} or e.city ilike ${`%${opts.q}%`})`);

  const rows = await db.execute<{
    id: number; slug: string; title: string; status: EventSummary["status"]; starts_at: string; venue_name: string; city: string;
    capacity: string; sold: string; held: string; checked_in: string; revenue: string;
  }>(sql`
    select e.id, e.slug, e.title, e.status, e.starts_at, v.name as venue_name, e.city,
      (select count(*) from event_seats s where s.event_id = e.id and s.status <> 'blocked') as capacity,
      (select count(*) from event_seats s where s.event_id = e.id and s.status = 'sold') as sold,
      (select count(*) from event_seats s where s.event_id = e.id and s.status = 'held' and s.hold_expires_at > now()) as held,
      (select count(*) from order_items i join orders o on o.id = i.order_id
        where o.event_id = e.id and o.status = 'paid' and i.checked_in_at is not null) as checked_in,
      (select coalesce(sum(o.total), 0) from orders o where o.event_id = e.id and o.status = 'paid') as revenue
    from events e join venues v on v.id = e.venue_id
    where ${sql.join(where, sql` and `)}
    order by ${opts.scope === "past" ? sql`e.starts_at desc` : sql`e.starts_at asc`}
    limit ${opts.limit ?? 100} offset ${opts.offset ?? 0}`);

  return rows.map(
    (r): EventSummary => ({
      id: r.id,
      slug: r.slug,
      title: r.title,
      status: r.status,
      startsAt: new Date(r.starts_at),
      venueName: r.venue_name,
      city: r.city,
      capacity: Number(r.capacity),
      sold: Number(r.sold),
      held: Number(r.held),
      checkedIn: Number(r.checked_in),
      revenue: Number(r.revenue),
    }),
  );
}

export async function pendingOrdersCount() {
  const rows = await db.execute<{ n: string }>(sql`select count(*) as n from orders where status = 'pending' and expires_at > now()`);
  return Number(rows[0].n);
}

/** "YYYY-MM-DD" in Tashkent, `daysBack` days before today */
export function tashkentDate(daysBack = 0) {
  const d = new Date(Date.now() - daysBack * 86400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
