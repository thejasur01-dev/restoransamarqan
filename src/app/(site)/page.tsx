import type { Metadata } from "next";
import { Suspense } from "react";
import { EventList, ListFooterLink } from "@/components/EventList";
import { ListSkeleton } from "@/components/ListSkeleton";
import { listEvents, normalizeListQuery } from "@/lib/events";
import { site } from "@/lib/site";
import styles from "./page.module.css";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const query = normalizeListQuery(await searchParams);
  const title = query.past ? site.pastTitle : site.listTitle;
  return {
    title: { absolute: `${title} — ${site.name}` },
    alternates: { canonical: query.past ? "/?past=1" : "/" },
    // Search results and deep pages are thin duplicates of the main list
    robots: query.q || query.page > 1 ? { index: false, follow: true } : undefined,
  };
}

async function Afisha({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const query = normalizeListQuery(await searchParams);
  const { items, hasMore, now } = await listEvents(query);

  return (
    <>
      <h1 className={styles.title}>
        {query.past ? site.pastTitle : site.listTitle}
        {query.q && <span className={styles.query}>«{query.q}» bo&apos;yicha qidiruv</span>}
      </h1>
      {/* key: a new query starts a fresh list instead of appending to the old one */}
      <EventList key={JSON.stringify(query)} initialItems={items} initialHasMore={hasMore} query={query} now={now} />
      <ListFooterLink past={query.past} />
    </>
  );
}

export default function Page({ searchParams }: PageProps<"/">) {
  return (
    <div className={`wrapper ${styles.page}`}>
      <Suspense fallback={<ListSkeleton />}>
        <Afisha searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
