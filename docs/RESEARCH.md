# bitva.qtickets.ru — tahlil (2026-11-07)

Tadbir afishasi + bilet sotish sayti. Bitta tashkilotchi ("Битва") — "Музыкальное лото: Шабаш" o'yinlari turli shaharlarda.

## Sahifalar va URL'lar
| URL | Vazifasi |
|---|---|
| `/` | Kelayotgan tadbirlar ro'yxati (9 tadan) |
| `/?page=2` | Keyingi sahifa ("Ещё мероприятия!" tugmasi AJAX bilan qo'shadi) |
| `/?past=1` | O'tgan tadbirlar (shu karta, statussiz) |
| `/?q=...` | Qidiruv (nom / shahar bo'yicha) |
| karta bosilganda | Modal oyna: tadbir tafsilotlari (AJAX `onLoadEvent`) |
| `/event/{id}` | Bilet sotib olish vidjeti (zal sxemasi + checkout) |

## Dizayn tokenlari
- Shrift: **Roboto** 300/400/500 (body 16px/300)
- Fon: `#F2F2F2`; kartalar oq, soya `3px 5px 10px rgba(0,0,0,.15)`, burchaklar to'g'ri (radius 0)
- Asosiy (teal): `#009589`; ochiq firuza: `#3BD9CC`; qizil: `#EA5454`
- Matn: sarlavha `#333232`, ikkilamchi `#5D5D5D`
- Kontent kengligi: 1160px, 3 ustunli grid (karta ~357px, oraliq ~40px)
- Header: 182px, to'q yashil fon rasmi (konsert olomoni) + teal overlay
- Footer: deyarli qora-yashil `#0C1A18`

## Komponentlar
**Header:** logo (chap) · shior "Билеты от организаторов / на мероприятия в вашем городе" · qidiruv input + lupa (o'ng, shaffof teal). Mobil: logo markazda, qidiruv to'liq kenglikda.

**H1:** "Афиша мероприятий Битва" (36px/500).

**Tadbir kartasi:**
- Rasm 200px balandlik (background-image, 1x/2x/3x webp)
- Rasm pastki o'ng burchagida yorliqlar: `Сегодня` (qizil, qiyshiq kesik) + `от 800 руб.` (firuza)
- H2 nom (21px/500) · tur "Встреча" (18px/300) · nuqtali ajratgich · sana 13px · joy nomi
- Hover: rasm qorayadi, markazda qizil "Купить билет" (yoki "Билеты проданы"), sarlavha firuza rangga o'tadi
- Mobil: 1 ustun, sana | joy bir qatorda, pastda katta tugma "Купить от X руб." (teal) yoki "Билеты проданы" (kulrang)

**"Ещё мероприятия!"** — markazdagi kulrang tugma, ichida loader. **"Прошедшие мероприятия"** — chapda pastki chiziqli havola.

**Tadbir modali** (oq, 1160px, X yopish tugmasi teal):
1. Katta sarlavha (≈56px) → nuqtali chiziq
2. Qator: "сегодня 7 ноября, 19:00" (qalin) · joy nomi (kulrang) · yosh cheklovi "18+" (o'ngda)
3. Afisha rasmi (~565px) + tavsif matni (paragraflar)
4. Nuqtali chiziq → "Купить от 800 руб." (teal tugma) + VK ikonkasi "Официальная страница" havolasi
5. Joy nomi (H) + manzil → Yandex xarita (marker)
6. Tashkilotchi rekvizitlari: ism, INN, OGRN, telefon, email (mayda matn)

**Footer:** logo · 3 ustun nuqtali ajratgichlar bilan: (1) © yil, foydalanish qoidalari, VK/Telegram; (2) "Принимаем к оплате" — to'lov logolari; (3) "Регистрируйтесь и продавайте билеты" + teal tugma.

## Bilet sotib olish oqimi (`/event/{id}`)
1. Header: tadbir nomi, sana (hafta kuni) • joy
2. Narx filtri chiplari (rangli nuqta + narx)
3. **Zal sxemasi** (canvas/SVG): raqamli stollar, atrofida o'rindiq nuqtalari; bo'sh = rangli, band = kulrang; bar, "Сцена"; zoom +/−
4. O'rindiq bosilsa — butun stol tanlanadi ("Эти билеты можно купить только вместе"), pastda savat paneli: "1 ряд, 3 место / 800 руб. / Столы" kartalari + jami + "Купить ⏱ 14:59" (15 daqiqa bron)
5. Toast: "🔥 Осталось 2 билета"
6. "Всё правильно?" — tasdiqlash + promokod
7. "Оформление заказа": Email, Телефон, Комментарий, "Отмечаете день рождения?", to'lov usuli (СБП QR / Bank kartasi) → "Оплатить"
8. Pastki qator: Помощь · powered by · "У меня есть промокод"

## Tadbir ma'lumot modeli (taxminiy)
`id, title, city, type ("Встреча"), starts_at, venue{name,address,lat,lng}, age_limit, image, description, min_price, status (on_sale|sold_out|past), official_url, organizer{name,inn,ogrn,phone,email}, seating_map{tables[{no, seats[{row,place,price_category,status}]}]}`
