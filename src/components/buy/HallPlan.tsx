"use client";

import { useState } from "react";
import type { SeatMap } from "@/lib/seating";
import { formatPrice } from "@/lib/format";
import { seatLabel } from "./labels";
import styles from "./HallPlan.module.css";

type Props = {
  map: SeatMap;
  busyGroup: string | null;
  highlightCategory: number | null;
  onSeat: (seat: SeatMap["seats"][number]) => void;
};

const ZOOMS = [1, 1.5, 2, 3];
const TAKEN = "#e2e2e2";

export function HallPlan({ map, busyGroup, highlightCategory, onSeat }: Props) {
  const [zoomIndex, setZoomIndex] = useState(0);
  const layout = map.event.layout ?? fallbackLayout(map.seats);
  const colorOf = new Map(map.categories.map((c) => [c.id, c.color]));
  const priceOf = new Map(map.categories.map((c) => [c.id, c.price]));
  const zoom = ZOOMS[zoomIndex];

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller}>
        {/* At zoom 1 the plan fits the screen height (minus header, chips and cart bar) */}
        <div className={styles.card} style={{ width: `calc(min(100%, (100dvh - 230px) * ${layout.width / layout.height}) * ${zoom})` }}>
          {layout.title && <p className={styles.title}>{layout.title}</p>}
          <svg viewBox={`0 0 ${layout.width} ${layout.height}`} className={styles.svg} role="group" aria-label="Zal sxemasi">
            {layout.shapes.map((s, i) => {
              if (s.kind === "table")
                return (
                  <g key={i}>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={4} className={styles.table} />
                    <text x={s.x + s.w / 2} y={s.y + s.h / 2} className={styles.tableLabel}>
                      {s.label}
                    </text>
                  </g>
                );
              if (s.kind === "bar")
                return (
                  <g key={i}>
                    <rect x={s.x} y={s.y} width={s.w} height={s.h} rx={3} className={styles.table} />
                    <path
                      d={`M${s.x + s.w / 2 - 12} ${s.y + s.h / 2 - 12} h24 l-12 13 z M${s.x + s.w / 2} ${s.y + s.h / 2 + 1} v12 M${s.x + s.w / 2 - 7} ${s.y + s.h / 2 + 13} h14`}
                      className={styles.barIcon}
                    />
                  </g>
                );
              return (
                <g key={i}>
                  <path d={`M${s.x} ${s.y + 14} Q${s.x + s.w / 2} ${s.y - 6} ${s.x + s.w} ${s.y + 14}`} className={styles.stage} />
                  <text x={s.x + s.w / 2} y={s.y + 44} className={styles.stageLabel}>
                    {s.label}
                  </text>
                </g>
              );
            })}

            {map.seats.map((seat) => {
              const color = colorOf.get(seat.categoryId) ?? "#999";
              const dimmed = highlightCategory !== null && highlightCategory !== seat.categoryId && seat.state === "free";
              const busy = busyGroup === seat.group;
              const label = `${seatLabel(seat)}, ${seat.section} — ${formatPrice(priceOf.get(seat.categoryId) ?? 0)}`;

              if (seat.state === "taken") {
                return <circle key={seat.id} cx={seat.x} cy={seat.y} r={5} fill={TAKEN} aria-hidden="true" />;
              }

              const activate = () => !busy && onSeat(seat);
              return (
                <g
                  key={seat.id}
                  className={`${styles.seat} ${busy ? styles.busy : ""} ${dimmed ? styles.dimmed : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-pressed={seat.state === "mine"}
                  aria-label={label}
                  onClick={activate}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      activate();
                    }
                  }}
                >
                  <title>{label}</title>
                  {/* Larger transparent hit area makes seats easy to tap on phones */}
                  <circle cx={seat.x} cy={seat.y} r={15} fill="transparent" />
                  {seat.state === "mine" ? (
                    <>
                      <circle cx={seat.x} cy={seat.y} r={12} fill="#fff" stroke={color} strokeWidth={2.5} />
                      <circle cx={seat.x} cy={seat.y} r={6.5} fill={color} />
                    </>
                  ) : (
                    <circle cx={seat.x} cy={seat.y} r={8} fill={color} className={styles.dot} />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className={styles.zoom}>
        <button type="button" onClick={() => setZoomIndex((z) => Math.min(z + 1, ZOOMS.length - 1))} disabled={zoomIndex === ZOOMS.length - 1} aria-label="Kattalashtirish">
          +
        </button>
        <button type="button" onClick={() => setZoomIndex((z) => Math.max(z - 1, 0))} disabled={zoomIndex === 0} aria-label="Kichiklashtirish">
          −
        </button>
      </div>
    </div>
  );
}

/** Events without a drawn plan still get a usable map from the seat coordinates alone. */
function fallbackLayout(seats: SeatMap["seats"]) {
  const maxX = Math.max(100, ...seats.map((s) => s.x));
  const maxY = Math.max(100, ...seats.map((s) => s.y));
  return { width: maxX + 40, height: maxY + 40, shapes: [] as NonNullable<SeatMap["event"]["layout"]>["shapes"], title: undefined };
}
