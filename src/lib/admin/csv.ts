/**
 * CSV for Excel in Uzbek/Russian locales: semicolon separator and a UTF-8 BOM so
 * Cyrillic and o'zbek letters open correctly. Cells that start with = + - @ are prefixed
 * with ' so a crafted name or comment can't run as a spreadsheet formula.
 */
export function toCsv(header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    let s = v.replace(/\r?\n/g, " ");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...rows].map((r) => r.map(cell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, body: string) {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
