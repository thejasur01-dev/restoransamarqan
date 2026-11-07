"use client";

import { useActionState } from "react";
import { loginAction } from "../_actions/auth";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="a-form">
      <label className="a-field">
        <span>Email</span>
        <input className="a-input" type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label className="a-field">
        <span>Parol</span>
        <input className="a-input" type="password" name="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <p className="a-error" role="alert">
          {state.error}
        </p>
      )}
      <button className="a-btn a-btn-primary" style={{ height: 42 }} disabled={pending}>
        {pending ? "Tekshirilmoqda…" : "Kirish"}
      </button>
    </form>
  );
}
