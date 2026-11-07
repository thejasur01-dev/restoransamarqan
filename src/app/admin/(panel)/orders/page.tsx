import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUS, dateTime, money } from "@/components/admin/format";
import { requireAdminPage } from "@/lib/admin/auth";
import { desc } from "drizzle-orm";

export const metadata: Metadata = { title: "Buyurtmalar" };

const PAGE = 50;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  await requireAdminPage("orders");
  const sp = await searchParams;
  const pick = (k: string) => ((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "").trim();
  const q = pick("q").slice(0, 100);
  const status = ["pending", "paid", "cancelled", "expired", "refunded"].includes(pick("status")) ? pick("status") : "";
  const eventId = Number(pick("event")) || null;
  const from = DATE.test(pick("from")) ? pick("from") : "";
  const to = DATE.test(pick("to")) ? pick("to") : "";
  const page = Math.max(1, Math.min(1000, Number(pick("page")) || 1));

  const where = [sql`true`];
  if (status === "pending") where.push(sql`o.status = 'pending' and o.expires_at > now()`);
  else if (status === "expired") where.push(sql`(o.status = 'expired' or (o.status = 'pending' and o.expires_at <= now()))`);
  else if (status) where.push(sql`o.status = ${status}::order_status`);
  if (eventId) where.push(sql`o.event_id = ${eventId}`);
  if (from) where.push(sql`o.created_at >= (${from}::date at time zone 'Asia/Tashkent')`);
  if (to) where.push(sql`o.created_at < ((${to}::date + 1) at time zone 'Asia/Tashkent')`);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(sql`(
      ${digits && digits.length <= 9 && /^\d+$/.test(q) ? sql`o.number = ${Number(digits)} or` : sql``}
      ${digits.length >= 4 ? sql`regexp_replace(o.phone, '[^0-9]', '', 'g') like ${`%${digits}%`} or` : sql``}
      o.email ilike ${like} or o.provider_transaction_id = ${q}
      or exists (select 1 from order_items i where i.order_id = o.id and i.ticket_code = ${q.toUpperCase().replace(/[^A-Z0-9]/g, "")})
    )`);
  }

  const rows = await db.execute<{
    id: string; number: number; status: string; expired: boolean; total: number; phone: string; email: string | null; title: string;
    created_at: string; paid_at: string | null; provider: string | null; tickets: string;
  }>(sql`
    select o.id, o.number, o.status, (o.status = 'pending' and o.expires_at <= now()) as expired, o.total, o.phone, o.email,
      e.title, o.created_at, o.paid_at, o.payment_provider as provider,
      (select count(*) from order_items i where i.order_id = o.id) as tickets
    from orders o join events e on e.id = o.event_id
    where ${sql.join(where, sql` and `)}
    order by o.created_at desc
    limit ${PAGE + 1} offset ${(page - 1) * PAGE}`);

  const events = await db.select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt }).from(schema.events).orderBy(desc(schema.events.startsAt)).limit(300);
  const hasNext = rows.length > PAGE;
  const list = rows.slice(0, PAGE);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    if (eventId) u.set("event", String(eventId));
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    u.set("page", String(p));
    return `?${u}`;
  };

  return (
    <>
      <div className="a-head">
        <h1>Buyurtmalar</h1>
      </div>
      <form className="a-filters" method="get">
        <label className="a-field" style={{ minWidth: 260 }}>
          <span>Qidirish</span>
          <input className="a-input" name="q" defaultValue={q} placeholder="№, telefon, email, chipta kodi, tranzaksiya" />
        </label>
        <label className="a-field">
          <span>Holat</span>
          <select name="status" defaultValue={status}>
            <option value="">Barchasi</option>
            {Object.entries(ORDER_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field" style={{ minWidth: 240 }}>
          <span>Tadbir</span>
          <select name="event" defaultValue={eventId ?? ""}>
            <option value="">Barcha tadbirlar</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} — {dateTime(e.startsAt)}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Dan</span>
          <input className="a-input" type="date" name="from" defaultValue={from} />
        </label>
        <label className="a-field">
          <span>Gacha</span>
          <input className="a-input" type="date" name="to" defaultValue={to} />
        </label>
        <button className="a-btn a-btn-primary">Ko&apos;rsatish</button>
        <Link className="a-btn" href="/admin/orders">
          Tozalash
        </Link>
      </form>

      <div className="a-table-wrap">
        {list.length === 0 ? (
          <p className="a-empty">Buyurtmalar topilmadi</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>№</th>
                <th>Yaratilgan</th>
                <th>Tadbir</th>
                <th>Xaridor</th>
                <th>Holat</th>
                <th className="num">Chiptalar</th>
                <th className="num">Summa</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const st = o.expired ? ORDER_STATUS.expired : ORDER_STATUS[o.status];
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`}>№ {o.number}</Link>
                    </td>
                    <td>{dateTime(o.created_at)}</td>
                    <td className="wrap">{o.title}</td>
                    <td>
                      {o.phone}
                      {o.email && <div style={{ color: "var(--a-muted)", fontSize: 12 }}>{o.email}</div>}
                    </td>
                    <td>
                      <span className={`a-badge ${st.cls}`}>{st.label}</span>
                      {o.provider && <div style={{ color: "var(--a-muted)", fontSize: 12 }}>{o.provider}</div>}
                    </td>
                    <td className="num">{Number(o.tickets)}</td>
                    <td className="num">{money(o.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div className="a-pager">
        <span>{page}-sahifa</span>
        {page > 1 && (
          <Link className="a-btn a-btn-sm" href={qs(page - 1)}>
            ← Oldingi
          </Link>
        )}
        {hasNext && (
          <Link className="a-btn a-btn-sm" href={qs(page + 1)}>
            Keyingi →
          </Link>
        )}
      </div>
    </>
  );
}

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}
