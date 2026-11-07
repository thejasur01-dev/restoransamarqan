/**
 * Checks the Eskiz connection by sending Eskiz's own test text (allowed in test mode).
 *   npm run sms:test -- 901234567
 * Needs ESKIZ_EMAIL and ESKIZ_PASSWORD in .env.local.
 */
const phone = (process.argv[2] ?? "").replace(/\D/g, "").replace(/^(?=\d{9}$)/, "998");
if (!/^998\d{9}$/.test(phone)) {
  console.error("Telefon raqamini kiriting: npm run sms:test -- 901234567");
  process.exit(1);
}
if (!process.env.ESKIZ_EMAIL || !process.env.ESKIZ_PASSWORD) {
  console.error(".env.local faylida ESKIZ_EMAIL va ESKIZ_PASSWORD to'ldirilmagan");
  process.exit(1);
}

const login = new FormData();
login.set("email", process.env.ESKIZ_EMAIL);
login.set("password", process.env.ESKIZ_PASSWORD);
const auth = await fetch("https://notify.eskiz.uz/api/auth/login", { method: "POST", body: login });
const authBody = await auth.json().catch(() => ({}));
const token = authBody?.data?.token;
if (!token) {
  console.error(`Kirish muvaffaqiyatsiz (HTTP ${auth.status}):`, JSON.stringify(authBody));
  console.error("Email/parolni tekshiring. Parol — Eskiz kabinetidagi API (SMS shlyuz) uchun berilgan maxfiy kod bo'lishi mumkin.");
  process.exit(1);
}
console.log("Eskiz: kirish OK");

const sms = new FormData();
sms.set("mobile_phone", phone);
sms.set("message", "Bu Eskiz dan test");
sms.set("from", process.env.ESKIZ_FROM || "4546");
const res = await fetch("https://notify.eskiz.uz/api/message/sms/send", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: sms });
const body = await res.json().catch(() => ({}));
console.log(`Yuborish: HTTP ${res.status}`, JSON.stringify(body));
console.log(res.ok && body.id ? `SMS navbatga qo'yildi. +${phone} telefoningizni tekshiring.` : "SMS yuborilmadi — javobni yuqorida ko'ring.");
