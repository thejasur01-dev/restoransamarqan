import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
  // Hall builder input (tables, rows, bar, stage); layout and seats are generated from it
  blocks: jsonb("blocks").$type<HallBlock[]>(),
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
    // Copy of the venue plan taken when seats were generated, so later venue edits
    // can't misalign an event whose seats are already on sale
    layout: jsonb("layout").$type<HallLayout>(),
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

// A customer is a verified phone number: no passwords, login is phone + one-time code.
export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("customers_phone_uq").on(t.phone)],
);

export const loginCodes = pgTable(
  "login_codes",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    // HMAC of the code; the code itself is never stored
    codeHash: text("code_hash").notNull(),
    channel: text("channel").notNull(),
    providerRequestId: text("provider_request_id"),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("login_codes_phone_idx").on(t.phone, t.createdAt)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    // SHA-256 of the cookie value, so a database leak doesn't expose live sessions
    tokenHash: text("token_hash").notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sessions_token_uq").on(t.tokenHash), index("sessions_customer_idx").on(t.customerId)],
);

// Fixed-window counters shared by all app instances (no Redis needed at this scale)
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
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
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    email: text("email"),
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
    index("orders_customer_idx").on(t.customerId, t.createdAt),
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
    // Printed as a QR code on the ticket; issued only once the order is paid
    ticketCode: text("ticket_code"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    checkedInBy: integer("checked_in_by").references(() => admins.id, { onDelete: "set null" }),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    uniqueIndex("order_items_seat_order_uq").on(t.orderId, t.seatId),
    uniqueIndex("order_items_ticket_code_uq").on(t.ticketCode),
  ],
);

export const adminRole = pgEnum("admin_role", ["owner", "manager", "checker"]);

export const admins = pgTable(
  "admins",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: adminRole("role").notNull().default("manager"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("admins_email_uq").on(t.email)],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    adminId: integer("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_sessions_token_uq").on(t.tokenHash), index("admin_sessions_admin_idx").on(t.adminId)],
);

// Who changed what and when; never updated, only appended
export const adminAudit = pgTable(
  "admin_audit",
  {
    id: serial("id").primaryKey(),
    adminId: integer("admin_id").references(() => admins.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("admin_audit_created_idx").on(t.createdAt), index("admin_audit_entity_idx").on(t.entity, t.entityId)],
);

/** Hall builder blocks. Coordinates are in plan units (the SVG viewBox). */
export type HallBlock =
  | {
      kind: "tables";
      id: string;
      section: string;
      x: number;
      y: number;
      rows: number;
      cols: number;
      seatsPerTable: 2 | 4 | 6 | 8;
      startNumber: number;
      gapX: number;
      gapY: number;
    }
  | { kind: "rows"; id: string; section: string; x: number; y: number; rows: number; seatsPerRow: number; startRow: number; spacing: number; rowGap: number }
  | { kind: "bar"; id: string; section: string; x: number; y: number; seats: number; spacing: number }
  | { kind: "stage"; id: string; x: number; y: number; width: number; label: string };

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
