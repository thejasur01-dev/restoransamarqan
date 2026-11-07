"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin } from "@/lib/admin/auth";
import type { FormState } from "./auth";

const { organizers, events } = schema;

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const OrganizerBody = z.object({
  name: z.string().trim().min(2, "Nomini kiriting").max(120),
  legalName: z.string().trim().min(2, "Yuridik nomini kiriting").max(200),
  inn: optional(20).refine((v) => !v || /^\d{9}(\d{5})?$/.test(v), "STIR 9 yoki 14 raqamdan iborat bo'lsin"),
  phone: optional(40),
  email: optional(200).refine((v) => !v || z.email().safeParse(v).success, "Email noto'g'ri"),
});

export async function saveOrganizerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("organizers");
  const id = Number(formData.get("id")) || null;
  const parsed = OrganizerBody.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring" };

  if (id) {
    await db.update(organizers).set(parsed.data).where(eq(organizers.id, id));
    await audit(admin.id, "update", "organizer", id, { name: parsed.data.name });
    // Legal details are printed on event pages
    updateTag("events");
    return { ok: "Saqlandi" };
  }
  const [created] = await db.insert(organizers).values(parsed.data).returning({ id: organizers.id });
  await audit(admin.id, "create", "organizer", created.id, { name: parsed.data.name });
  redirect("/admin/organizers");
}

export async function deleteOrganizerAction(formData: FormData) {
  const admin = await requireAdmin("organizers");
  const id = Number(formData.get("id"));
  const [used] = await db.select({ n: sql<number>`count(*)::int` }).from(events).where(eq(events.organizerId, id));
  if (used.n > 0) redirect(`/admin/organizers/${id}?error=in_use`);
  await db.delete(organizers).where(eq(organizers.id, id));
  await audit(admin.id, "delete", "organizer", id);
  redirect("/admin/organizers");
}
