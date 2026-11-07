import Image from "next/image";
import Link from "next/link";
import type { EventDetails } from "@/lib/events";
import { formatEventDate, formatPriceFrom, isSameTashkentDay } from "@/lib/format";
import styles from "./EventView.module.css";

type Props = {
  event: NonNullable<EventDetails>;
  now: number;
  titleId?: string;
  /** In the modal the page below already has an h1 */
  headingLevel?: 1 | 2;
};

function BuyButton({ event, className }: { event: Props["event"]; className?: string }) {
  if (!event.upcoming) return <span className={`btn ${styles.buy} ${className ?? ""}`} aria-disabled="true">Tadbir yakunlangan</span>;
  if (event.soldOut) return <span className={`btn ${styles.buy} ${className ?? ""}`} aria-disabled="true">Chiptalar sotilgan</span>;
  return (
    <Link href={`/e/${event.slug}/buy`} className={`btn ${styles.buy} ${className ?? ""}`}>
      {event.minPrice !== null ? `Sotib olish ${formatPriceFrom(event.minPrice)}` : "Sotib olish"}
    </Link>
  );
}

function mapSrc(venue: Props["event"]["venue"]) {
  if (venue.lat !== null && venue.lng !== null) {
    return `https://yandex.uz/map-widget/v1/?ll=${venue.lng},${venue.lat}&z=16&pt=${venue.lng},${venue.lat},pm2gnm&lang=uz_UZ`;
  }
  return `https://yandex.uz/map-widget/v1/?text=${encodeURIComponent(`${venue.city}, ${venue.address}`)}&z=16&lang=uz_UZ`;
}

export function EventView({ event, now, titleId, headingLevel = 1 }: Props) {
  const startsAt = new Date(event.startsAt);
  const isToday = event.upcoming && isSameTashkentDay(startsAt, new Date(now));
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const { organizer, venue } = event;

  return (
    <article>
      <Heading id={titleId} className={`${styles.title} dots-bottom`}>
        {event.title}
      </Heading>

      <div className={styles.info}>
        <time dateTime={event.startsAt} className={styles.date}>
          {isToday ? "bugun " : ""}
          {formatEventDate(startsAt)}
        </time>
        <a href="#venue" className={styles.venueLink}>
          {venue.name}
        </a>
        {event.ageLimit > 0 && <span className={styles.age}>{event.ageLimit}+</span>}
      </div>

      <div className={`${styles.center} dots-bottom`}>
        <div className={styles.topBuy}>
          <BuyButton event={event} />
        </div>
        <div className={styles.poster}>
          <Image
            src={event.imageUrl}
            alt={event.title}
            width={564}
            height={317}
            sizes="(max-width: 767px) 100vw, 564px"
            loading="eager"
            fetchPriority="high"
            unoptimized={event.imageUrl.endsWith(".svg")}
          />
        </div>
        {event.description && <div className={`${styles.text} dots-bottom`}>{event.description}</div>}

        <div className={styles.actions}>
          <BuyButton event={event} className={styles.bottomBuy} />
          {event.officialUrl && (
            <div className={styles.official}>
              <span>Rasmiy sahifa</span>
              <a href={event.officialUrl} target="_blank" rel="noopener noreferrer nofollow">
                {event.officialUrl.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>
      </div>

      <div className={styles.bottom} id="venue">
        <h3 className={styles.venueName}>{venue.name}</h3>
        <p className={styles.address}>
          {venue.city}, {venue.address}
        </p>
        <iframe
          className={styles.map}
          src={mapSrc(venue)}
          title={`Xarita: ${venue.name}`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        <div className={styles.requisites}>
          Tashkilotchi:
          <br />
          {organizer.legalName}
          {organizer.inn && (
            <>
              <br />
              STIR: {organizer.inn}
            </>
          )}
          {organizer.phone && (
            <>
              <br />
              Telefon: <a href={`tel:${organizer.phone.replace(/[^\d+]/g, "")}`}>{organizer.phone}</a>
            </>
          )}
          {organizer.email && (
            <>
              <br />
              Email: <a href={`mailto:${organizer.email}`}>{organizer.email}</a>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
