"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/admin/_actions/auth";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="a-card" style={{ maxWidth: 440 }}>
      <h2>Parolni o&apos;zgartirish</h2>
      <div className="a-form">
        <label className="a-field">
          <span>Joriy parol</span>
          <input className="a-input" type="password" name="current" autoComplete="current-password" required />
        </label>
        <label className="a-field">
          <span>Yangi parol</span>
          <input className="a-input" type="password" name="next" autoComplete="new-password" required minLength={10} />
          <small>Kamida 10 belgi, harf va raqam bilan</small>
        </label>
        <label className="a-field">
          <span>Yangi parolni takrorlang</span>
          <input className="a-input" type="password" name="repeat" autoComplete="new-password" required minLength={10} />
        </label>
        {state?.error && <p className="a-error">{state.error}</p>}
        <button className="a-btn a-btn-primary" disabled={pending}>
          {pending ? "Saqlanmoqda…" : "O'zgartirish"}
        </button>
        <small style={{ color: "var(--a-muted)" }}>O&apos;zgartirilgach, barcha qurilmalardan chiqarilasiz va qaytadan kirasiz.</small>
      </div>
    </form>
  );
}
