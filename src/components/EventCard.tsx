import Image from "next/image";
import Link from "next/link";
import type { EventCardData } from "@/lib/events";
import { formatEventDate, formatPriceFrom, isSameTashkentDay } from "@/lib/format";
import styles from "./EventCard.module.css";

type Props = {
  event: EventCardData;
  /** Reference "now" from the server render, so server and client agree on the "today" badge */
  now: number;
  priority?: boolean;
};

// Shared by the server-rendered first page and the client-appended "load more" pages: no hooks here.
export function EventCard({ event, now, priority }: Props) {
  const startsAt = new Date(event.startsAt);
  const isToday = !event.past && isSameTashkentDay(startsAt, new Date(now));
  const hasPrice = event.minPrice !== null;

  let action = "Batafsil";
  let mobileAction: string | null = null;
  if (!event.past) {
    action = event.soldOut ? "Chiptalar sotilgan" : "Chipta sotib olish";
    mobileAction = event.soldOut ? "Chiptalar sotilgan" : hasPrice ? `Sotib olish ${formatPriceFrom(event.minPrice!)}` : "Sotib olish";
  }

  return (
    <Link href={`/e/${event.slug}`} scroll={false} className={styles.card}>
      <div className={styles.media}>
        <Image
          src={event.imageUrl}
          alt=""
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 360px"
          className={styles.image}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
          unoptimized={event.imageUrl.endsWith(".svg")}
        />
        <div className={styles.overlay} aria-hidden="true">
          <span className={`${styles.hoverBtn} ${event.soldOut ? styles.hoverBtnMuted : ""}`}>{action}</span>
        </div>
        {(isToday || hasPrice) && (
          <div className={styles.status}>
            {isToday && <span className={styles.today}>Bugun</span>}
            {hasPrice && <span className={`${styles.price} ${styles.desktopOnly}`}>{formatPriceFrom(event.minPrice!)}</span>}
          </div>
        )}
      </div>
      <h2 className={styles.title}>{event.title}</h2>
      <div className={`${styles.type} dots-bottom`}>{event.type}</div>
      <time className={styles.place} dateTime={event.startsAt}>
        <span>{formatEventDate(startsAt)}</span>
        <span className={styles.delimiter} aria-hidden="true">
          |
        </span>
        <span className={styles.venue}>{event.venueName}</span>
      </time>
      {mobileAction && (
        <div className={styles.mobileAction}>
          <span className="btn" aria-disabled={event.soldOut || undefined}>
            {mobileAction}
          </span>
        </div>
      )}
    </Link>
  );
}
