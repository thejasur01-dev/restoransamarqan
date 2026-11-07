"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { audit, getAdmin, login, logout, requireAdmin, revokeSessions } from "@/lib/admin/auth";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/admin/password";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export type FormState = { error?: string; ok?: string } | null;

const LoginBody = z.object({ email: z.string().trim().max(200), password: z.string().min(1).max(200) });

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginBody.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: "Email va parolni kiriting" };
  const result = await login(parsed.data.email, parsed.data.password);
  if (!result.ok) return { error: result.error };
  const admin = await getAdmin();
  redirect(admin?.role === "checker" ? "/admin/checkin" : "/admin");
}

export async function logoutAction() {
  const admin = await getAdmin();
  if (admin) await audit(admin.id, "logout", "admin", admin.id);
  await logout();
  redirect("/admin/login");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("checkin"); // every role may change its own password
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  const [row] = await db.select({ hash: schema.admins.passwordHash }).from(schema.admins).where(eq(schema.admins.id, admin.id));
  if (!row || !(await verifyPassword(current, row.hash))) return { error: "Joriy parol noto'g'ri" };
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== repeat) return { error: "Yangi parollar mos kelmadi" };

  await db.update(schema.admins).set({ passwordHash: await hashPassword(next) }).where(eq(schema.admins.id, admin.id));
  // Other devices are signed out; this one signs in again
  await revokeSessions(admin.id);
  await audit(admin.id, "password_change", "admin", admin.id);
  redirect("/admin/login");
}
