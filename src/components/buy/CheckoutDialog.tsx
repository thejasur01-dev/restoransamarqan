"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PhoneLogin } from "@/components/auth/PhoneLogin";
import { suggestEmail } from "@/lib/email-typo";
import { formatEventDate, formatPrice } from "@/lib/format";
import { formatLocalPhone, localPhoneDigits } from "@/lib/phone-input";
import { site } from "@/lib/site";
import { formatTimer } from "./useCountdown";
import styles from "./CheckoutDialog.module.css";

type Props = {
  slug: string;
  title: string;
  startsAt: string;
  items: Array<{ id: number; label: string; section: string; price: number }>;
  total: number;
  secondsLeft: number | null;
  /** Verified phone of the signed-in customer, if any */
  customerPhone: string | null;
  onLogin: (phone: string) => void;
  onClose: () => void;
  onCartGone: () => void;
};

const prettyPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4");

export function CheckoutDialog({ slug, title, startsAt, items, total, secondsLeft, customerPhone, onLogin, onClose, onCartGone }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"confirm" | "form">("confirm");
  const [email, setEmail] = useState("");
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  // Used only when phone login is off: the buyer types the number like on the reference site
  const [phone, setPhone] = useState("");
  const phoneLogin = site.features.phoneLogin;
  const [comment, setComment] = useState("");
  const [accept, setAccept] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("input, button")?.focus();
  }, [step, customerPhone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, submitting]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${slug}/order`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim() || undefined,
          ...(phoneLogin ? {} : { phone: `+998${phone}` }),
          comment,
          acceptRules: accept,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Xatolik yuz berdi");
        if (data.error === "empty") onCartGone();
        setSubmitting(false);
        return;
      }
      // Keep the button disabled while navigating so the order can't be submitted twice
      router.push(`/order/${data.orderId}`);
    } catch {
      setError("Internet aloqasini tekshiring va qayta urinib ko'ring");
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && !submitting && onClose()}>
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="checkout-title">
        {secondsLeft !== null && (
          <p className={styles.timer}>
            Bron vaqti: <b>{formatTimer(secondsLeft)}</b>
          </p>
        )}

        {step === "confirm" ? (
          <>
            <h2 id="checkout-title" className={styles.title}>
              Hammasi to&apos;g&apos;rimi?
            </h2>
            <p className={styles.event}>{title}</p>
            <p className={styles.date}>{formatEventDate(new Date(startsAt))}</p>
            <ul className={styles.items}>
              {items.map((i) => (
                <li key={i.id}>
                  <span>
                    {i.label}
                    <small>{i.section}</small>
                  </span>
                  <span>{formatPrice(i.price)}</span>
                </li>
              ))}
            </ul>
            <p className={styles.total}>
              <span>Jami</span>
              <b>{formatPrice(total)}</b>
            </p>
            <div className={styles.actions}>
              <button type="button" className="btn" onClick={() => setStep("form")}>
                Davom etish
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                Orqaga
              </button>
            </div>
          </>
        ) : phoneLogin && !customerPhone ? (
          <>
            <h2 id="checkout-title" className={styles.title}>
              Telefon raqamingiz
            </h2>
            <PhoneLogin
              onVerified={onLogin}
              hint="Chiptalaringiz shu raqamga bog'lanadi: istalgan qurilmadan «Mening chiptalarim» bo'limida ko'rasiz."
            />
            <div className={styles.actions} style={{ marginTop: 10 }}>
              <button type="button" className={styles.secondary} onClick={() => setStep("confirm")}>
                Orqaga
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id="checkout-title" className={styles.title}>
              Buyurtmani rasmiylashtirish
            </h2>

            {phoneLogin && customerPhone && (
              <div className={styles.verified}>
                <span>Telefon</span>
                <b>{prettyPhone(customerPhone)}</b>
                <span className={styles.badge}>✓ tasdiqlangan</span>
              </div>
            )}

            <label className={styles.field}>
              <span>Email {phoneLogin && <small className={styles.optional}>(ixtiyoriy)</small>}</span>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required={!phoneLogin}
                maxLength={200}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailSuggestion(null);
                }}
                onBlur={() => setEmailSuggestion(suggestEmail(email.trim()))}
              />
              {emailSuggestion && (
                <button
                  type="button"
                  className={styles.suggestion}
                  onClick={() => {
                    setEmail(emailSuggestion);
                    setEmailSuggestion(null);
                  }}
                >
                  <b>{emailSuggestion}</b> demoqchimisiz?
                </button>
              )}
            </label>

            {!phoneLogin && (
              <label className={styles.field}>
                <span>Telefon</span>
                <div className={styles.phone}>
                  <span>+998</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    placeholder="90 123 45 67"
                    value={formatLocalPhone(phone)}
                    onChange={(e) => setPhone(localPhoneDigits(e.target.value))}
                  />
                </div>
              </label>
            )}

            <label className={styles.field}>
              <span>Izoh</span>
              <textarea rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>

            <fieldset className={styles.payment}>
              <legend>To&apos;lov usuli</legend>
              <label>
                <input type="radio" name="payment" defaultChecked /> Click (Uzcard, Humo)
              </label>
            </fieldset>

            <label className={styles.check}>
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
              <span>
                <Link href="/rules" target="_blank">
                  Foydalanish qoidalari
                </Link>{" "}
                bilan tanishdim va roziman
              </span>
            </label>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actions}>
              <button type="submit" className="btn" disabled={submitting || !accept} aria-disabled={submitting || !accept}>
                {submitting ? "Yuborilmoqda…" : `To'lash ${formatPrice(total)}`}
              </button>
              <button type="button" className={styles.secondary} onClick={() => setStep("confirm")} disabled={submitting}>
                Orqaga
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
