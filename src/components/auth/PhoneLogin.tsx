"use client";

import { useEffect, useRef, useState } from "react";
import { formatLocalPhone, localPhoneDigits } from "@/lib/phone-input";
import styles from "./PhoneLogin.module.css";

type Props = {
  onVerified: (phone: string) => void;
  /** Shown above the phone field */
  hint?: string;
};

type Sent = { channel: "telegram" | "sms" | "dev"; devCode?: string };

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Phone number -> one-time code -> signed in. Creates the account on first use; no passwords. */
export function PhoneLogin({ onVerified, hint }: Props) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState<Sent | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [sent]);

  const fullPhone = `+998${phone}`;
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  async function requestCode(viaSms = false) {
    if (busy) return;
    if (phone.length !== 9) {
      setError("Telefon raqamini to'liq kiriting");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/code", { phone: fullPhone, viaSms });
      if (!ok) {
        setError(data.message ?? "Kodni yuborib bo'lmadi");
        if (data.retryAfter) setResendAt(Date.now() + data.retryAfter * 1000);
        return;
      }
      setSent({ channel: data.channel, devCode: data.devCode });
      setCode("");
      setResendAt(Date.now() + data.resendIn * 1000);
      setNow(Date.now());
    } catch {
      setError("Internet aloqasini tekshiring");
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    if (busy || value.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const { ok, data } = await post("/api/auth/verify", { phone: fullPhone, code: value });
      if (!ok) {
        setError(data.message ?? "Kod noto'g'ri");
        setCode("");
        codeRef.current?.focus();
        return;
      }
      onVerified(data.phone);
    } catch {
      setError("Internet aloqasini tekshiring");
    } finally {
      setBusy(false);
    }
  }

  if (!sent) {
    return (
      <form
        className={styles.box}
        onSubmit={(e) => {
          e.preventDefault();
          requestCode();
        }}
        noValidate
      >
        {hint && <p className={styles.hint}>{hint}</p>}
        <label className={styles.label} htmlFor="login-phone">
          Telefon raqami
        </label>
        <div className={styles.phone}>
          <span>+998</span>
          <input
            id="login-phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="90 123 45 67"
            value={formatLocalPhone(phone)}
            onChange={(e) => setPhone(localPhoneDigits(e.target.value))}
            autoFocus
          />
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={`btn ${styles.submit}`} disabled={busy || phone.length !== 9}>
          {busy ? "Yuborilmoqda…" : "Kod olish"}
        </button>
      </form>
    );
  }

  return (
    <div className={styles.box}>
      <p className={styles.sentTo}>
        {sent.channel === "telegram" ? "Kod Telegram'ga yuborildi" : sent.channel === "sms" ? "Kod SMS orqali yuborildi" : "Kod yaratildi"}:{" "}
        <b>+998 {formatLocalPhone(phone)}</b>{" "}
        <button type="button" className={styles.link} onClick={() => setSent(null)}>
          o&apos;zgartirish
        </button>
      </p>
      {sent.devCode && (
        <p className={styles.dev}>
          Test rejimi (SMS/Telegram ulanmagan): kod <b>{sent.devCode}</b>
        </p>
      )}
      <label className={styles.label} htmlFor="login-code">
        Tasdiqlash kodi
      </label>
      <input
        id="login-code"
        ref={codeRef}
        className={styles.code}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        autoFocus
        readOnly={busy}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          setCode(v);
          // Submits by itself once all digits are in (also works with SMS autofill)
          if (v.length === 6) verify(v);
        }}
      />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.resend}>
        {resendIn > 0 ? (
          <span>Qayta yuborish: {resendIn} s</span>
        ) : (
          <>
            <button type="button" className={styles.link} onClick={() => requestCode()} disabled={busy}>
              Kodni qayta yuborish
            </button>
            {sent.channel === "telegram" && (
              <button type="button" className={styles.link} onClick={() => requestCode(true)} disabled={busy}>
                SMS orqali olish
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
