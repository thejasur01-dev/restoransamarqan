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
| `src/app/(site)/order/[id]` | Buyurtma holati, to'langanda QR-kodli chiptalar |
| `src/app/(site)/my` | «Mening chiptalarim» kabineti (telefon + kod bilan kirish) |
| `src/lib/auth.ts`, `src/lib/otp-providers.ts` | Kirish kodlari (Telegram Gateway → Eskiz SMS), sessiyalar |
| `src/lib/rate-limit.ts` | So'rovlar cheklovi (Postgres'da, barcha serverlar uchun umumiy) |
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
npm run test:auth                # kod yuborish/tekshirish, urinishlar limiti, sessiya
npm run test:sales               # 30 ta xaridor bitta stol uchun poyga, limitlar, validatsiya
npm run test:payment             # to'lovni tasdiqlash: idempotentlik, muddati o'tgan bron, takroriy tranzaksiya
```

Testlar bazadagi ma'lumotni o'zgartiradi — faqat lokal bazada ishga tushiring.

## Kirish kodlari (Telegram / SMS)

Mijoz parolsiz, telefon raqami va bir martalik kod bilan kiradi. Kod avval Telegram orqali yuboriladi, bo'lmasa SMS orqali.

- **Telegram Gateway** — https://gateway.telegram.org da akkaunt oching, balansni to'ldiring, tokenni  ga yozing. Narx: ~/usr/bin/bash.01 / yetkazilgan kod.
- **Eskiz SMS** — https://eskiz.uz da ro'yxatdan o'ting, ,  ni yozing. SMS matni Eskiz kabinetida **shablon sifatida tasdiqlangan bo'lishi shart** —  aynan shu shablonga mos kelsin.
- Hech biri sozlanmagan bo'lsa: lokal muhitda kod ekranda ko'rsatiladi, production'da kod yuborilmaydi.
- Production'da  uzun tasodifiy qiymat bo'lishi shart (aks holda server xato beradi).
- Server orqasidagi proxy (nginx)  sarlavhasini o'zi yozishi kerak — so'rovlar cheklovi shunga tayanadi.
