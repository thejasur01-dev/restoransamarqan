// Requires: `npm run dev` running with no SMS/Telegram configured (dev mode returns codes). Mutates data.
const BASE = "http://localhost:3000";
const check = (name, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${extra}`);
const post = (path, body, headers = {}) =>
  fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const randomPhone = () => `+99890${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

// Phone login is behind site.features.phoneLogin; when off, its endpoints and page must be closed
if ((await post("/api/auth/code", { phone: "+998901234567" })).status === 404) {
  check("login off: code API closed", true);
  check("login off: verify API closed", (await post("/api/auth/verify", { phone: "+998901234567", code: "123456" })).status === 404);
  check("login off: /my is 404", (await (await fetch(BASE + "/my")).text()).includes("Sahifa topilmadi"));
  check("login off: no header link", !(await (await fetch(BASE + "/")).text()).includes('href="/my"'));
  process.exit(0);
}

// Phone validation
check("garbage phone -> 400", (await post("/api/auth/code", { phone: "12345" })).status === 400);
check("non-JSON -> 415", (await fetch(BASE + "/api/auth/code", { method: "POST", body: "phone=1" })).status === 415);

// Code request + resend cooldown
const phone = randomPhone();
const first = await post("/api/auth/code", { phone: phone.replace("+998", "") });
const firstBody = await first.json();
check("code sent (local number accepted)", first.status === 200 && /^\d{6}$/.test(firstBody.devCode ?? ""), JSON.stringify(firstBody));
const again = await post("/api/auth/code", { phone });
const againBody = await again.json();
check("immediate resend -> 429 with wait time", again.status === 429 && againBody.retryAfter > 0, JSON.stringify(againBody));

// Wrong codes are limited to 5 attempts, after which even the right code is refused
const wrong = firstBody.devCode === "000000" ? "111111" : "000000";
const statuses = [];
for (let i = 0; i < 5; i++) statuses.push((await post("/api/auth/verify", { phone, code: wrong })).status);
check("5 wrong attempts rejected", statuses.every((s) => s === 400), JSON.stringify(statuses));
const locked = await post("/api/auth/verify", { phone, code: firstBody.devCode });
check("right code after lockout -> 429", locked.status === 429);

// Happy path on a fresh number
const phone2 = randomPhone();
const { devCode } = await (await post("/api/auth/code", { phone: phone2 })).json();
const ok = await post("/api/auth/verify", { phone: phone2, code: devCode });
const sid = ok.headers.getSetCookie().find((c) => c.startsWith("sid="));
check("correct code -> session cookie", ok.status === 200 && !!sid && /HttpOnly/i.test(sid) && /SameSite=Lax/i.test(sid));
check("code can't be reused", (await post("/api/auth/verify", { phone: phone2, code: devCode })).status === 400);

const cookie = sid.split(";")[0];
const cabinet = await (await fetch(BASE + "/my", { headers: { cookie } })).text();
check("cabinet shows the signed-in phone", cabinet.includes(phone2.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4")));
const anon = await (await fetch(BASE + "/my")).text();
check("cabinet without session shows login", anon.includes("Kod olish") && !anon.includes(phone2));

await post("/api/auth/logout", {}, { cookie });
const afterLogout = await (await fetch(BASE + "/my", { headers: { cookie } })).text();
check("logout kills the session", !afterLogout.includes("Chiqish") && afterLogout.includes("Kod olish"));
