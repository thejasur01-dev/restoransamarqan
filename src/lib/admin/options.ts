import "server-only";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";

export async function venueOptions() {
  const rows = await db.select({ id: schema.venues.id, name: schema.venues.name, city: schema.venues.city }).from(schema.venues).orderBy(asc(schema.venues.city), asc(schema.venues.name));
  return rows.map((v) => ({ id: v.id, name: `${v.name} (${v.city})` }));
}

export async function organizerOptions() {
  return db.select({ id: schema.organizers.id, name: schema.organizers.name }).from(schema.organizers).orderBy(asc(schema.organizers.name));
}
