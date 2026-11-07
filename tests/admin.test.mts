// Admin panel safety checks. Requires `npm run dev` and a seeded DB. Mutates data (creates a test event's orders).
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import { createBoxOfficeOrder, cancelOrRefundOrder, checkInTicket, generateEventSeats } from "../src/lib/seating-admin";
import { generateHall } from "../src/lib/hall-builder";
import { hashPassword } from "../src/lib/admin/password";

const sql = postgres(process.env.DATABASE_URL!, { max: 2 });
const BASE = "http://localhost:3000";
const check = (name: string, ok: boolean, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);

// Two admins with known session tokens, created straight in the database
async function adminWithSession(email: string, role: string) {
  const [a] = await sql`
    insert into admins (email, name, password_hash, role) values (${email}, ${role}, ${await hashPassword(randomBytes(12).toString("hex"))}, ${role})
    on conflict (email) do update set role = excluded.role, active = true returning id`;
  const token = randomBytes(32).toString("base64url");
  await sql`insert into admin_sessions (token_hash, admin_id, expires_at) values (${createHash("sha256").update(token).digest("hex")}, ${a.id}, now() + interval '1 hour')`;
  return { id: a.id as number, cookie: `admin_sid=${token}` };
}
const owner = await adminWithSession("test-owner@example.uz", "owner");
const checker = await adminWithSession("test-checker@example.uz", "checker");

// --- Route permissions
check("export without session -> 403", (await fetch(`${BASE}/api/admin/export/orders`)).status === 403);
check("export as checker -> 403", (await fetch(`${BASE}/api/admin/export/orders`, { headers: { cookie: checker.cookie } })).status === 403);
const csv = await fetch(`${BASE}/api/admin/export/events`, { headers: { cookie: owner.cookie } });
// Read raw bytes: Response.text() silently drops the BOM that Excel needs
const csvBytes = Buffer.from(await csv.arrayBuffer());
check("export as owner -> CSV with BOM", csv.status === 200 && csvBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && csvBytes.toString("utf8").includes("Tadbir;Shahar"));
check("upload as checker -> 403", (await fetch(`${BASE}/api/admin/upload`, { method: "POST", headers: { cookie: checker.cookie }, body: new FormData() })).status === 403);

// --- A fresh event on the first venue, seats generated from its plan
const [venue] = await sql`select id, blocks from venues where blocks is not null order by id limit 1`;
const [org] = await sql`select id from organizers order by id limit 1`;
const [ev] = await sql`
  insert into events (slug, title, type, city, starts_at, venue_id, organizer_id, image_url, status)
  values (${`admin-test-${Date.now()}`}, 'Admin test', 'Test', 'Toshkent', now() + interval '1 day', ${venue.id}, ${org.id}, '/demo/poster-1.svg', 'published')
  returning id`;
const [cat] = await sql`insert into price_categories (event_id, name, price, color) values (${ev.id}, 'Std', 50000, '#ff0000') returning id`;
const plan = generateHall(venue.blocks);
const mapping = Object.fromEntries(plan.seats.map((s) => [s.blockId, cat.id]));
const created = await generateEventSeats(ev.id, plan, mapping);
check("seats generated from venue plan", created === plan.seats.length && created > 0, `${created}`);

const seats = await sql`select id from event_seats where event_id = ${ev.id} order by id limit 8`;
const ids = seats.map((s) => s.id as number);

// --- Box office: two cashiers sell the same seats at once, exactly one succeeds
const race = await Promise.allSettled([
  createBoxOfficeOrder(ev.id, ids.slice(0, 2), { phone: "+998901111111", email: null, comment: null }, owner.id),
  createBoxOfficeOrder(ev.id, ids.slice(0, 2), { phone: "+998902222222", email: null, comment: null }, owner.id),
]);
const won = race.filter((r) => r.status === "fulfilled");
check("box office race: exactly one sale", won.length === 1);
const order = (won[0] as PromiseFulfilledResult<{ id: string }>).value;

let regen = false;
try {
  await generateEventSeats(ev.id, plan, mapping);
} catch {
  regen = true;
}
check("seat regeneration refused once sold", regen);

// --- Check-in: two scanners on the same ticket at once, exactly one lets them in
const [ticket] = await sql`select ticket_code from order_items where order_id = ${order.id} limit 1`;
const scans = await Promise.all([checkInTicket(ticket.ticket_code, ev.id, checker.id), checkInTicket(ticket.ticket_code, ev.id, checker.id)]);
check("check-in race: exactly one entry", scans.filter((s) => s.ok).length === 1 && scans.some((s) => !s.ok && s.reason === "used"));
check("check-in for another event refused", !(await checkInTicket(ticket.ticket_code, ev.id + 100000, checker.id)).ok);

// --- Refund: seats back on sale, remaining ticket stops working
const [other] = await sql`select ticket_code from order_items where order_id = ${order.id} and checked_in_at is null limit 1`;
check("refund paid order", (await cancelOrRefundOrder(order.id)) === "refunded");
const [{ free }] = await sql`select count(*)::int as free from event_seats where id = any(${ids.slice(0, 2)}) and status = 'available'`;
check("refunded seats back on sale", free === 2);
const after = await checkInTicket(other.ticket_code, ev.id, checker.id);
check("refunded ticket refused at the door", !after.ok && after.reason === "not_paid");

await sql`delete from admin_sessions where admin_id in (${owner.id}, ${checker.id})`;
await sql.end();
process.exit(0);
