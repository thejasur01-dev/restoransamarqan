import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Tashkilotchilar" };

async function Organizers() {
  await requireAdminPage("organizers");
  const { organizers, events } = schema;
  const rows = await db
    .select({
      id: organizers.id,
      name: organizers.name,
      legalName: organizers.legalName,
      inn: organizers.inn,
      phone: organizers.phone,
      events: sql<number>`(select count(*)::int from ${events} where ${events.organizerId} = ${organizers.id})`,
    })
    .from(organizers)
    .orderBy(asc(organizers.name));

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Tashkilotchilar</h1>
          <p>{rows.length} ta</p>
        </div>
        <Link href="/admin/organizers/new" className="a-btn a-btn-primary">
          + Yangi tashkilotchi
        </Link>
      </div>
      <div className="a-table-wrap">
        {rows.length === 0 ? (
          <p className="a-empty">Hali tashkilotchi yo&apos;q</p>
        ) : (
          <table className="a-table">
            <thead>
              <tr>
                <th>Nomi</th>
                <th>Yuridik nomi</th>
                <th>STIR</th>
                <th>Telefon</th>
                <th className="num">Tadbirlar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/organizers/${o.id}`}>{o.name}</Link>
                  </td>
                  <td className="wrap">{o.legalName}</td>
                  <td>{o.inn ?? "—"}</td>
                  <td>{o.phone ?? "—"}</td>
                  <td className="num">{o.events}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function OrganizersPage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Organizers />
    </Suspense>
  );
}
