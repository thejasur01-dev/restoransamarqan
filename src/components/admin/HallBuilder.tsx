"use client";

import { useMemo, useState } from "react";
import type { HallBlock } from "@/db/schema";
import { blockFootprint, generateHall, newBlock, validateBlocks } from "@/lib/hall-builder";

const KIND_LABEL = { tables: "Stollar", rows: "Qatorlar (teatr)", bar: "Bar", stage: "Sahna" } as const;

type NumField = { key: string; label: string; min: number; max: number; step?: number };

const FIELDS: Record<HallBlock["kind"], NumField[]> = {
  tables: [
    { key: "rows", label: "Qatorlar", min: 1, max: 40 },
    { key: "cols", label: "Ustunlar", min: 1, max: 40 },
    { key: "startNumber", label: "1-stol raqami", min: 1, max: 9999 },
    { key: "gapX", label: "Gorizontal oraliq", min: 70, max: 400, step: 5 },
    { key: "gapY", label: "Vertikal oraliq", min: 70, max: 400, step: 5 },
  ],
  rows: [
    { key: "rows", label: "Qatorlar", min: 1, max: 80 },
    { key: "seatsPerRow", label: "Qatordagi o'rinlar", min: 1, max: 120 },
    { key: "startRow", label: "1-qator raqami", min: 1, max: 999 },
    { key: "spacing", label: "O'rinlar oralig'i", min: 18, max: 80 },
    { key: "rowGap", label: "Qatorlar oralig'i", min: 20, max: 120 },
  ],
  bar: [
    { key: "seats", label: "O'rinlar", min: 1, max: 60 },
    { key: "spacing", label: "Oraliq", min: 20, max: 80 },
  ],
  stage: [{ key: "width", label: "Kengligi", min: 60, max: 3000, step: 10 }],
};

/** Visual hall editor: blocks with parameters on the left, live plan on the right. */
export function HallBuilder({ name, initial }: { name: string; initial: HallBlock[] }) {
  const [blocks, setBlocks] = useState<HallBlock[]>(initial);
  const [active, setActive] = useState<string | null>(initial[0]?.id ?? null);
  const { layout, seats } = useMemo(() => generateHall(blocks), [blocks]);
  const problem = useMemo(() => validateBlocks(blocks), [blocks]);

  const update = (id: string, patch: Record<string, unknown>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as HallBlock) : b)));

  function add(kind: HallBlock["kind"]) {
    const bottom = blocks.reduce((m, b) => Math.max(m, b.y + blockFootprint(b).h), 0);
    const b = newBlock(kind, bottom + 30);
    // Keep row/table numbers unique across blocks of the same section by default
    if (b.kind === "tables") b.startNumber = blocks.filter((x) => x.kind === "tables").reduce((n, x) => n + (x.kind === "tables" ? x.rows * x.cols : 0), 1);
    setBlocks((bs) => [...bs, b]);
    setActive(b.id);
  }

  return (
    <div className="a-card">
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />
      <div className="a-head" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Zal sxemasi</h2>
          <p>
            {seats.length} ta o&apos;rin · {layout.width}×{layout.height}
          </p>
        </div>
        <div className="a-actions">
          {(Object.keys(KIND_LABEL) as HallBlock["kind"][]).map((k) => (
            <button key={k} type="button" className="a-btn a-btn-sm" onClick={() => add(k)}>
              + {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>
      {problem && (
        <p className="a-error" style={{ marginBottom: 12 }}>
          {problem}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) 1fr", gap: 16, alignItems: "start" }} className="hall-builder">
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 640, overflowY: "auto" }}>
          {blocks.length === 0 && <p className="a-empty">Blok qo&apos;shing: stollar, qatorlar, bar yoki sahna.</p>}
          {blocks.map((b) => (
            <div key={b.id} style={{ border: `1px solid ${active === b.id ? "var(--a-brand)" : "var(--a-border)"}`, borderRadius: 8, padding: 12 }} onFocus={() => setActive(b.id)}>
              <div className="a-actions" style={{ justifyContent: "space-between", marginBottom: 8 }}>
                <b>{KIND_LABEL[b.kind]}</b>
                <button type="button" className="a-btn a-btn-sm a-btn-danger" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}>
                  O&apos;chirish
                </button>
              </div>
              <div className="a-form a-form-2" style={{ gap: 8 }}>
                {b.kind === "stage" ? (
                  <label className="a-field a-span-2">
                    <span>Yozuv</span>
                    <input className="a-input" value={b.label} maxLength={40} onChange={(e) => update(b.id, { label: e.target.value })} />
                  </label>
                ) : (
                  <label className="a-field a-span-2">
                    <span>Bo&apos;lim nomi</span>
                    <input className="a-input" value={b.section} maxLength={40} onChange={(e) => update(b.id, { section: e.target.value })} />
                  </label>
                )}
                {b.kind === "tables" && (
                  <label className="a-field a-span-2">
                    <span>Stoldagi o&apos;rinlar</span>
                    <select value={b.seatsPerTable} onChange={(e) => update(b.id, { seatsPerTable: Number(e.target.value) })}>
                      {[2, 4, 6, 8].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {[{ key: "x", label: "X (chapdan)", min: 0, max: 5000, step: 10 }, { key: "y", label: "Y (tepadan)", min: 0, max: 5000, step: 10 }, ...FIELDS[b.kind]].map((f) => (
                  <label key={f.key} className="a-field">
                    <span>{f.label}</span>
                    <input
                      className="a-input"
                      type="number"
                      min={f.min}
                      max={f.max}
                      step={f.step ?? 1}
                      value={(b as Record<string, unknown>)[f.key] as number}
                      onChange={(e) => {
                        const v = Math.round(Number(e.target.value));
                        if (Number.isFinite(v)) update(b.id, { [f.key]: Math.min(f.max, Math.max(f.min, v)) });
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ border: "1px solid var(--a-border)", borderRadius: 8, background: "#fafbfb", overflow: "auto", maxHeight: 640 }}>
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ width: "100%", minWidth: 360, display: "block" }}>
            {blocks.map((b) => {
              const f = blockFootprint(b);
              return (
                <rect
                  key={b.id}
                  x={b.x}
                  y={b.y}
                  width={f.w}
                  height={f.h}
                  fill={active === b.id ? "rgba(0,149,137,.07)" : "transparent"}
                  stroke={active === b.id ? "#009589" : "#d8dede"}
                  strokeDasharray="6 4"
                  style={{ cursor: "pointer" }}
                  onClick={() => setActive(b.id)}
                />
              );
            })}
            {layout.shapes.map((s, i) =>
              s.kind === "stage" ? (
                <g key={i}>
                  <path d={`M${s.x} ${s.y + 14} Q${s.x + s.w / 2} ${s.y - 6} ${s.x + s.w} ${s.y + 14}`} fill="none" stroke="#999" strokeWidth={2.5} />
                  <text x={s.x + s.w / 2} y={s.y + 44} textAnchor="middle" fontSize={20} fill="#999">
                    {s.label}
                  </text>
                </g>
              ) : (
                <g key={i}>
                  <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={4} fill="#fff" stroke="#cfcfcf" strokeWidth={1.5} />
                  {s.kind === "table" && (
                    <text x={s.x + s.w / 2} y={s.y + s.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={13} fill="#777">
                      {s.label}
                    </text>
                  )}
                </g>
              ),
            )}
            {seats.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={7} fill="#009589" opacity={0.85} />
            ))}
          </svg>
        </div>
      </div>
      <style>{`@media (max-width: 960px) { .hall-builder { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
