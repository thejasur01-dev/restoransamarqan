"use client";

import { useActionState } from "react";
import { createAdminAction, resetPasswordAction, updateAdminAction } from "@/app/admin/_actions/admins";

function PasswordNotice({ email, password }: { email?: string; password?: string }) {
  if (!password) return null;
  return (
    <div className="a-note" style={{ marginTop: 10 }}>
      <b>{email}</b> uchun parol: <span className="a-mono" style={{ fontSize: 16, userSelect: "all" }}>{password}</span>
      <br />
      Uni hozir nusxalab, egasiga xavfsiz yo&apos;l bilan yuboring — qayta ko&apos;rsatilmaydi.
    </div>
  );
}

export function CreateAdminForm() {
  const [state, action, pending] = useActionState(createAdminAction, null);
  return (
    <form action={action} className="a-card">
      <h2>Yangi admin</h2>
      <div className="a-form a-form-3">
        <label className="a-field">
          <span>Email</span>
          <input className="a-input" name="email" type="email" required maxLength={200} />
        </label>
        <label className="a-field">
          <span>Ism</span>
          <input className="a-input" name="name" required maxLength={100} />
        </label>
        <label className="a-field">
          <span>Rol</span>
          <select name="role" defaultValue="manager">
            <option value="manager">Menejer — tadbirlar, buyurtmalar, hisobotlar</option>
            <option value="checker">Nazoratchi — faqat chipta tekshirish</option>
            <option value="owner">Egasi — hammasi, adminlar ham</option>
          </select>
        </label>
      </div>
      {state?.error && <p className="a-error" style={{ marginTop: 10 }}>{state.error}</p>}
      <PasswordNotice email={state?.email} password={state?.password} />
      <button className="a-btn a-btn-primary" style={{ marginTop: 12 }} disabled={pending}>
        Qo&apos;shish
      </button>
    </form>
  );
}

export function AdminRow({ admin, isMe }: { admin: { id: number; email: string; name: string; role: string; active: boolean; lastLogin: string }; isMe: boolean }) {
  const [state, action, pending] = useActionState(updateAdminAction, null);
  const [reset, resetAction, resetting] = useActionState(resetPasswordAction, null);
  return (
    <tr>
      <td>
        {admin.name} {isMe && <span className="a-badge a-badge-blue">siz</span>}
        <div style={{ color: "var(--a-muted)", fontSize: 12 }}>{admin.email}</div>
      </td>
      <td>{admin.lastLogin}</td>
      <td colSpan={2}>
        <form action={action} className="a-actions">
          <input type="hidden" name="id" value={admin.id} />
          <select name="role" defaultValue={admin.role} style={{ width: "auto" }}>
            <option value="owner">Egasi</option>
            <option value="manager">Menejer</option>
            <option value="checker">Nazoratchi</option>
          </select>
          <select name="active" defaultValue={String(admin.active)} style={{ width: "auto" }}>
            <option value="true">Faol</option>
            <option value="false">Bloklangan</option>
          </select>
          <button className="a-btn a-btn-sm" disabled={pending}>
            Saqlash
          </button>
        </form>
        {state?.error && <small style={{ color: "var(--a-red)" }}>{state.error}</small>}
        {state?.ok && <small style={{ color: "var(--a-green)" }}>{state.ok}</small>}
      </td>
      <td>
        <form action={resetAction} onSubmit={(e) => !confirm(`${admin.email} uchun yangi parol yaratilsinmi? Eski parol ishlamay qoladi.`) && e.preventDefault()}>
          <input type="hidden" name="id" value={admin.id} />
          <button className="a-btn a-btn-sm" disabled={resetting}>
            Parolni yangilash
          </button>
        </form>
        <PasswordNotice email={reset?.email} password={reset?.password} />
      </td>
    </tr>
  );
}
