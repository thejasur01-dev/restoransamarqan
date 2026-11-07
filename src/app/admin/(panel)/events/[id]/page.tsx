import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { EventForm } from "@/components/admin/EventForm";
import { EventTabs } from "@/components/admin/EventTabs";
import { toLocalInput } from "@/components/admin/format";
import { requireAdminPage } from "@/lib/admin/auth";
import { organizerOptions, venueOptions } from "@/lib/admin/options";
import { deleteEventAction } from "@/app/admin/_actions/events";

export const metadata: Metadata = { title: "Tadbir" };

async function EditEvent({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  await requireAdminPage("events");
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();
  const [event] = await db.select().from(schema.events).where(eq(schema.events.id, id));
  if (!event) notFound();
  const [venues, organizers] = await Promise.all([venueOptions(), organizerOptions()]);

  return (
    <>
      <EventTabs id={id} title={event.title} slug={event.slug} active="info" />
      {sp.error === "has_orders" && (
        <p className="a-error" style={{ marginBottom: 16 }}>
          Buyurtmalari bor tadbirni o&apos;chirib bo&apos;lmaydi. Uni «Bekor qilingan» holatiga o&apos;tkazing.
        </p>
      )}
      <EventForm
        venues={venues}
        organizers={organizers}
        values={{
          id: event.id,
          title: event.title,
          slug: event.slug,
          type: event.type,
          venueId: event.venueId,
          organizerId: event.organizerId,
          startsAt: toLocalInput(event.startsAt),
          ageLimit: event.ageLimit,
          imageUrl: event.imageUrl,
          description: event.description,
          officialUrl: event.officialUrl ?? "",
          status: event.status,
          holdMinutes: event.holdMinutes,
        }}
      />
      <div className="a-card">
        <h2>Tadbirni o&apos;chirish</h2>
        <p style={{ color: "var(--a-muted)", marginBottom: 12 }}>
          Faqat buyurtmasi yo&apos;q tadbirni o&apos;chirish mumkin. Sotuv boshlangan bo&apos;lsa, holatini «Bekor qilingan» qiling.
        </p>
        <form action={deleteEventAction}>
          <input type="hidden" name="id" value={event.id} />
          <ConfirmButton message="Tadbir butunlay o'chirilsinmi?" className="a-btn a-btn-danger">
            O&apos;chirish
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}

export default function EditEventPage(props: PageProps<"/admin/events/[id]">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <EditEvent {...props} />
    </Suspense>
  );
}
