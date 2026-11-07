"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SeatMap } from "@/lib/seating";
import { formatEventDateWithWeekday, formatPrice } from "@/lib/format";
import { CheckoutDialog } from "./CheckoutDialog";
import { HallPlan } from "./HallPlan";
import { seatLabel } from "./labels";
import { formatTimer, useCountdown } from "./useCountdown";
import styles from "./BuyWidget.module.css";

type Props = { slug: string; initialMap: SeatMap; onSale: boolean };
type Toast = { kind: "info" | "error" | "hot"; title?: string; text: string } | null;

const POLL_MS = 15_000;

export function BuyWidget({ slug, initialMap, onSale }: Props) {
  const [map, setMap] = useState(initialMap);
  const [clockOffset, setClockOffset] = useState(() => initialMap.serverNow - Date.now());
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((t: Toast, ms = 6000) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    if (t) toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const applyMap = useCallback((next: SeatMap) => {
    setMap(next);
    setClockOffset(next.serverNow - Date.now());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/seats`, { cache: "no-store" });
      if (res.ok) applyMap(await res.json());
    } catch {
      // Offline for a moment: keep showing the last known map, the next poll retries
    }
  }, [slug, applyMap]);

  // Keep availability fresh while the tab is visible; pause in background tabs and during checkout
  useEffect(() => {
    if (checkoutOpen) return;
    const tick = () => document.visibilityState === "visible" && refresh();
    const id = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh, checkoutOpen]);

  const cart = useMemo(() => map.seats.filter((s) => s.state === "mine"), [map]);
  const freeCount = useMemo(() => map.seats.filter((s) => s.state === "free").length, [map]);
  const priceOf = useMemo(() => new Map(map.categories.map((c) => [c.id, c])), [map]);
  const total = cart.reduce((sum, s) => sum + (priceOf.get(s.categoryId)?.price ?? 0), 0);
  const secondsLeft = useCountdown(cart.length ? map.cartExpiresAt : null, clockOffset, () => {
    setCheckoutOpen(false);
    showToast({ kind: "error", title: "Bron vaqti tugadi", text: "Tanlangan o'rinlar bo'shatildi. Kerak bo'lsa, qaytadan tanlang." }, 9000);
    refresh();
  });

  // Scarcity hint shown once, like the reference site
  const hintShown = useRef(false);
  useEffect(() => {
    if (hintShown.current || !onSale || freeCount === 0 || freeCount > 10) return;
    hintShown.current = true;
    const cheapest = map.categories.find((c) => map.seats.some((s) => s.state === "free" && s.categoryId === c.id));
    showToast({ kind: "hot", title: `Atigi ${freeCount} ta chipta qoldi`, text: cheapest ? `${cheapest.name} — ${formatPrice(cheapest.price)}` : "" }, 9000);
  }, [freeCount, map, onSale, showToast]);

  async function onSeat(seat: SeatMap["seats"][number]) {
    if (!onSale) return;
    const action = seat.state === "mine" ? "remove" : "add";
    setBusyGroup(seat.group);
    try {
      const res = await fetch(`/api/events/${slug}/hold`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ seatId: seat.id, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast({ kind: "error", text: data.message ?? "Xatolik yuz berdi" });
        if (res.status === 409) refresh();
        return;
      }
      applyMap(data);
      const groupSize = (data as SeatMap).seats.filter((s) => s.group === seat.group).length;
      if (action === "add" && groupSize > 1) showToast({ kind: "info", text: "Bu chiptalarni faqat birga sotib olish mumkin" });
      else if (action === "remove") showToast(null);
    } catch {
      showToast({ kind: "error", text: "Internet aloqasini tekshiring va qayta urinib ko'ring" });
    } finally {
      setBusyGroup(null);
    }
  }

  const startsAt = new Date(map.event.startsAt);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <Link href={`/e/${slug}`} className={styles.back} aria-label="Tadbir sahifasiga qaytish">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div className={styles.headText}>
          <h1>{map.event.title}</h1>
          <p>
            {formatEventDateWithWeekday(startsAt)} • {map.event.venueName}
          </p>
        </div>
      </header>

      {!onSale ? (
        <div className={styles.closed}>
          <p>Bu tadbirga chipta sotuvi yakunlangan.</p>
          <Link href="/" className="btn">
            Boshqa tadbirlar
          </Link>
        </div>
      ) : (
        <>
          {map.categories.length > 1 && (
            <div className={styles.chips} role="group" aria-label="Narx toifalari">
              {map.categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.chip} ${highlight === c.id ? styles.chipActive : ""}`}
                  aria-pressed={highlight === c.id}
                  onClick={() => setHighlight((h) => (h === c.id ? null : c.id))}
                  title={c.name}
                >
                  <span className={styles.chipDot} style={{ background: c.color }} />
                  {formatPrice(c.price)}
                </button>
              ))}
            </div>
          )}

          <HallPlan map={map} busyGroup={busyGroup} highlightCategory={highlight} onSeat={onSeat} />
          {freeCount === 0 && cart.length === 0 && <p className={styles.soldOut}>Barcha chiptalar sotilgan</p>}
        </>
      )}

      {toast && (
        <div className={`${styles.toast} ${styles[toast.kind]}`} role={toast.kind === "error" ? "alert" : "status"}>
          <span className={styles.toastIcon} aria-hidden="true">
            {toast.kind === "hot" ? "🔥" : toast.kind === "error" ? "!" : "i"}
          </span>
          <div>
            {toast.title && <strong>{toast.title}</strong>}
            {toast.text && <p>{toast.text}</p>}
          </div>
          <button type="button" className={styles.toastClose} onClick={() => showToast(null)} aria-label="Yopish">
            ×
          </button>
        </div>
      )}

      {cart.length > 0 && (
        <div className={styles.cart}>
          <ul className={styles.tickets} aria-label="Tanlangan chiptalar">
            {cart.map((s) => (
              <li key={s.id}>
                <span>{seatLabel(s)}</span>
                <span className={styles.ticketPrice}>{formatPrice(priceOf.get(s.categoryId)?.price ?? 0)}</span>
                <span className={styles.ticketSection}>{s.section}</span>
              </li>
            ))}
          </ul>
          <div className={styles.cartAction}>
            <span className={styles.total}>{formatPrice(total)}</span>
            <button type="button" className={`btn ${styles.buy}`} onClick={() => setCheckoutOpen(true)}>
              Sotib olish
              {secondsLeft !== null && (
                <span className={styles.timer} aria-label={`Bron ${formatTimer(secondsLeft)} dan keyin tugaydi`}>
                  <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  {formatTimer(secondsLeft)}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {checkoutOpen && cart.length > 0 && (
        <CheckoutDialog
          slug={slug}
          title={map.event.title}
          startsAt={map.event.startsAt}
          items={cart.map((s) => ({ id: s.id, label: seatLabel(s), section: s.section, price: priceOf.get(s.categoryId)?.price ?? 0 }))}
          total={total}
          secondsLeft={secondsLeft}
          onClose={() => setCheckoutOpen(false)}
          onCartGone={() => {
            setCheckoutOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
