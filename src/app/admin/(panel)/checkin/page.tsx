import type { Metadata } from "next";
import { Suspense } from "react";
import { and, asc, gte, lte, sql } from "drizzle-orm";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { CheckinScanner } from "@/components/admin/CheckinScanner";
import { dateTime } from "@/components/admin/format";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Chipta tekshirish" };

async function Checkin() {
  await connection();
  await requireAdminPage("checkin");
  const { events } = schema;
  // Events from 12 hours ago to 2 days ahead: what can realistically be at the door now
  const list = await db
    .select({ id: events.id, title: events.title, startsAt: events.startsAt })
    .from(events)
    .where(and(gte(events.startsAt, sql`now() - interval '12 hours'`), lte(events.startsAt, sql`now() + interval '2 days'`)))
    .orderBy(asc(events.startsAt))
    .limit(100);

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Chipta tekshirish</h1>
          <p>QR-kodni kameraga ko&apos;rsating yoki chipta kodini kiriting</p>
        </div>
      </div>
      <CheckinScanner events={list.map((e) => ({ id: e.id, label: `${e.title} — ${dateTime(e.startsAt)}` }))} />
    </>
  );
}

export default function CheckinPage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Checkin />
    </Suspense>
  );
}
