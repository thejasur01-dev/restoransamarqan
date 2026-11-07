// Brand-level settings. Change the name/logo text here once the brand is final.
export const site = {
  name: "Chipta",
  tagline: ["Tashkilotchilardan chiptalar", "shahringizdagi tadbirlarga"],
  listTitle: "Tadbirlar afishasi",
  pastTitle: "O'tgan tadbirlar",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  timeZone: "Asia/Tashkent",
  locale: "uz-Latn-UZ",
  pageSize: 9,
  legalUrl: "/rules",
  registerUrl: "/register",
  features: {
    // Phone + one-time-code accounts with a "My tickets" cabinet. Off for now, like the
    // reference site; turn on once SMS (Eskiz contract) or a Telegram bot is available.
    phoneLogin: false,
  },
  socials: {
    telegram: "https://t.me/",
    instagram: "https://instagram.com/",
  },
} as const;
