import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { site } from "./site";

const { events, venues, organizers, eventSeats, priceCategories } = schema;

// An event stays in the upcoming list (and on sale) for a while after doors open.
export const UPCOMING_GRACE = sql`interval '2 hours'`;

export type EventCardData = {
  slug: string;
  title: string;
  type: string;
  startsAt: string;
  venueName: string;
  imageUrl: string;
  minPrice: number | null;
  soldOut: boolean;
  past: boolean;
};

export type EventListQuery = { past: boolean; q: string; page: number };

// A seat counts as free when it is available, or when someone's cart hold has run out.
const seatIsFree = sql`(${eventSeats.status} = 'available' or (${eventSeats.status} = 'held' and ${eventSeats.holdExpiresAt} < now()))`;

const minPriceExpr = sql<number | null>`(
  select min(${priceCategories.price}) from ${eventSeats}
  join ${priceCategories} on ${priceCategories.id} = ${eventSeats.priceCategoryId}
  where ${eventSeats.eventId} = ${events.id} and ${seatIsFree}
)`.mapWith((v) => (v === null ? null : Number(v)));

const hasSeatsExpr = sql<boolean>`exists(select 1 from ${eventSeats} where ${eventSeats.eventId} = ${events.id})`;

const isUpcomingExpr = sql`${events.startsAt} >= now() - ${UPCOMING_GRACE}`;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function normalizeListQuery(raw: { past?: string | string[]; q?: string | string[]; page?: string | string[] }): EventListQuery {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const page = Number.parseInt(first(raw.page), 10);
  return {
    past: first(raw.past) === "1",
    q: first(raw.q).trim().slice(0, 100),
    page: Number.isFinite(page) && page > 0 && page <= 1000 ? page : 1,
  };
}

export async function listEvents({ past, q, page }: EventListQuery) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events");

  const filters = [eq(events.status, "published"), past ? sql`not (${isUpcomingExpr})` : isUpcomingExpr];
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    filters.push(or(ilike(events.title, pattern), ilike(events.city, pattern), ilike(venues.name, pattern))!);
  }

  const rows = await db
    .select({
      slug: events.slug,
      title: events.title,
      type: events.type,
      startsAt: events.startsAt,
      venueName: venues.name,
      imageUrl: events.imageUrl,
      minPrice: minPriceExpr,
      hasSeats: hasSeatsExpr,
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(and(...filters))
    .orderBy(past ? desc(events.startsAt) : asc(events.startsAt), asc(events.id))
    .limit(site.pageSize + 1)
    .offset((page - 1) * site.pageSize);

  const items: EventCardData[] = rows.slice(0, site.pageSize).map((r) => ({
    slug: r.slug,
    title: r.title,
    type: r.type,
    startsAt: r.startsAt.toISOString(),
    venueName: r.venueName,
    imageUrl: r.imageUrl,
    minPrice: past ? null : r.minPrice,
    soldOut: !past && r.hasSeats && r.minPrice === null,
    past,
  }));

  // "now" is captured with the data so the "today" badge always matches this cached snapshot
  return { items, hasMore: rows.length > site.pageSize, now: Date.now() };
}

export type EventDetails = Awaited<ReturnType<typeof getEvent>>;

export async function getEvent(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("events", `event:${slug}`);

  const [row] = await db
    .select({
      id: events.id,
      slug: events.slug,
      title: events.title,
      type: events.type,
      city: events.city,
      startsAt: events.startsAt,
      ageLimit: events.ageLimit,
      imageUrl: events.imageUrl,
      description: events.description,
      officialUrl: events.officialUrl,
      upcoming: sql<boolean>`${isUpcomingExpr}`,
      minPrice: minPriceExpr,
      hasSeats: hasSeatsExpr,
      venue: {
        name: venues.name,
        city: venues.city,
        address: venues.address,
        lat: venues.lat,
        lng: venues.lng,
      },
      organizer: {
        legalName: organizers.legalName,
        inn: organizers.inn,
        phone: organizers.phone,
        email: organizers.email,
      },
    })
    .from(events)
    .innerJoin(venues, eq(venues.id, events.venueId))
    .innerJoin(organizers, eq(organizers.id, events.organizerId))
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);

  if (!row) return null;
  return {
    ...row,
    startsAt: row.startsAt.toISOString(),
    now: Date.now(),
    soldOut: row.upcoming && row.hasSeats && row.minPrice === null,
  };
}
