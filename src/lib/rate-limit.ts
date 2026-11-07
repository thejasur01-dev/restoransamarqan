import "server-only";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * Fixed-window counter stored in Postgres, so every app instance shares the same limits.
 * Returns true when this call is still within `limit` for the current window.
 */
export async function hit(key: string, limit: number, windowSeconds: number) {
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`);

  // Occasional cleanup instead of a cron job
  if (Math.random() < 0.01) {
    await db.execute(sql`delete from rate_limits where window_start < now() - interval '1 day'`);
  }
  return Number(rows[0].count) <= limit;
}

/**
 * Client IP as reported by the reverse proxy. In production the proxy (nginx, load balancer)
 * MUST overwrite X-Forwarded-For / X-Real-IP, otherwise clients could spoof it.
 * Mobile operators put many users behind one IP, so per-IP limits must stay generous.
 */
export async function clientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
