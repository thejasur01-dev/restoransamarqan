import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminPage } from "@/lib/admin/auth";
import { generateHall } from "@/lib/hall-builder";

export const metadata: Metadata = { title: "Joylar va zallar" };

async function Venues() {
  await requireAdminPage("venues");
  const { venues, events } = schema;
  const rows = await db
    .select({
      id: venues.id,
      name: venues.name,
      city: venues.city,
      address: venues.address,
      blocks: venues.blocks,
      events: sql<number>`(select count(*)::int from ${events} where ${events.venueId} = ${venues.id})`,
    })
    .from(venues)
    .orderBy(asc(venues.city), asc(venues.name));

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Joylar va zallar</h1>
          <p>{rows.length} ta joy</p>
        </div>
        <Link href="/admin/venues/new" className="a-btn a-btn-primary">
          + Yangi joy
        </Link>
      </div>
      <div className="a-table-wrap">
        {rows.length === 0 ? (
          <p className="a-empty">Hali joy qo&apos;shilmagan</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Shahar</th>
                <th>Manzil</th>
                <th className="num">O&apos;rinlar</th>
                <th className="num">Tadbirlar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/admin/venues/${v.id}`}>{v.name}</Link>
                  </td>
                  <td>{v.city}</td>
                  <td className="wrap">{v.address}</td>
                  <td className="num">{v.blocks?.length ? generateHall(v.blocks).seats.length : <span className="a-badge a-badge-amber">sxema yo&apos;q</span>}</td>
                  <td className="num">{v.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function VenuesPage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Venues />
    </Suspense>
  );
}
