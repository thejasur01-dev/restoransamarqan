# Chipta — tadbirlar afishasi va chipta sotish

Next.js 16 (App Router, Cache Components) + PostgreSQL + Drizzle ORM.

## Ishga tushirish (lokal)

```bash
npm install
cp .env.example .env.local
npm run db           # PostgreSQL 17 ni 127.0.0.1:5433 da ishga tushiradi (birinchi marta bazani yaratadi)
npm run db:migrate   # jadvallarni yaratadi
npm run db:seed      # demo tadbirlar (bazani tozalaydi!)
npm run dev          # http://localhost:3000
```

Bazani to'xtatish: `npm run db stop`.

## Tuzilma

| Yo'l | Vazifasi |
|---|---|
| `src/app/(site)/page.tsx` | Afisha: `?page=`, `?past=1`, `?q=` |
| `src/app/(site)/e/[slug]` | Tadbir sahifasi (to'g'ridan-to'g'ri havola) |
| `src/app/@modal/(.)e/[slug]` | Ro'yxatdan bosilganda ochiladigan modal (URL o'zgaradi, "orqaga" yopadi) |
| `src/app/api/events` | "Yana tadbirlar" tugmasi uchun JSON |
| `src/app/(checkout)/e/[slug]/buy` | Zal sxemasi, savat, 15 daqiqalik bron, buyurtma formasi |
| `src/app/api/events/[slug]/{seats,hold,order}` | O'rindiqlar holati, bron qilish/bo'shatish, buyurtma yaratish |
| `src/app/(site)/order/[id]` | Buyurtma holati sahifasi |
| `src/lib/seating.ts` | Bron, buyurtma va to'lovni tasdiqlash mantig'i (tranzaksiyalar bilan) |
| `src/lib/events.ts` | Ma'lumot so'rovlari (`"use cache"`, 1 daqiqalik kesh, `events` tegi) |
| `src/db/schema.ts` | Baza sxemasi: tadbirlar, joylar, o'rindiqlar, buyurtmalar |
| `src/lib/site.ts` | Brend nomi, shior, ijtimoiy tarmoqlar |

## Sxemani o'zgartirish

`src/db/schema.ts` ni tahrirlang → `npm run db:generate` → `npm run db:migrate`.

## Muhim qoidalar

- Narxlar butun so'mda (`integer`) saqlanadi.
- Vaqtlar bazada UTC, ekranda `Asia/Tashkent` bo'yicha ko'rsatiladi (`src/lib/format.ts`).
- O'rindiq holati: `available → held (savat, 15 daqiqa) → sold`. Muddati o'tgan `held` bo'sh hisoblanadi.

## Testlar

```bash
npm run db:seed && npm run dev   # alohida terminalda
npm run test:sales               # 30 ta xaridor bitta stol uchun poyga, limitlar, validatsiya
npm run test:payment             # to'lovni tasdiqlash: idempotentlik, muddati o'tgan bron, takroriy tranzaksiya
```

Testlar bazadagi ma'lumotni o'zgartiradi — faqat lokal bazada ishga tushiring.
