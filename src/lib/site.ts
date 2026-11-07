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
  socials: {
    telegram: "https://t.me/",
    instagram: "https://instagram.com/",
  },
} as const;
