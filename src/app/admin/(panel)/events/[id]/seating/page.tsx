import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { AdminSeatPlan, type AdminSeat } from "@/components/admin/AdminSeatPlan";
import { CategoryEditor } from "@/components/admin/CategoryEditor";
import { EventTabs } from "@/components/admin/EventTabs";
import { GenerateSeats } from "@/components/admin/GenerateSeats";
import { requireAdminPage } from "@/lib/admin/auth";
import { generateHall } from "@/lib/hall-builder";

export const metadata: Metadata = { title: "Narxlar va zal" };

const { events, venues, priceCategories, eventSeats, orders } = schema;

async function Seating({ params, searchParams }: PageProps<"/admin/events/[id]/seating">) {
  await requireAdminPage("events");
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();

  const [event] = await db
    .select({ id: events.id, title: events.title, slug: events.slug, layout: events.layout, venueLayout: venues.layout, venueId: venues.id, venueName: venues.name, blocks: venues.blocks })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(events.id, id));
  if (!event) notFound();

  const [categories, seats, [orderCount]] = await Promise.all([
    db
      .select({
        id: priceCategories.id,
        name: priceCategories.name,
        price: priceCategories.price,
        color: priceCategories.color,
        seats: sql<number>`(select count(*)::int from ${eventSeats} where ${eventSeats.priceCategoryId} = ${priceCategories.id})`,
      })
      .from(priceCategories)
      .where(eq(priceCategories.eventId, id))
      .orderBy(asc(priceCategories.price)),
    db
      .select({
        id: eventSeats.id,
        categoryId: eventSeats.priceCategoryId,
        section: eventSeats.section,
        row: eventSeats.row,
        place: eventSeats.place,
        group: sql<string>`coalesce(${eventSeats.groupKey}, 's' || ${eventSeats.id})`,
        x: eventSeats.x,
        y: eventSeats.y,
        // An expired cart hold is effectively free
        status: sql<AdminSeat["status"]>`case when ${eventSeats.status} = 'held' and ${eventSeats.holdExpiresAt} <= now() then 'available' else ${eventSeats.status}::text end`,
      })
      .from(eventSeats)
      .where(eq(eventSeats.eventId, id))
      .orderBy(asc(eventSeats.id)),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.eventId, id)),
  ]);

  const plan = event.blocks?.length ? generateHall(event.blocks) : null;
  const blockOptions = (event.blocks ?? [])
    .filter((b): b is Exclude<typeof b, { kind: "stage" }> => b.kind !== "stage")
    .map((b) => ({ id: b.id, label: b.section, seats: plan?.seats.filter((s) => s.blockId === b.id).length ?? 0 }));
  const locked = orderCount.n > 0 || seats.some((s) => s.status === "sold" || s.status === "held");
  const layout = event.layout ?? event.venueLayout ?? plan?.layout;

  return (
    <>
      <EventTabs id={id} title={event.title} slug={event.slug} active="seating" />
      {sp.error === "category_in_use" && (
        <p className="a-error" style={{ marginBottom: 16 }}>
          Bu toifada o&apos;rindiqlar bor. Avval ularni boshqa toifaga o&apos;tkazing.
        </p>
      )}

      <CategoryEditor eventId={id} categories={categories} />

      <div className="a-card">
        <h2>O&apos;rindiqlarni joy sxemasidan yaratish</h2>
        <p style={{ marginBottom: 12 }}>
          Joy: <b>{event.venueName}</b> · <Link href={`/admin/venues/${event.venueId}`}>sxemani tahrirlash</Link>
        </p>
        {!plan ? (
          <p className="a-note">
            Bu joyning zal sxemasi hali yo&apos;q. <Link href={`/admin/venues/${event.venueId}`}>Sxemani chizing</Link>, keyin shu yerga qayting.
          </p>
        ) : categories.length === 0 ? (
          <p className="a-note">Avval yuqorida kamida bitta narx toifasini qo&apos;shing.</p>
        ) : (
          <GenerateSeats eventId={id} blocks={blockOptions} categories={categories} existingSeats={seats.length} locked={locked} />
        )}
      </div>

      {seats.length > 0 && layout && <AdminSeatPlan eventId={id} layout={layout} seats={seats} categories={categories} />}
    </>
  );
}

export default function SeatingPage(props: PageProps<"/admin/events/[id]/seating">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Seating {...props} />
    </Suspense>
  );
}
