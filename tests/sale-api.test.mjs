// Requires: `npm run dev` running and a freshly seeded DB (`npm run db:seed`). Mutates data.
const BASE = "http://localhost:3000/api/events/5-musiqiy-loto-namangan";
const uuid = () => crypto.randomUUID();
const req = (path, token, body, headers = {}) =>
  fetch(BASE + path, {
    method: body ? "POST" : "GET",
    headers: { ...(token ? { cookie: `cart=${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
const check = (name, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);

let map = await (await req("/seats")).json();
const free = map.seats.filter((s) => s.state === "free" && s.section === "Stollar");
const groups = [...new Set(free.map((s) => s.group))];
console.log("free tables:", groups.length);
const target = free.find((s) => s.group === groups[0]);

// 1) 30 buyers race for the same table
const tokens = Array.from({ length: 30 }, uuid);
const results = await Promise.all(tokens.map((t) => req("/hold", t, { seatId: target.id, action: "add" }).then((r) => r.status)));
const winners = results.filter((s) => s === 200).length;
check("race: exactly one winner", winners === 1, JSON.stringify(results.reduce((a, s) => ((a[s] = (a[s] || 0) + 1), a), {})));
const winner = tokens[results.indexOf(200)];

// 2) winner sees the whole table as theirs, others see it taken
const wMap = await (await req("/seats", winner)).json();
const mine = wMap.seats.filter((s) => s.state === "mine");
check("winner holds whole table (4 seats)", mine.length === 4 && mine.every((s) => s.group === target.group));
check("cart deadline ~15 min", wMap.cartExpiresAt && Math.abs(new Date(wMap.cartExpiresAt) - wMap.serverNow - 15 * 60e3) < 5000);
const oMap = await (await req("/seats", tokens.find((t) => t !== winner))).json();
check("others see it taken", oMap.seats.filter((s) => s.group === target.group).every((s) => s.state === "taken"));

// 3) seat limit: 20 per order (5 tables). Winner already has 1 table.
const statuses = [];
for (const g of groups.slice(1, 6)) statuses.push((await req("/hold", winner, { seatId: free.find((s) => s.group === g).id, action: "add" })).status);
check("limit: 5th table ok, 6th rejected", statuses.slice(0, 4).every((s) => s === 200) && statuses[4] === 422, JSON.stringify(statuses));

// 4) release returns the table to everyone
await req("/hold", winner, { seatId: target.id, action: "remove" });
const other = tokens.find((t) => t !== winner);
check("released table can be taken by another buyer", (await req("/hold", other, { seatId: target.id, action: "add" })).status === 200);

// 5) order validation & creation
const good = { email: "Test@Example.uz", phone: "90 123 45 67", comment: "", acceptRules: true };
check("bad phone -> 400", (await req("/order", winner, { ...good, phone: "12345" })).status === 400);
check("bad email -> 400", (await req("/order", winner, { ...good, email: "x@" })).status === 400);
check("rules not accepted -> 400", (await req("/order", winner, { ...good, acceptRules: false })).status === 400);
check("no cart cookie -> 409", (await req("/order", null, good)).status === 409);
check("empty cart -> 409", (await req("/order", uuid(), good)).status === 409);
check("form post (non-JSON) -> 415", (await fetch(BASE + "/order", { method: "POST", headers: { cookie: `cart=${winner}`, "content-type": "application/x-www-form-urlencoded" }, body: "a=1" })).status === 415);
const ord = await req("/order", winner, good);
const ordBody = await ord.json();
check("order created -> 201", ord.status === 201 && ordBody.orderId, JSON.stringify(ordBody));
const ord2 = await (await req("/order", winner, good)).json();
console.log("orders:", ordBody.orderId, ord2.orderId);

// 6) garbage input
check("invalid seat id -> 400", (await req("/hold", winner, { seatId: "1; drop table", action: "add" })).status === 400);
check("unknown seat -> 404", (await req("/hold", winner, { seatId: 999999, action: "add" })).status === 404);
check("unknown event -> 404", (await fetch("http://localhost:3000/api/events/nope/seats")).status === 404);
