"use client";

import { useState } from "react";

type Point = { day: string; revenue: number; tickets: number };

const W = 900;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 64 };

const money = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;
const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)} mln` : n >= 1e3 ? `${Math.round(n / 1e3)} ming` : String(n));

/** Daily paid revenue. One series, so no legend: the card title names it. */
export function SalesChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.revenue));
  // Round the axis top to a readable number
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(22, slot - 2)); // 2px surface gap between bars
  const y = (v: number) => PAD.top + innerH - (v / top) * innerH;
  const ticks = [0, 0.5, 1].map((t) => t * top);
  const labelEvery = Math.ceil(data.length / 10);
  const h = hover !== null ? data[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Kunlik daromad grafigi">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e9eeee" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" fontSize={11} fill="#6b7776">
              {short(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const barH = Math.max(0, y(0) - y(d.revenue));
          const r = Math.min(4, barW / 2, barH);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              {/* Full-height hit target, larger than the bar itself */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              {barH > 0 && (
                <path
                  d={`M${x},${y(0)} v${-(barH - r)} q0,${-r} ${r},${-r} h${barW - 2 * r} q${r},0 ${r},${r} v${barH - r} z`}
                  fill="#009589"
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7776">
                  {d.day.slice(8)}.{d.day.slice(5, 7)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#cfd7d6" strokeWidth={1} />
      </svg>
      {h && hover !== null && (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 0,
            left: `clamp(0px, calc(${((PAD.left + hover * slot + slot / 2) / W) * 100}% - 80px), calc(100% - 170px))`,
            width: 170,
            padding: "8px 10px",
            background: "#fff",
            border: "1px solid #e3e7e7",
            borderRadius: 6,
            boxShadow: "0 4px 14px rgba(0,0,0,.1)",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          <div style={{ color: "#6b7776" }}>
            {h.day.slice(8)}.{h.day.slice(5, 7)}.{h.day.slice(0, 4)}
          </div>
          <div style={{ fontWeight: 500 }}>{money(h.revenue)}</div>
          <div style={{ color: "#6b7776" }}>{h.tickets} ta chipta</div>
        </div>
      )}
    </div>
  );
}
