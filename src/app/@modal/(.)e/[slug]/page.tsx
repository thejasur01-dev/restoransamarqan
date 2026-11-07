import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventView } from "@/components/EventView";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Spinner";
import { getEvent } from "@/lib/events";

export { generateMetadata } from "../../../(site)/e/[slug]/page";

type Props = { params: Promise<{ slug: string }> };

// Closed modals stay mounted (hidden) by the router, so the id must be unique per event
const titleId = (slug: string) => `event-title-${slug}`;

async function Content({ params }: Props) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();
  return <EventView event={event} now={event.now} titleId={titleId(slug)} headingLevel={2} />;
}

async function LabelledModal({ params, children }: Props & { children: React.ReactNode }) {
  const { slug } = await params;
  return <Modal labelledBy={titleId(slug)}>{children}</Modal>;
}

// Shown when an event card is clicked: the list stays mounted underneath.
export default function EventModal({ params }: Props) {
  return (
    <Suspense fallback={null}>
      <LabelledModal params={params}>
        <Suspense fallback={<Spinner />}>
          <Content params={params} />
        </Suspense>
      </LabelledModal>
    </Suspense>
  );
}
