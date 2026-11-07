/**
 * The 9-digit local number from whatever was typed. People often type the country code
 * themselves ("+998 93 ..."); once more than 9 digits are present a leading 998 is dropped.
 * A local number alone never exceeds 9 digits, so numbers starting with 99 8.. stay intact.
 */
export function localPhoneDigits(raw: string) {
  const d = raw.replace(/\D/g, "").slice(0, 12);
  return d.length > 9 && d.startsWith("998") ? d.slice(3) : d.slice(0, 9);
}

/** "901234567" -> "90 123 45 67" */
export function formatLocalPhone(local: string) {
  return [local.slice(0, 2), local.slice(2, 5), local.slice(5, 7), local.slice(7, 9)].filter(Boolean).join(" ");
}
