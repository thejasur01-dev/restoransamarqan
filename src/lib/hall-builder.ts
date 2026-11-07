import type { HallBlock, HallLayout } from "@/db/schema";

/**
 * Turns hall builder blocks into a drawable plan and a list of seats.
 * Pure and deterministic: the admin preview and the server produce identical results.
 */

export type TemplateSeat = { blockId: string; section: string; row: string; place: string; group: string; x: number; y: number };

const TABLE_W = 60;
const TABLE_H = 36;
const MARGIN = 40;

/** Seat offsets around one table, by seat count */
function tableSeatOffsets(n: 2 | 4 | 6 | 8): Array<[number, number]> {
  const top = -TABLE_H / 2 - 16;
  const bottom = TABLE_H / 2 + 16;
  const cols = n === 2 ? [0] : n <= 4 ? [-15, 15] : n === 6 ? [-20, 0, 20] : [-24, -8, 8, 24];
  if (n === 2) return [[0, top], [0, bottom]];
  return [...cols.map((c) => [c, top] as [number, number]), ...cols.map((c) => [c, bottom] as [number, number])];
}

export function blockFootprint(b: HallBlock): { w: number; h: number } {
  switch (b.kind) {
    case "tables":
      return { w: (b.cols - 1) * b.gapX + TABLE_W + 20, h: (b.rows - 1) * b.gapY + TABLE_H + 64 };
    case "rows":
      return { w: (b.seatsPerRow - 1) * b.spacing + 30, h: (b.rows - 1) * b.rowGap + 30 };
    case "bar":
      return { w: 110, h: (b.seats - 1) * b.spacing + 40 };
    case "stage":
      return { w: b.width, h: 60 };
  }
}

export function generateHall(blocks: HallBlock[]): { layout: HallLayout; seats: TemplateSeat[] } {
  const shapes: HallLayout["shapes"] = [];
  const seats: TemplateSeat[] = [];

  for (const b of blocks) {
    if (b.kind === "tables") {
      let n = b.startNumber;
      for (let r = 0; r < b.rows; r++) {
        for (let c = 0; c < b.cols; c++, n++) {
          const cx = b.x + TABLE_W / 2 + 10 + c * b.gapX;
          const cy = b.y + TABLE_H / 2 + 32 + r * b.gapY;
          shapes.push({ kind: "table", x: cx - TABLE_W / 2, y: cy - TABLE_H / 2, w: TABLE_W, h: TABLE_H, label: String(n) });
          tableSeatOffsets(b.seatsPerTable).forEach(([dx, dy], i) =>
            seats.push({ blockId: b.id, section: b.section, row: String(n), place: String(i + 1), group: `${b.id}:t${n}`, x: cx + dx, y: cy + dy }),
          );
        }
      }
    } else if (b.kind === "rows") {
      for (let r = 0; r < b.rows; r++) {
        const row = String(b.startRow + r);
        for (let p = 0; p < b.seatsPerRow; p++) {
          // Each theatre seat is sold on its own, so it is its own group
          seats.push({ blockId: b.id, section: b.section, row, place: String(p + 1), group: `${b.id}:r${row}p${p + 1}`, x: b.x + 15 + p * b.spacing, y: b.y + 15 + r * b.rowGap });
        }
      }
    } else if (b.kind === "bar") {
      const height = (b.seats - 1) * b.spacing + 40;
      shapes.push({ kind: "bar", x: b.x + 50, y: b.y, w: 60, h: height });
      for (let i = 0; i < b.seats; i++) {
        seats.push({ blockId: b.id, section: b.section, row: "1", place: String(i + 1), group: `${b.id}:b${i + 1}`, x: b.x + 20, y: b.y + 20 + i * b.spacing });
      }
    } else {
      shapes.push({ kind: "stage", x: b.x, y: b.y, w: b.width, label: b.label });
    }
  }

  let maxX = 200;
  let maxY = 200;
  for (const b of blocks) {
    const f = blockFootprint(b);
    maxX = Math.max(maxX, b.x + f.w);
    maxY = Math.max(maxY, b.y + f.h);
  }
  return { layout: { width: Math.ceil(maxX + MARGIN), height: Math.ceil(maxY + MARGIN), shapes }, seats };
}

export function validateBlocks(blocks: HallBlock[]): string | null {
  const ids = new Set<string>();
  for (const b of blocks) {
    if (ids.has(b.id)) return "Bloklar identifikatori takrorlangan";
    ids.add(b.id);
  }
  const { seats } = generateHall(blocks);
  if (seats.length > 5000) return "Bitta zalda 5000 tadan ortiq o'rin bo'lishi mumkin emas";
  // Two seats with the same section/row/place would collide in the database
  const keys = new Set<string>();
  for (const s of seats) {
    const k = `${s.section}|${s.row}|${s.place}`;
    if (keys.has(k)) return `Takrorlangan o'rin: ${s.section}, ${s.row}-qator, ${s.place}-o'rin. Bo'lim nomini yoki boshlang'ich raqamni o'zgartiring.`;
    keys.add(k);
  }
  return null;
}

export function newBlock(kind: HallBlock["kind"], y: number): HallBlock {
  const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  switch (kind) {
    case "tables":
      return { kind, id, section: "Stollar", x: 40, y, rows: 3, cols: 4, seatsPerTable: 4, startNumber: 1, gapX: 110, gapY: 120 };
    case "rows":
      return { kind, id, section: "Parter", x: 40, y, rows: 5, seatsPerRow: 12, startRow: 1, spacing: 30, rowGap: 36 };
    case "bar":
      return { kind, id, section: "Bar", x: 40, y, seats: 8, spacing: 36 };
    case "stage":
      return { kind, id, x: 40, y, width: 300, label: "Sahna" };
  }
}
