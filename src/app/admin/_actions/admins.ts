"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin, revokeSessions } from "@/lib/admin/auth";
import { generatePassword, hashPassword } from "@/lib/admin/password";
import type { FormState } from "./auth";

const { admins } = schema;

export type PasswordState = (FormState & { password?: string; email?: string }) | null;

const Role = z.enum(["owner", "manager", "checker"]);

/** Never let the last active owner lose access: someone must always be able to manage admins. */
async function wouldRemoveLastOwner(adminId: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(admins)
    .where(and(eq(admins.role, "owner"), eq(admins.active, true), ne(admins.id, adminId)));
  return row.n === 0;
}

export async function createAdminAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const me = await requireAdmin("admins");
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().pipe(z.email("Email noto'g'ri")), name: z.string().trim().min(2, "Ismni kiriting").max(100), role: Role })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring" };

  const [exists] = await db.select({ id: admins.id }).from(admins).where(eq(admins.email, parsed.data.email));
  if (exists) return { error: "Bu email bilan admin allaqachon bor" };

  const password = generatePassword();
  const [created] = await db
    .insert(admins)
    .values({ ...parsed.data, passwordHash: await hashPassword(password) })
    .returning({ id: admins.id });
  await audit(me.id, "create", "admin", created.id, { email: parsed.data.email, role: parsed.data.role });
  // Shown once on screen; only the hash is stored
  return { ok: "Admin yaratildi", password, email: parsed.data.email };
}

export async function updateAdminAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireAdmin("admins");
  const parsed = z
    .object({ id: z.coerce.number().int().positive(), role: Role, active: z.enum(["true", "false"]).transform((v) => v === "true") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Ma'lumotlarni tekshiring" };
  const { id, role, active } = parsed.data;

  const [target] = await db.select({ role: admins.role, active: admins.active }).from(admins).where(eq(admins.id, id));
  if (!target) return { error: "Admin topilmadi" };
  if (target.role === "owner" && (role !== "owner" || !active) && (await wouldRemoveLastOwner(id))) {
    return { error: "Oxirgi faol «Egasi»ni o'zgartirib bo'lmaydi. Avval boshqa egani qo'shing." };
  }

  await db.update(admins).set({ role, active }).where(eq(admins.id, id));
  // Role or access changed: sign them out so the new rights apply immediately
  if (role !== target.role || !active) await revokeSessions(id);
  await audit(me.id, "update", "admin", id, { role, active });
  return { ok: "Saqlandi" };
}

export async function resetPasswordAction(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const me = await requireAdmin("admins");
  const id = Number(formData.get("id"));
  const [target] = await db.select({ email: admins.email }).from(admins).where(eq(admins.id, id));
  if (!target) return { error: "Admin topilmadi" };
  const password = generatePassword();
  await db.update(admins).set({ passwordHash: await hashPassword(password) }).where(eq(admins.id, id));
  await revokeSessions(id);
  await audit(me.id, "reset_password", "admin", id);
  return { ok: "Yangi parol yaratildi", password, email: target.email };
}
