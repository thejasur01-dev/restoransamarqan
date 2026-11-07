import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { isDevDelivery, sendCode, type Channel } from "./otp-providers";
import { clientIp, hit } from "./rate-limit";

const { customers, loginCodes, sessions } = schema;

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;
export const RESEND_SECONDS = 60;
const SESSION_DAYS = 180;
const SESSION_COOKIE = "sid";

export class AuthError extends Error {
  constructor(
    public code: "rate_limited" | "invalid_code" | "expired" | "too_many_attempts" | "delivery_failed",
    message: string,
    public status: number,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || (process.env.NODE_ENV === "production" && (s.length < 32 || s.startsWith("dev-")))) {
    throw new Error("AUTH_SECRET must be set to a long random value in production");
  }
  return s;
}

const hashCode = (phone: string, code: string) => createHmac("sha256", secret()).update(`${phone}:${code}`).digest("hex");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export type CodeRequestResult = { channel: Channel; resendIn: number; devCode?: string };

export async function requestLoginCode(phone: string, opts: { viaSms?: boolean } = {}): Promise<CodeRequestResult> {
  const ip = await clientIp();

  // Each code costs money and can be abused to spam a number: limit per phone and per IP
  const [last] = await db
    .select({ createdAt: loginCodes.createdAt })
    .from(loginCodes)
    .where(eq(loginCodes.phone, phone))
    .orderBy(desc(loginCodes.createdAt))
    .limit(1);
  if (last) {
    const wait = RESEND_SECONDS - Math.floor((Date.now() - last.createdAt.getTime()) / 1000);
    if (wait > 0) throw new AuthError("rate_limited", `Yangi kodni ${wait} soniyadan keyin so'rash mumkin`, 429, wait);
  }
  if (!(await hit(`otp:phone:${phone}`, 5, 3600)) || !(await hit(`otp:ip:${ip}`, 30, 3600))) {
    throw new AuthError("rate_limited", "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.", 429);
  }

  const code = String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
  let sent;
  try {
    sent = await sendCode(phone, code, CODE_TTL_SECONDS, { skipTelegram: opts.viaSms });
  } catch {
    throw new AuthError("delivery_failed", "Kodni yuborib bo'lmadi. Birozdan keyin qayta urinib ko'ring.", 502);
  }

  await db.insert(loginCodes).values({
    phone,
    codeHash: hashCode(phone, code),
    channel: sent.channel,
    providerRequestId: sent.providerRequestId,
    expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
  });

  // The code is only ever shown on screen when no real delivery channel exists (local development)
  const devCode = isDevDelivery() && process.env.NODE_ENV !== "production" ? code : undefined;
  return { channel: sent.channel, resendIn: RESEND_SECONDS, devCode };
}

/** Checks the code, then signs the customer in (creating the account on first login). */
export async function verifyLoginCode(phone: string, code: string) {
  // Errors are returned from the transaction and thrown after it commits: throwing inside
  // would roll back the attempt counter and allow unlimited guessing.
  const result = await db.transaction(async (tx): Promise<{ customerId: number } | { error: AuthError }> => {
    const [row] = await tx
      .select()
      .from(loginCodes)
      .where(and(eq(loginCodes.phone, phone), isNull(loginCodes.consumedAt)))
      .orderBy(desc(loginCodes.createdAt))
      .limit(1)
      .for("update");

    if (!row || row.expiresAt <= new Date()) return { error: new AuthError("expired", "Kod muddati tugagan. Yangi kod so'rang.", 400) };
    if (row.attempts >= MAX_ATTEMPTS) {
      return { error: new AuthError("too_many_attempts", "Urinishlar soni tugadi. Yangi kod so'rang.", 429) };
    }

    const expected = Buffer.from(row.codeHash, "hex");
    const actual = Buffer.from(hashCode(phone, code), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await tx.update(loginCodes).set({ attempts: sql`${loginCodes.attempts} + 1` }).where(eq(loginCodes.id, row.id));
      const left = MAX_ATTEMPTS - row.attempts - 1;
      return {
        error: new AuthError(
          left > 0 ? "invalid_code" : "too_many_attempts",
          left > 0 ? `Kod noto'g'ri. Yana ${left} ta urinish qoldi.` : "Urinishlar soni tugadi. Yangi kod so'rang.",
          400,
        ),
      };
    }

    await tx.update(loginCodes).set({ consumedAt: new Date() }).where(eq(loginCodes.id, row.id));
    const [customer] = await tx
      .insert(customers)
      .values({ phone, lastLoginAt: new Date() })
      .onConflictDoUpdate({ target: customers.phone, set: { lastLoginAt: new Date() } })
      .returning({ id: customers.id });
    return { customerId: customer.id };
  });

  if ("error" in result) throw result.error;
  const { customerId } = result;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), customerId, expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return customerId;
}

/** The signed-in customer for this request, or null. Cached per request. */
export const getCurrentCustomer = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [row] = await db
    .select({ id: customers.id, phone: customers.phone })
    .from(sessions)
    .innerJoin(customers, eq(customers.id, sessions.customerId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  return row ?? null;
});

export async function logout() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  store.delete(SESSION_COOKIE);
}
