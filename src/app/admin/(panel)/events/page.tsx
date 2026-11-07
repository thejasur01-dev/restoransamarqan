import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EVENT_STATUS, dateTime, money } from "@/components/admin/format";
import { requireAdminPage } from "@/lib/admin/auth";
import { eventSummaries } from "@/lib/admin/reports";

export const metadata: Metadata = { title: "Tadbirlar" };

const SCOPES = [
  { key: "upcoming", label: "Kelgusi" },
  { key: "past", label: "O'tgan" },
  { key: "draft", label: "Qoralamalar" },
  { key: "all", label: "Barchasi" },
] as const;

async function EventsList({ searchParams }: { searchParams: PageProps<"/admin/events">["searchParams"] }) {
  await requireAdminPage("events");
  const sp = await searchParams;
  const pick = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const scope = SCOPES.find((s) => s.key === pick("scope"))?.key ?? "upcoming";
  const q = pick("q").trim().slice(0, 100);

  const list = await eventSummaries({
    scope: scope === "draft" ? "all" : scope,
    status: scope === "draft" ? "draft" : undefined,
    q: q || undefined,
    limit: 300,
  });

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Tadbirlar</h1>
          <p>{list.length} ta tadbir</p>
        </div>
        <Link href="/admin/events/new" className="a-btn a-btn-primary">
          + Yangi tadbir
        </Link>
      </div>

      <nav className="a-tabs">
        {SCOPES.map((s) => (
          <Link key={s.key} href={`/admin/events?scope=${s.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`} aria-current={scope === s.key ? "page" : undefined}>
            {s.label}
          </Link>
        ))}
      </nav>

      <form className="a-filters" method="get">
        <input type="hidden" name="scope" value={scope} />
        <label className="a-field" style={{ minWidth: 280 }}>
          <span>Qidirish</span>
          <input className="a-input" name="q" defaultValue={q} placeholder="Nomi yoki shahar" />
        </label>
        <button className="a-btn">Qidirish</button>
      </form>

      <div className="a-table-wrap">
        {list.length === 0 ? (
          <p className="a-empty">Tadbirlar topilmadi</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Tadbir</th>
                <th>Sana</th>
                <th>Holat</th>
                <th className="num">Sotilgan</th>
                <th className="num">Kirgan</th>
                <th className="num">Daromad</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
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
                  <td className="num">
                    {e.sold} / {e.capacity}
                  </td>
                  <td className="num">{e.checkedIn}</td>
                  <td className="num">{money(e.revenue)}</td>
                  <td>
                    <div className="a-actions">
                      <Link className="a-btn a-btn-sm" href={`/admin/events/${e.id}/seating`}>
                        Zal
                      </Link>
                      <Link className="a-btn a-btn-sm" href={`/admin/orders?event=${e.id}`}>
                        Buyurtmalar
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function EventsPage({ searchParams }: PageProps<"/admin/events">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <EventsList searchParams={searchParams} />
    </Suspense>
  );
}
