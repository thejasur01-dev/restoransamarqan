import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  doublePrecision,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", ["draft", "published", "cancelled"]);
export const seatStatus = pgEnum("seat_status", ["available", "held", "sold", "blocked"]);
export const orderStatus = pgEnum("order_status", ["pending", "paid", "cancelled", "expired", "refunded"]);

export const organizers = pgTable("organizers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // Legal details shown at the bottom of every event page
  legalName: text("legal_name").notNull(),
  inn: text("inn"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  // Static decorations of the hall plan (stage, bar, table outlines).
  // Seats themselves live in event_seats so each event has its own inventory.
  layout: jsonb("layout").$type<HallLayout>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull().default("Uchrashuv"),
    city: text("city").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    venueId: integer("venue_id")
      .notNull()
      .references(() => venues.id, { onDelete: "restrict" }),
    organizerId: integer("organizer_id")
      .notNull()
      .references(() => organizers.id, { onDelete: "restrict" }),
    ageLimit: smallint("age_limit").notNull().default(0),
    imageUrl: text("image_url").notNull(),
    description: text("description").notNull().default(""),
    officialUrl: text("official_url"),
    status: eventStatus("status").notNull().default("draft"),
    // Seats held in a cart are released after this many minutes
    holdMinutes: smallint("hold_minutes").notNull().default(15),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("events_slug_uq").on(t.slug),
    index("events_status_starts_idx").on(t.status, t.startsAt),
  ],
);

export const priceCategories = pgTable(
  "price_categories",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Whole UZS (so'm). Click/Payme operate in so'm, no fractional part is used.
    price: integer("price").notNull(),
    color: text("color").notNull(),
  },
  (t) => [index("price_categories_event_idx").on(t.eventId), check("price_non_negative", sql`${t.price} >= 0`)],
);

export const eventSeats = pgTable(
  "event_seats",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    priceCategoryId: integer("price_category_id")
      .notNull()
      .references(() => priceCategories.id, { onDelete: "restrict" }),
    section: text("section").notNull(),
    row: text("row").notNull(),
    place: text("place").notNull(),
    // Seats sharing a group key (e.g. one table) can only be bought together
    groupKey: text("group_key"),
    x: doublePrecision("x").notNull(),
    y: doublePrecision("y").notNull(),
    status: seatStatus("status").notNull().default("available"),
    holdToken: uuid("hold_token"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    orderId: uuid("order_id"),
  },
  (t) => [
    uniqueIndex("event_seats_place_uq").on(t.eventId, t.section, t.row, t.place),
    index("event_seats_event_status_idx").on(t.eventId, t.status),
    index("event_seats_hold_idx").on(t.holdToken),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Short human-readable number printed on tickets and used with the payment provider
    number: serial("number").notNull(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "restrict" }),
    holdToken: uuid("hold_token").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    comment: text("comment"),
    total: integer("total").notNull(),
    status: orderStatus("status").notNull().default("pending"),
    paymentProvider: text("payment_provider"),
    providerTransactionId: text("provider_transaction_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.number),
    index("orders_event_idx").on(t.eventId),
    uniqueIndex("orders_provider_txn_uq").on(t.paymentProvider, t.providerTransactionId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    seatId: integer("seat_id")
      .notNull()
      .references(() => eventSeats.id, { onDelete: "restrict" }),
    // Price is copied at purchase time so later category edits don't change paid orders
    price: integer("price").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), uniqueIndex("order_items_seat_order_uq").on(t.orderId, t.seatId)],
);

export type HallLayout = {
  width: number;
  height: number;
  title?: string;
  shapes: Array<
    | { kind: "table"; x: number; y: number; w: number; h: number; label: string }
    | { kind: "bar"; x: number; y: number; w: number; h: number }
    | { kind: "stage"; x: number; y: number; w: number; label: string }
  >;
};
