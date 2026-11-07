/**
 * Normalizes an Uzbek mobile number to "+998XXXXXXXXX".
 * Accepts "+998 90 123-45-67", "998901234567", "90 123 45 67". Returns null if it isn't one.
 */
export function normalizeUzPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 9) digits = `998${digits}`;
  if (!/^998\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

/** "+998901234567" -> "+998 90 123 45 67" */
export function formatUzPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 12) return phone;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}
