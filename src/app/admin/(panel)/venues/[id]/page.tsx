import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { VenueForm } from "@/components/admin/VenueForm";
import { requireAdminPage } from "@/lib/admin/auth";
import { deleteVenueAction } from "@/app/admin/_actions/venues";

export const metadata: Metadata = { title: "Joy" };

async function EditVenue({ params, searchParams }: PageProps<"/admin/venues/[id]">) {
  await requireAdminPage("venues");
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();
  const [venue] = await db.select().from(schema.venues).where(eq(schema.venues.id, id));
  if (!venue) notFound();

  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/venues">Joylar va zallar</Link> / {venue.name}
      </p>
      <div className="a-head">
        <h1>{venue.name}</h1>
      </div>
      {sp.error === "in_use" && (
        <p className="a-error" style={{ marginBottom: 16 }}>
          Bu joyda tadbirlar bor — o&apos;chirib bo&apos;lmaydi.
        </p>
      )}
      <VenueForm
        values={{
          id: venue.id,
          name: venue.name,
          city: venue.city,
          address: venue.address,
          lat: venue.lat?.toString() ?? "",
          lng: venue.lng?.toString() ?? "",
          blocks: venue.blocks ?? [],
        }}
      />
      <div className="a-card">
        <h2>Joyni o&apos;chirish</h2>
        <form action={deleteVenueAction}>
          <input type="hidden" name="id" value={venue.id} />
          <ConfirmButton message={`"${venue.name}" o'chirilsinmi?`} className="a-btn a-btn-danger">
            O&apos;chirish
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}

export default function EditVenuePage(props: PageProps<"/admin/venues/[id]">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <EditVenue {...props} />
    </Suspense>
  );
}
