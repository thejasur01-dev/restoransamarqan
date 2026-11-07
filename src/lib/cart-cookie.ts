import "server-only";
import { cookies } from "next/headers";

// Identifies a visitor's cart across requests. httpOnly so scripts can't read it;
// SameSite=Lax so other sites can't make purchase requests with it.
const NAME = "cart";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function readCartToken() {
  const value = (await cookies()).get(NAME)?.value;
  return value && UUID.test(value) ? value : null;
}

/** Only callable from Route Handlers / Server Functions, where cookies can be written. */
export async function ensureCartToken() {
  const existing = await readCartToken();
  if (existing) return existing;
  const token = crypto.randomUUID();
  (await cookies()).set(NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return token;
}
