import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

// Reuse one pool across hot reloads in development; otherwise each edit leaks connections.
const globalForDb = globalThis as unknown as { db?: Db };

/**
 * The connection is opened on first use, not at import time: `next build` imports every
 * route to read its config, and the build machine (Netlify, Vercel, CI) has no database.
 */
function connect(): Db {
  if (globalForDb.db) return globalForDb.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const client = postgres(url, {
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idle_timeout: 30,
    connect_timeout: 10,
  });
  const instance = drizzle(client, { schema });
  globalForDb.db = instance;
  return instance;
}

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    const real = connect();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export { schema };
