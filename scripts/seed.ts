/**
 * Fills the database with demo data. Destructive: wipes all tables first.
 * Run with `npm run db:seed` while the database is up.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/db/schema";

if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed a production database");

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client, { schema });

const POSTERS = [
  { from: "#2b0f3a", to: "#7a1f5c", accent: "#ffd166", title: "MUSIQIY", sub: "loto" },
  { from: "#0b2545", to: "#13315c", accent: "#8ecae6", title: "JAZZ", sub: "kechasi" },
  { from: "#1b1b1b", to: "#3d0c11", accent: "#ff4d4d", title: "STAND-UP", sub: "jonli efir" },
  { from: "#003d33", to: "#00695c", accent: "#b2fef7", title: "QUIZ", sub: "bilimlar jangi" },
  { from: "#3a0ca3", to: "#7209b7", accent: "#f72585", title: "KARAOKE", sub: "battle" },
  { from: "#432818", to: "#99582a", accent: "#ffe6a7", title: "AKUSTIKA", sub: "kechasi" },
];

function writePosters() {
  const dir = join(process.cwd(), "public", "demo");
  mkdirSync(dir, { recursive: true });
  POSTERS.forEach((p, i) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="600" viewBox="0 0 1080 600">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.from}"/><stop offset="1" stop-color="${p.to}"/></linearGradient>
<radialGradient id="l" cx="0.8" cy="0.2" r="0.6"><stop offset="0" stop-color="${p.accent}" stop-opacity="0.35"/><stop offset="1" stop-color="${p.accent}" stop-opacity="0"/></radialGradient></defs>
<rect width="1080" height="600" fill="url(#g)"/><rect width="1080" height="600" fill="url(#l)"/>
<g fill="${p.accent}" opacity="0.5">${Array.from({ length: 24 }, (_, k) => `<circle cx="${(k * 137) % 1080}" cy="${(k * 89) % 600}" r="${2 + (k % 4)}"/>`).join("")}</g>
<text x="70" y="300" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="128" fill="#fff" letter-spacing="-4">${p.title}</text>
<text x="80" y="400" font-family="Georgia, serif" font-style="italic" font-size="92" fill="${p.accent}">${p.sub}</text>
</svg>`;
    writeFileSync(join(dir, `poster-${i + 1}.svg`), svg);
  });
}

const CITIES = [
  { city: "Toshkent", venue: "Navo Lounge", address: "Amir Temur ko'chasi, 15", lat: 41.3111, lng: 69.2797 },
  { city: "Toshkent", venue: "Bar Ritm", address: "Shota Rustaveli ko'chasi, 41", lat: 41.2885, lng: 69.2617 },
  { city: "Samarqand", venue: "Registon Hall", address: "Universitet xiyoboni, 9", lat: 39.6542, lng: 66.9597 },
  { city: "Buxoro", venue: "Labi Hovuz Cafe", address: "Bahouddin Naqshband ko'chasi, 2", lat: 39.7747, lng: 64.4286 },
  { city: "Namangan", venue: "Grand Lounge", address: "Navoiy ko'chasi, 27", lat: 41.0011, lng: 71.6683 },
  { city: "Farg'ona", venue: "Club 54", address: "Mustaqillik ko'chasi, 54", lat: 40.3864, lng: 71.7864 },
  { city: "Andijon", venue: "Bobur Hall", address: "Bobur shoh ko'chasi, 8", lat: 40.7821, lng: 72.3442 },
  { city: "Nukus", venue: "Amu Lounge", address: "Doslik guzari, 3", lat: 42.4619, lng: 59.6166 },
];

const SHOWS = [
  { name: "Musiqiy loto", poster: 1, type: "Uchrashuv", age: 18 },
  { name: "Jazz kechasi", poster: 2, type: "Konsert", age: 16 },
  { name: "Stand-up kechasi", poster: 3, type: "Shou", age: 18 },
  { name: "Quiz: Bilimlar jangi", poster: 4, type: "O'yin", age: 16 },
  { name: "Karaoke battle", poster: 5, type: "Uchrashuv", age: 18 },
  { name: "Akustik kecha", poster: 6, type: "Konsert", age: 12 },
];

const DESCRIPTION = `Har bir ishtirokchiga qo'shiqlar ro'yxati yozilgan katta blank beriladi — eshitgan qo'shiqlaringizni belgilab borasiz.

Birinchi bo'lib qatorni to'ldirgan ishtirokchi hamkorlarimizdan sovg'alarni yutib oladi!

Kech davomida uchta o'yin o'tkaziladi va har birida g'olib aniqlanadi.

*Diqqat: siz stol uchun bron to'laysiz, stoldagi ishtirokchilar soni kamaysa ham narx o'zgarmaydi.

O'yin kuni bron qaytarilmaydi, lekin to'lovni boshqa o'yinga o'tkazish mumkin.`;

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/['ʻʼ`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Two columns of 4-seat tables plus a bar counter, roughly like a lounge floor plan */
function buildHall() {
  const shapes: schema.HallLayout["shapes"] = [];
  const seats: Array<{ section: string; row: string; place: string; groupKey: string; x: number; y: number; cat: 0 | 1 }> = [];
  let tableNo = 0;
  for (const colX of [120, 360]) {
    for (let r = 0; r < 6; r++) {
      tableNo++;
      const x = colX;
      const y = 110 + r * 110;
      shapes.push({ kind: "table", x: x - 30, y: y - 18, w: 60, h: 36, label: String(tableNo) });
      const pos = [
        [x - 18, y - 34],
        [x + 18, y - 34],
        [x - 18, y + 34],
        [x + 18, y + 34],
      ];
      pos.forEach(([sx, sy], i) =>
        seats.push({ section: "Stollar", row: String(tableNo), place: String(i + 1), groupKey: `t${tableNo}`, x: sx, y: sy, cat: 0 }),
      );
    }
  }
  shapes.push({ kind: "bar", x: 560, y: 260, w: 60, h: 300 });
  for (let i = 0; i < 8; i++) {
    seats.push({ section: "Bar", row: "1", place: String(i + 1), groupKey: `b${i + 1}`, x: 530, y: 280 + i * 36, cat: 1 });
  }
  shapes.push({ kind: "stage", x: 160, y: 800, w: 300, label: "Sahna" });
  return { layout: { width: 680, height: 860, shapes } satisfies schema.HallLayout, seats };
}

