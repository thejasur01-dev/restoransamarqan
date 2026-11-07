import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventForm } from "@/components/admin/EventForm";
import { requireAdminPage } from "@/lib/admin/auth";
import { organizerOptions, venueOptions } from "@/lib/admin/options";

export const metadata: Metadata = { title: "Yangi tadbir" };

async function NewEvent() {
  await requireAdminPage("events");
  const [venues, organizers] = await Promise.all([venueOptions(), organizerOptions()]);
  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/events">Tadbirlar</Link> / Yangi
      </p>
      <div className="a-head">
        <h1>Yangi tadbir</h1>
      </div>
      {(venues.length === 0 || organizers.length === 0) && (
        <p className="a-note" style={{ marginBottom: 16 }}>
          Avval {venues.length === 0 && <Link href="/admin/venues/new">joy (zal)</Link>}
          {venues.length === 0 && organizers.length === 0 && " va "}
          {organizers.length === 0 && <Link href="/admin/organizers/new">tashkilotchi</Link>} qo&apos;shing.
        </p>
      )}
      <EventForm
        venues={venues}
        organizers={organizers}
        values={{ title: "", slug: "", type: "Uchrashuv", venueId: "", organizerId: organizers.length === 1 ? organizers[0].id : "", startsAt: "", ageLimit: 0, imageUrl: "", description: "", officialUrl: "", status: "draft", holdMinutes: 15 }}
      />
    </>
  );
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <NewEvent />
    </Suspense>
  );
}
