"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { HallBlock } from "@/db/schema";
import { audit, requireAdmin } from "@/lib/admin/auth";
import { generateHall, validateBlocks } from "@/lib/hall-builder";
import type { FormState } from "./auth";

const { venues, events } = schema;

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const coord = int(0, 5000);
const section = z.string().trim().min(1, "Bo'lim nomini kiriting").max(40);
const id = z.string().regex(/^[a-z]+-[a-z0-9]+$/);

const Block = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tables"), id, section, x: coord, y: coord, rows: int(1, 40), cols: int(1, 40), seatsPerTable: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]), startNumber: int(1, 9999), gapX: int(70, 400), gapY: int(70, 400) }),
  z.object({ kind: z.literal("rows"), id, section, x: coord, y: coord, rows: int(1, 80), seatsPerRow: int(1, 120), startRow: int(1, 999), spacing: int(18, 80), rowGap: int(20, 120) }),
  z.object({ kind: z.literal("bar"), id, section, x: coord, y: coord, seats: int(1, 60), spacing: int(20, 80) }),
  z.object({ kind: z.literal("stage"), id, x: coord, y: coord, width: int(60, 3000), label: z.string().trim().max(40) }),
]);

const VenueBody = z.object({
  name: z.string().trim().min(2, "Nomini kiriting").max(120),
  city: z.string().trim().min(2, "Shaharni kiriting").max(60),
  address: z.string().trim().min(3, "Manzilni kiriting").max(200),
  lat: z.union([z.literal("").transform(() => null), z.coerce.number().min(-90).max(90)]),
  lng: z.union([z.literal("").transform(() => null), z.coerce.number().min(-180).max(180)]),
  blocks: z.string().transform((v, ctx) => {
    try {
      return z.array(Block).max(60).parse(JSON.parse(v)) as HallBlock[];
    } catch {
      ctx.addIssue({ code: "custom", message: "Zal sxemasidagi qiymatlarni tekshiring" });
      return z.NEVER;
    }
  }),
});

export async function saveVenueAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("venues");
  const venueId = Number(formData.get("id")) || null;
  const parsed = VenueBody.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring" };
  const { blocks, ...data } = parsed.data;
  const problem = validateBlocks(blocks);
  if (problem) return { error: problem };

  // Existing events keep their own snapshot of the plan; this affects new seat generation only
  const values = { ...data, blocks, layout: blocks.length ? generateHall(blocks).layout : null };
  if (venueId) {
    await db.update(venues).set(values).where(eq(venues.id, venueId));
    await audit(admin.id, "update", "venue", venueId, { name: data.name, blocks: blocks.length });
    updateTag("events");
    return { ok: "Saqlandi" };
  }
  const [created] = await db.insert(venues).values(values).returning({ id: venues.id });
  await audit(admin.id, "create", "venue", created.id, { name: data.name });
  redirect(`/admin/venues/${created.id}`);
}

export async function deleteVenueAction(formData: FormData) {
  const admin = await requireAdmin("venues");
  const venueId = Number(formData.get("id"));
  const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(events).where(eq(events.venueId, venueId));
  if (used.n > 0) redirect(`/admin/venues/${venueId}?error=in_use`);
  await db.delete(venues).where(eq(venues.id, venueId));
  await audit(admin.id, "delete", "venue", venueId);
  redirect("/admin/venues");
}