async function main() {
  writePosters();

  await db.execute(
    sql`truncate table order_items, orders, event_seats, price_categories, events, venues, organizers restart identity cascade`,
  );

  const [org] = await db
    .insert(schema.organizers)
    .values({
      name: "Demo Events",
      legalName: "YaTT Demo Tashkilotchi",
      inn: "123456789",
      phone: "+998 90 123 45 67",
      email: "info@example.uz",
    })
    .returning();

  const hall = buildHall();
  const venueRows = await db
    .insert(schema.venues)
    .values(CITIES.map((c) => ({ name: c.venue, city: c.city, address: c.address, lat: c.lat, lng: c.lng, layout: hall.layout })))
    .returning();

  // Anchor dates to Tashkent midnight so "today" events exist whenever the seed runs
  const now = new Date();
  const tashkentMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (now.getUTCHours() >= 19 ? 1 : 0)) - 5 * 3600_000,
  );

  const plan: Array<{ dayOffset: number; hour: number; venueIdx: number; showIdx: number; sold: "none" | "some" | "all" }> = [];
  // 4 events today, then a spread over the next weeks, then 8 past events
  [19, 20, 21, 22].forEach((hour, i) => plan.push({ dayOffset: 0, hour, venueIdx: i, showIdx: 0, sold: i === 0 ? "all" : "some" }));
  for (let i = 0; i < 20; i++) {
    plan.push({ dayOffset: 1 + Math.floor(i / 3), hour: 18 + (i % 3), venueIdx: (i + 4) % CITIES.length, showIdx: i % SHOWS.length, sold: i % 7 === 3 ? "all" : i % 2 ? "some" : "none" });
  }
  for (let i = 0; i < 8; i++) {
    plan.push({ dayOffset: -1 - i, hour: 19, venueIdx: i % CITIES.length, showIdx: i % SHOWS.length, sold: "some" });
  }

  let n = 0;
  for (const p of plan) {
    n++;
    const show = SHOWS[p.showIdx];
    const place = CITIES[p.venueIdx];
    const venue = venueRows[p.venueIdx];
    const startsAt = new Date(tashkentMidnight.getTime() + p.dayOffset * 86400_000 + p.hour * 3600_000);
    const title = `${show.name} (${place.city}, "${place.venue}")`;

    const [event] = await db
      .insert(schema.events)
      .values({
        slug: `${n}-${slugify(`${show.name} ${place.city}`)}`,
        title,
        type: show.type,
        city: place.city,
        startsAt,
        venueId: venue.id,
        organizerId: org.id,
        ageLimit: show.age,
        imageUrl: `/demo/poster-${show.poster}.svg`,
        description: DESCRIPTION,
        officialUrl: "https://t.me/example",
        status: "published",
      })
      .returning();

    const cats = await db
      .insert(schema.priceCategories)
      .values([
        { eventId: event.id, name: "Stol", price: 120_000 + (n % 3) * 30_000, color: "#e00d0d" },
        { eventId: event.id, name: "Bar oldida", price: 100_000, color: "#d4d400" },
      ])
      .returning();

    await db.insert(schema.eventSeats).values(
      hall.seats.map((s) => {
        // Decide per group: a table is either fully sold or fully free
        const groupNo = Number(s.groupKey.slice(1)) + (s.groupKey[0] === "b" ? 100 : 0);
        let status: "available" | "sold" = "available";
        if (p.sold === "all") status = "sold";
        else if (p.sold === "some" && (groupNo * 7 + n) % 3 !== 0) status = "sold";
        return {
          eventId: event.id,
          priceCategoryId: cats[s.cat].id,
          section: s.section,
          row: s.row,
          place: s.place,
          groupKey: s.groupKey,
          x: s.x,
          y: s.y,
          status,
        };
      }),
    );
  }

  console.log(`Seeded ${plan.length} events in ${CITIES.length} venues.`);
}

main()
  .then(() => client.end())
  .catch(async (e) => {
    console.error(e);
    await client.end();
    process.exit(1);
  });
