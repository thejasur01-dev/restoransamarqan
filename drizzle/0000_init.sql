CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'cancelled', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."seat_status" AS ENUM('available', 'held', 'sold', 'blocked');--> statement-breakpoint
CREATE TABLE "event_seats" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"price_category_id" integer NOT NULL,
	"section" text NOT NULL,
	"row" text NOT NULL,
	"place" text NOT NULL,
	"group_key" text,
	"x" double precision NOT NULL,
	"y" double precision NOT NULL,
	"status" "seat_status" DEFAULT 'available' NOT NULL,
	"hold_token" uuid,
	"hold_expires_at" timestamp with time zone,
	"order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"type" text DEFAULT 'Uchrashuv' NOT NULL,
	"city" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"venue_id" integer NOT NULL,
	"organizer_id" integer NOT NULL,
	"age_limit" smallint DEFAULT 0 NOT NULL,
	"image_url" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"official_url" text,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"hold_minutes" smallint DEFAULT 15 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"seat_id" integer NOT NULL,
	"price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" serial NOT NULL,
	"event_id" integer NOT NULL,
	"hold_token" uuid NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"comment" text,
	"total" integer NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_provider" text,
	"provider_transaction_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"legal_name" text NOT NULL,
	"inn" text,
	"phone" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"color" text NOT NULL,
	CONSTRAINT "price_non_negative" CHECK ("price_categories"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"address" text NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"layout" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_seats" ADD CONSTRAINT "event_seats_price_category_id_price_categories_id_fk" FOREIGN KEY ("price_category_id") REFERENCES "public"."price_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_organizers_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seat_id_event_seats_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."event_seats"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_categories" ADD CONSTRAINT "price_categories_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_seats_place_uq" ON "event_seats" USING btree ("event_id","section","row","place");--> statement-breakpoint
CREATE INDEX "event_seats_event_status_idx" ON "event_seats" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "event_seats_hold_idx" ON "event_seats" USING btree ("hold_token");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uq" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_status_starts_idx" ON "events" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_seat_order_uq" ON "order_items" USING btree ("order_id","seat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_number_uq" ON "orders" USING btree ("number");--> statement-breakpoint
CREATE INDEX "orders_event_idx" ON "orders" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_txn_uq" ON "orders" USING btree ("payment_provider","provider_transaction_id");--> statement-breakpoint
CREATE INDEX "price_categories_event_idx" ON "price_categories" USING btree ("event_id");