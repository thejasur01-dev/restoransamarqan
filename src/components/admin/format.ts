const TZ = "Asia/Tashkent";

export const money = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export function dateTime(d: Date | string | null) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

export function dateOnly(d: Date | string) {
  return new Intl.DateTimeFormat("ru-RU", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(d));
}

/** Value for <input type="datetime-local"> in Tashkent time */
export function toLocalInput(d: Date | string | null) {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date(d))
    .reduce<Record<string, string>>((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** "2026-11-08T19:00" typed in Tashkent -> Date (Tashkent is UTC+5 all year, no DST) */
export function fromLocalInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const ORDER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "To'lov kutilmoqda", cls: "a-badge-amber" },
  paid: { label: "To'langan", cls: "a-badge-green" },
  cancelled: { label: "Bekor qilingan", cls: "" },
  expired: { label: "Muddati o'tgan", cls: "" },
  refunded: { label: "Qaytarilgan", cls: "a-badge-red" },
};

export const EVENT_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Qoralama", cls: "" },
  published: { label: "E'lon qilingan", cls: "a-badge-green" },
  cancelled: { label: "Bekor qilingan", cls: "a-badge-red" },
};
