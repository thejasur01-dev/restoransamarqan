import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventView } from "@/components/EventView";
import { Spinner } from "@/components/Spinner";
import { getEvent } from "@/lib/events";
import { formatEventDate } from "@/lib/format";
import styles from "./page.module.css";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Tadbir topilmadi", robots: { index: false } };

  const when = formatEventDate(new Date(event.startsAt));
  const description = `${event.title} — ${when}, ${event.venue.name} (${event.venue.city}). Chiptalarni onlayn xarid qiling.`;
  return {
    title: `${event.title}, ${when}`,
    description,
    alternates: { canonical: `/e/${event.slug}` },
    openGraph: { title: event.title, description, images: [{ url: event.imageUrl }] },
  };
}

async function Content({ params }: { params: PageProps<"/e/[slug]">["params"] }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  return <EventView event={event} now={event.now} />;
}

// Direct visits and shared links render the event as a full page instead of a modal.
export default function EventPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <div className={styles.page}>
      <div className={styles.panel}>
        <Suspense fallback={<Spinner />}>
          <Content params={params} />
        </Suspense>
      </div>
    </div>
  );
}
