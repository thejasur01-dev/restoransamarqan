import { site } from "./site";

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];
const WEEKDAYS = ["yak", "dush", "sesh", "chor", "pay", "jum", "shan"];

// Wall-clock parts of a moment in Tashkent, independent of the server's own time zone.
function tashkentParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: site.timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value;
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    time: `${get("hour")}:${get("minute")}`,
    weekday: WEEKDAYS[weekdayIndex],
  };
}

export function isSameTashkentDay(a: Date, b: Date) {
  const x = tashkentParts(a);
  const y = tashkentParts(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/** "7-noyabr, 19:00" */
export function formatEventDate(date: Date) {
  const p = tashkentParts(date);
  return `${p.day}-${MONTHS[p.month - 1]}, ${p.time}`;
}

/** "7-noyabr 19:00 (shan)" — used in the ticket purchase header */
export function formatEventDateWithWeekday(date: Date) {
  const p = tashkentParts(date);
  return `${p.day}-${MONTHS[p.month - 1]} ${p.time} (${p.weekday})`;
}

/** "120 000 so'm" with a non-breaking thin grouping so the amount never wraps */
export function formatPrice(amount: number) {
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} so'm`;
}

/** "800 000 so'mdan" — Uzbek attaches the "from" suffix directly to the currency */
export function formatPriceFrom(amount: number) {
  return `${formatPrice(amount)}dan`;
}
