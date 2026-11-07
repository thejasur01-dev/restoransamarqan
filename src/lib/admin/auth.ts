import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { clientIp, hit } from "@/lib/rate-limit";
import { verifyPassword } from "./password";

const { admins, adminSessions, adminAudit } = schema;

export type AdminRole = "owner" | "manager" | "checker";
export type Admin = { id: number; email: string; name: string; role: AdminRole };

const COOKIE = "admin_sid";
const SESSION_HOURS = 12;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** What each role may open. Owners can do everything. */
export const PERMISSIONS = {
  reports: ["owner", "manager"],
  events: ["owner", "manager"],
  venues: ["owner", "manager"],
  organizers: ["owner", "manager"],
  orders: ["owner", "manager"],
  checkin: ["owner", "manager", "checker"],
  admins: ["owner"],
  audit: ["owner"],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(admin: Admin, permission: Permission) {
  return (PERMISSIONS[permission] as readonly AdminRole[]).includes(admin.role);
}

export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select({ id: admins.id, email: admins.email, name: admins.name, role: admins.role })
    .from(adminSessions)
    .innerJoin(admins, eq(admins.id, adminSessions.adminId))
    .where(and(eq(adminSessions.tokenHash, hashToken(token)), gt(adminSessions.expiresAt, sql`now()`), eq(admins.active, true)))
    .limit(1);
  return row ?? null;
});

/** For pages: sends the visitor to the login page, or home if their role lacks access. */
export async function requireAdminPage(permission: Permission) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  if (!can(admin, permission)) redirect(admin.role === "checker" ? "/admin/checkin" : "/admin");
  return admin;
}

export class AdminAuthError extends Error {}

/** For Server Actions and route handlers: they can be called directly, so every one checks. */
export async function requireAdmin(permission: Permission) {
  const admin = await getAdmin();
  if (!admin || !can(admin, permission)) throw new AdminAuthError("Ruxsat yo'q");
  return admin;
}

export async function login(email: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await clientIp();
  const normalized = email.trim().toLowerCase();
  if (!(await hit(`admin-login:ip:${ip}`, 20, 900)) || !(await hit(`admin-login:email:${normalized}`, 10, 900))) {
    return { ok: false, error: "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring." };
  }

  const [admin] = await db.select().from(admins).where(eq(admins.email, normalized)).limit(1);
  // Same message whether the email or the password is wrong, so emails can't be probed
  if (!admin || !admin.active || !(await verifyPassword(password, admin.passwordHash))) {
    return { ok: false, error: "Email yoki parol noto'g'ri" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.insert(adminSessions).values({ tokenHash: hashToken(token), adminId: admin.id, expiresAt });
  await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.id));
  await audit(admin.id, "login", "admin", admin.id, { ip });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    // Strict: the admin cookie is never sent on requests started from other sites
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return { ok: true };
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hashToken(token)));
  store.delete(COOKIE);
}

/** Ends every session of an admin (after a password change or deactivation). */
export async function revokeSessions(adminId: number) {
  await db.delete(adminSessions).where(eq(adminSessions.adminId, adminId));
}

export async function audit(adminId: number | null, action: string, entity: string, entityId: string | number | null, details?: unknown) {
  await db.insert(adminAudit).values({ adminId, action, entity, entityId: entityId === null ? null : String(entityId), details: details ?? null });
}
