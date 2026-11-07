import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { EVENT_STATUS, dateTime, money } from "@/components/admin/format";
import { SalesChart } from "@/components/admin/SalesChart";
import { requireAdminPage } from "@/lib/admin/auth";
import { dailySales, eventSummaries, pendingOrdersCount, salesBetween, salesTotals, tashkentDate } from "@/lib/admin/reports";
import { db, schema } from "@/db";
import { desc } from "drizzle-orm";

export const metadata: Metadata = { title: "Hisobotlar" };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function Reports({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  // Reports are always computed for the current moment ("today", default period)
  await connection();
  await requireAdminPage("reports");
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const from = DATE.test(pick("from")) ? pick("from") : tashkentDate(29);
  const to = DATE.test(pick("to")) ? pick("to") : tashkentDate(0);
  const eventId = Number(pick("event")) || undefined;

  const [today, week, month, period, daily, upcoming, pending, events] = await Promise.all([
    salesTotals(0, eventId),
    salesTotals(6, eventId),
    salesTotals(29, eventId),
    salesBetween(from, to, eventId),
    dailySales(from, to, eventId),
    eventSummaries({ scope: "upcoming", limit: 50 }),
    pendingOrdersCount(),
    db.select({ id: schema.events.id, title: schema.events.title, startsAt: schema.events.startsAt }).from(schema.events).orderBy(desc(schema.events.startsAt)).limit(300),
  ]);

  const exportQuery = new URLSearchParams({ from, to, ...(eventId ? { event: String(eventId) } : {}) }).toString();

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Hisobotlar</h1>
          <p>To&apos;langan buyurtmalar bo&apos;yicha, Toshkent vaqti bilan</p>
        </div>
        <div className="a-actions">
          <a className="a-btn" href={`/api/admin/export/orders?${exportQuery}`}>
            ⬇ Buyurtmalar (CSV)
          </a>
          <a className="a-btn" href={`/api/admin/export/events?${exportQuery}`}>
            ⬇ Tadbirlar bo&apos;yicha (CSV)
          </a>
        </div>
      </div>

      <div className="a-grid a-grid-4" style={{ marginBottom: 16 }}>
        <div className="a-stat">
          <span>Bugun</span>
          <b>{money(today.revenue)}</b>
          <small>{today.tickets} ta chipta · {today.orders} ta buyurtma</small>
        </div>
        <div className="a-stat">
          <span>So&apos;nggi 7 kun</span>
          <b>{money(week.revenue)}</b>
          <small>{week.tickets} ta chipta · {week.orders} ta buyurtma</small>
        </div>
        <div className="a-stat">
          <span>So&apos;nggi 30 kun</span>
          <b>{money(month.revenue)}</b>
          <small>{month.tickets} ta chipta · {month.orders} ta buyurtma</small>
        </div>
        <div className="a-stat">
          <span>Hozir to&apos;lov kutilmoqda</span>
          <b>{pending}</b>
          <small>
            <Link href="/admin/orders?status=pending">buyurtmani ko&apos;rish</Link>
          </small>
        </div>
      </div>

      <div className="a-card">
        <form className="a-filters" method="get">
          <label className="a-field">
            <span>Dan</span>
            <input className="a-input" type="date" name="from" defaultValue={from} />
          </label>
          <label className="a-field">
            <span>Gacha</span>
            <input className="a-input" type="date" name="to" defaultValue={to} />
          </label>
          <label className="a-field" style={{ minWidth: 260 }}>
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
          <button className="a-btn a-btn-primary">Ko&apos;rsatish</button>
        </form>
        <h2>
          Kunlik daromad: {money(period.revenue)} · {period.tickets} ta chipta · {period.orders} ta buyurtma
        </h2>
        <SalesChart data={daily} />
      </div>

      <div className="a-card">
        <h2>Kelgusi tadbirlar</h2>
        {upcoming.length === 0 ? (
          <p className="a-empty">Kelgusi tadbirlar yo&apos;q</p>
        ) : (
          <div className="a-table-wrap" style={{ border: 0 }}>
            <table className="a-table">
              <thead>
                <tr>
                  <th>Tadbir</th>
                  <th>Sana</th>
                  <th>Holat</th>
                  <th>To&apos;lganlik</th>
                  <th className="num">Sotilgan</th>
                  <th className="num">Daromad</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((e) => {
                  const fill = e.capacity ? Math.round((e.sold / e.capacity) * 100) : 0;
                  return (
                    <tr key={e.id}>
                      <td className="wrap">
                        <Link href={`/admin/events/${e.id}`}>{e.title}</Link>
                        <div style={{ color: "var(--a-muted)", fontSize: 12 }}>
                          {e.venueName}, {e.city}
                        </div>
                      </td>
                      <td>{dateTime(e.startsAt)}</td>
                      <td>
                        <span className={`a-badge ${EVENT_STATUS[e.status].cls}`}>{EVENT_STATUS[e.status].label}</span>
                      </td>
                      <td>
                        <div className="a-actions">
                          <div className="a-progress" aria-hidden="true">
                            <i style={{ width: `${fill}%` }} />
                          </div>
                          <span>{fill}%</span>
                        </div>
                      </td>
                      <td className="num">
                        {e.sold} / {e.capacity}
                      </td>
                      <td className="num">{money(e.revenue)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminHome({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Reports searchParams={searchParams} />
    </Suspense>
  );
}
