"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { HallLayout } from "@/db/schema";
import { boxOfficeSaleAction, seatOpAction } from "@/app/admin/_actions/events";
import { money } from "./format";

export type AdminSeat = { id: number; categoryId: number; section: string; row: string; place: string; group: string; x: number; y: number; status: "available" | "held" | "sold" | "blocked" };
type Category = { id: number; name: string; price: number; color: string };

const STATUS_LABEL = { available: "Sotuvda", held: "Savatda", sold: "Sotilgan", blocked: "Yopilgan" } as const;

export function AdminSeatPlan({ eventId, layout, seats, categories }: { eventId: number; layout: HallLayout; seats: AdminSeat[]; categories: Category[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string; orderId?: string } | null>(null);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [sale, setSale] = useState({ phone: "", email: "", comment: "" });
  const [showSale, setShowSale] = useState(false);
  const [pending, start] = useTransition();

  const color = useMemo(() => new Map(categories.map((c) => [c.id, c.color])), [categories]);
  const price = useMemo(() => new Map(categories.map((c) => [c.id, c.price])), [categories]);
  const byGroup = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const s of seats) m.set(s.group, [...(m.get(s.group) ?? []), s.id]);
    return m;
  }, [seats]);
  const counts = useMemo(() => {
    const c = { available: 0, held: 0, sold: 0, blocked: 0 };
    for (const s of seats) c[s.status]++;
    return c;
  }, [seats]);

  const selectedSeats = seats.filter((s) => selected.has(s.id));
  const selectedTotal = selectedSeats.reduce((sum, s) => sum + (price.get(s.categoryId) ?? 0), 0);

  function toggle(seat: AdminSeat, wholeGroup: boolean) {
    const ids = wholeGroup ? byGroup.get(seat.group) ?? [seat.id] : [seat.id];
    setSelected((prev) => {
      const next = new Set(prev);
      const allOn = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function run(op: "category" | "block" | "unblock") {
    start(async () => {
      const res = await seatOpAction({ eventId, seatIds: [...selected], op, categoryId });
      setMessage(res?.error ? { kind: "error", text: res.error } : { kind: "ok", text: res?.ok ?? "" });
      if (!res?.error) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  function sell() {
    start(async () => {
      const res = await boxOfficeSaleAction({ eventId, seatIds: [...selected], ...sale });
      if (res?.error) return setMessage({ kind: "error", text: res.error });
      setMessage({ kind: "ok", text: res.ok ?? "", orderId: res.orderId });
      setSelected(new Set());
      setShowSale(false);
      setSale({ phone: "", email: "", comment: "" });
      router.refresh();
    });
  }

  return (
    <div className="a-card">
      <div className="a-head" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>Zal</h2>
        <div className="a-actions" style={{ fontSize: 13, color: "var(--a-muted)" }}>
          {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((k) => (
            <span key={k}>
              {STATUS_LABEL[k]}: <b style={{ color: "var(--a-text)" }}>{counts[k]}</b>
            </span>
          ))}
        </div>
      </div>
      <p style={{ color: "var(--a-muted)", marginBottom: 10 }}>
        O&apos;rindiqni bosing — tanlanadi. <b>Shift</b> bilan bossangiz — butun stol tanlanadi.
      </p>

      <div className="a-actions" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            className="a-btn a-btn-sm"
            onClick={() => setSelected(new Set(seats.filter((s) => s.categoryId === c.id && s.status !== "sold").map((s) => s.id)))}
          >
            <span style={{ width: 10, height: 10, borderRadius: 5, background: c.color, display: "inline-block" }} />
            {c.name} — {money(c.price)}
          </button>
        ))}
        {selected.size > 0 && (
          <button type="button" className="a-btn a-btn-sm" onClick={() => setSelected(new Set())}>
            Tanlovni tozalash
          </button>
        )}
      </div>

      <div style={{ overflow: "auto", maxHeight: "70vh", border: "1px solid var(--a-border)", borderRadius: 6, background: "#fafbfb" }}>
        <svg viewBox={`0 0 ${layout.width} ${layout.height}`} style={{ width: Math.max(layout.width, 600), maxWidth: "100%", display: "block", margin: "0 auto", userSelect: "none" }}>
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
          {seats.map((s) => {
            const isSel = selected.has(s.id);
            const c = color.get(s.categoryId) ?? "#999";
            const fill = s.status === "sold" ? "#5d6766" : s.status === "blocked" ? "#d9dddd" : c;
            return (
              <g key={s.id} style={{ cursor: s.status === "sold" ? "default" : "pointer" }} onClick={(e) => s.status !== "sold" && toggle(s, e.shiftKey)}>
                <title>{`${s.section}, ${s.row}-qator, ${s.place}-o'rin — ${STATUS_LABEL[s.status]}`}</title>
                <circle cx={s.x} cy={s.y} r={14} fill="transparent" />
                {isSel && <circle cx={s.x} cy={s.y} r={12} fill="none" stroke="#1f2a29" strokeWidth={2.5} />}
                <circle cx={s.x} cy={s.y} r={8} fill={fill} stroke={s.status === "held" ? "#b07800" : "none"} strokeWidth={3} />
                {s.status === "blocked" && <path d={`M${s.x - 4} ${s.y - 4}l8 8M${s.x + 4} ${s.y - 4}l-8 8`} stroke="#7b8584" strokeWidth={1.6} />}
              </g>
            );
          })}
        </svg>
      </div>

      {message && (
        <p className={message.kind === "ok" ? "a-ok" : "a-error"} style={{ marginTop: 12 }} role="status">
          {message.text}
          {message.orderId && (
            <>
              {" "}
              <Link href={`/admin/orders/${message.orderId}`}>Buyurtmani ochish →</Link>
            </>
          )}
        </p>
      )}

      {selected.size > 0 && (
        <div style={{ position: "sticky", bottom: 0, marginTop: 12, padding: 12, background: "#fff", border: "1px solid var(--a-border)", borderRadius: 8, boxShadow: "0 -4px 16px rgba(0,0,0,.06)" }}>
          <p style={{ marginBottom: 10 }}>
            Tanlangan: <b>{selected.size}</b> ta o&apos;rin · {money(selectedTotal)}
          </p>
          <div className="a-actions">
            <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))} style={{ width: "auto" }}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="button" className="a-btn" disabled={pending} onClick={() => run("category")}>
              Toifani o&apos;zgartirish
            </button>
            <button type="button" className="a-btn" disabled={pending} onClick={() => run("block")}>
              Sotuvdan yopish
            </button>
            <button type="button" className="a-btn" disabled={pending} onClick={() => run("unblock")}>
              Sotuvga qaytarish
            </button>
            <button type="button" className="a-btn a-btn-primary" disabled={pending} onClick={() => setShowSale((v) => !v)}>
              Kassa orqali sotish
            </button>
          </div>
          {showSale && (
            <div className="a-form a-form-3" style={{ marginTop: 12 }}>
              <label className="a-field">
                <span>Xaridor telefoni</span>
                <input className="a-input" value={sale.phone} onChange={(e) => setSale({ ...sale, phone: e.target.value })} placeholder="+998 90 123 45 67" />
              </label>
              <label className="a-field">
                <span>Email (ixtiyoriy)</span>
                <input className="a-input" value={sale.email} onChange={(e) => setSale({ ...sale, email: e.target.value })} />
              </label>
              <label className="a-field">
                <span>Izoh (ixtiyoriy)</span>
                <input className="a-input" value={sale.comment} onChange={(e) => setSale({ ...sale, comment: e.target.value })} />
              </label>
              <div className="a-actions a-span-all">
                <button type="button" className="a-btn a-btn-primary" disabled={pending} onClick={sell}>
                  {pending ? "Sotilmoqda…" : `Naqd to'lov qabul qilindi — ${money(selectedTotal)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
