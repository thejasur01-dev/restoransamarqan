"use client";

import Link from "next/link";
import { useState } from "react";
import type { EventCardData, EventListQuery } from "@/lib/events";
import { EventCard } from "./EventCard";
import styles from "./EventList.module.css";

type Props = {
  initialItems: EventCardData[];
  initialHasMore: boolean;
  query: EventListQuery;
  now: number;
};

function listParams(query: EventListQuery, page: number) {
  const params = new URLSearchParams();
  if (query.past) params.set("past", "1");
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  return params.toString();
}

export function EventList({ initialItems, initialHasMore, query, now }: Props) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(query.page);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function loadMore(e: React.MouseEvent) {
    // Without JS (or with a modifier key) the link just opens the next page
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (state === "loading") return;

    setState("loading");
    try {
      const res = await fetch(`/api/events?${listParams(query, page + 1)}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { items: EventCardData[]; hasMore: boolean } = await res.json();
      setItems((prev) => {
        // Guard against duplicates if an event moved between pages since the first load
        const seen = new Set(prev.map((i) => i.slug));
        return [...prev, ...data.items.filter((i) => !seen.has(i.slug))];
      });
      setPage((p) => p + 1);
      setHasMore(data.hasMore);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        {query.q ? "So'rovingiz bo'yicha hech narsa topilmadi." : query.past ? "O'tgan tadbirlar hali yo'q." : "Hozircha rejalashtirilgan tadbirlar yo'q."}
      </p>
    );
  }

  return (
    <>
      <section className={styles.grid} aria-label="Tadbirlar ro'yxati">
        {items.map((event, i) => (
          <EventCard key={event.slug} event={event} now={now} priority={i < 3} />
        ))}
      </section>

      {hasMore && (
        <div className={styles.more}>
          <a
            href={`/?${listParams(query, page + 1)}`}
            rel="nofollow"
            className={`${styles.moreBtn} ${state === "loading" ? styles.loading : ""}`}
            onClick={loadMore}
            aria-busy={state === "loading"}
          >
            {state === "loading" ? <span className={styles.spinner} aria-label="Yuklanmoqda" /> : "Yana tadbirlar!"}
          </a>
          {state === "error" && (
            <p className={styles.error} role="alert">
              Yuklab bo&apos;lmadi. Internet aloqasini tekshirib, qayta urinib ko&apos;ring.
            </p>
          )}
        </div>
      )}
    </>
  );
}

export function ListFooterLink({ past }: { past: boolean }) {
  return (
    <p className={styles.footerLink}>
      {past ? <Link href="/">Kelgusi tadbirlar</Link> : <Link href="/?past=1">O&apos;tgan tadbirlar</Link>}
    </p>
  );
}
