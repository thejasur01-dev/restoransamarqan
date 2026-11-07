import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { VenueForm } from "@/components/admin/VenueForm";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Yangi joy" };

async function NewVenue() {
  await requireAdminPage("venues");
  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/venues">Joylar va zallar</Link> / Yangi
      </p>
      <div className="a-head">
        <h1>Yangi joy</h1>
      </div>
      <VenueForm
        values={{
          name: "",
          city: "",
          address: "",
          lat: "",
          lng: "",
          blocks: [
            { kind: "tables", id: "tables-main", section: "Stollar", x: 40, y: 40, rows: 3, cols: 4, seatsPerTable: 4, startNumber: 1, gapX: 110, gapY: 120 },
            { kind: "stage", id: "stage-main", x: 80, y: 440, width: 300, label: "Sahna" },
          ],
        }}
      />
    </>
  );
}

export default function NewVenuePage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <NewVenue />
    </Suspense>
  );
}
