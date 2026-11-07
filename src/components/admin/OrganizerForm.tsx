"use client";

import { useActionState } from "react";
import { saveOrganizerAction } from "@/app/admin/_actions/organizers";

export type OrganizerValues = { id?: number; name: string; legalName: string; inn: string; phone: string; email: string };

export function OrganizerForm({ values }: { values: OrganizerValues }) {
  const [state, action, pending] = useActionState(saveOrganizerAction, null);
  return (
    <form action={action} className="a-card">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="a-form a-form-2">
        <label className="a-field">
          <span>Nomi (saytda)</span>
          <input className="a-input" name="name" defaultValue={values.name} required maxLength={120} placeholder="Bitva Events" />
        </label>
        <label className="a-field">
          <span>Yuridik nomi</span>
          <input className="a-input" name="legalName" defaultValue={values.legalName} required maxLength={200} placeholder="YaTT Familiya Ism" />
          <small>Har bir tadbir sahifasining pastida ko&apos;rsatiladi</small>
        </label>
        <label className="a-field">
          <span>STIR (INN)</span>
          <input className="a-input" name="inn" defaultValue={values.inn} inputMode="numeric" maxLength={14} />
        </label>
        <label className="a-field">
          <span>Telefon</span>
          <input className="a-input" name="phone" defaultValue={values.phone} maxLength={40} placeholder="+998 90 123 45 67" />
        </label>
        <label className="a-field">
          <span>Email</span>
          <input className="a-input" name="email" type="email" defaultValue={values.email} maxLength={200} />
        </label>
        {state?.error && <p className="a-error a-span-all">{state.error}</p>}
        {state?.ok && <p className="a-ok a-span-all">{state.ok}</p>}
        <div className="a-actions a-span-all">
          <button className="a-btn a-btn-primary" disabled={pending}>
            {pending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
        </div>
      </div>
    </form>
  );
}
