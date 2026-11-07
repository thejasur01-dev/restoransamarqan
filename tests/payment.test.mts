// Requires a seeded DB with at least one pending order (run tests/sale-api.test.mjs first). Mutates data.
import { markOrderPaid, SaleError } from "../src/lib/seating";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const run = Date.now().toString(36);
const TX = (n: number) => `TX-${run}-${n}`;
const check = (n: string, ok: boolean, x = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${n} ${x}`);

// A pending order whose seats are all still validly held for it
const [pending] = await sql`select o.id, o.hold_token from orders o where o.status='pending' and not exists (
  select 1 from order_items i join event_seats s on s.id = i.seat_id
  where i.order_id = o.id and not (s.status = 'held' and s.hold_token = o.hold_token and s.hold_expires_at > now()))
  order by o.number desc limit 1`;
if (!pending) { console.log('SKIP  no payable pending order: run tests/sale-api.test.mjs first'); process.exit(1); }
check("paid -> true", (await markOrderPaid(pending.id, "click", TX(1))) === true);
const seats = await sql`select s.status, s.order_id from order_items i join event_seats s on s.id=i.seat_id where i.order_id=${pending.id}`;
check("seats sold & linked", seats.every((s) => s.status === "sold" && s.order_id === pending.id), `${seats.length} seats`);
check("repeat same callback -> true (idempotent)", (await markOrderPaid(pending.id, "click", TX(1))) === true);
check("different txn for paid order -> false", (await markOrderPaid(pending.id, "click", TX(2))) === false);
const [o] = await sql`select status, payment_provider, provider_transaction_id from orders where id=${pending.id}`;
check("order marked paid", o.status === "paid" && o.provider_transaction_id === TX(1));

// An order whose hold ran out must not be paid: simulate by expiring the old pending order from the API test
const [other] = await sql`select o.id, o.hold_token from orders o where o.status='pending' order by number limit 1`;
if (other) {
  await sql`update event_seats set hold_expires_at = now() - interval '1 minute' where hold_token = ${other.hold_token} and status='held'`;
  let threw = false;
  try { await markOrderPaid(other.id, "click", TX(3)); } catch (e) { threw = e instanceof SaleError && e.code === "expired"; }
  check("expired hold -> payment refused", threw);
  const [o2] = await sql`select status from orders where id=${other.id}`;
  check("expired order not marked paid", o2.status === "pending");
}
const [usedTx] = await sql`select provider_transaction_id from orders where status = 'paid' and id <> ${pending.id} limit 1`;
if (usedTx) {
  await sql`update orders set status = 'pending' where id = ${pending.id}`; // reuse as a fresh pending order
  check("txn id already used by another order -> false", (await markOrderPaid(pending.id, "click", usedTx.provider_transaction_id)) === false);
  await sql`update orders set status = 'paid' where id = ${pending.id}`;
}
check("unknown order -> false", (await markOrderPaid("00000000-0000-0000-0000-000000000000", "click", TX(4))) === false);
await sql.end();
process.exit(0);
