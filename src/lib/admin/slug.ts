// Cyrillic and Uzbek Latin to plain ASCII for URLs: "Musiqiy loto (Farg'ona)" -> "musiqiy-loto-fargona"
const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "", ы: "i", ь: "",
  э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

export function slugify(text: string) {
  const s = text
    .toLowerCase()
    .split("")
    .map((ch) => CYR[ch] ?? ch)
    .join("")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['ʻʼ‘’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return s || "tadbir";
}

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
