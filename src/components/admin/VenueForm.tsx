"use client";

import { useActionState } from "react";
import type { HallBlock } from "@/db/schema";
import { saveVenueAction } from "@/app/admin/_actions/venues";
import { HallBuilder } from "./HallBuilder";

export type VenueValues = { id?: number; name: string; city: string; address: string; lat: string; lng: string; blocks: HallBlock[] };

export function VenueForm({ values }: { values: VenueValues }) {
  const [state, action, pending] = useActionState(saveVenueAction, null);
  return (
    <form action={action}>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="a-card">
        <div className="a-form a-form-3">
          <label className="a-field">
            <span>Nomi</span>
            <input className="a-input" name="name" defaultValue={values.name} required maxLength={120} placeholder="Navo Lounge" />
          </label>
          <label className="a-field">
            <span>Shahar</span>
            <input className="a-input" name="city" defaultValue={values.city} required maxLength={60} placeholder="Toshkent" />
          </label>
          <label className="a-field">
            <span>Manzil</span>
            <input className="a-input" name="address" defaultValue={values.address} required maxLength={200} placeholder="Amir Temur ko'chasi, 15" />
          </label>
          <label className="a-field">
            <span>Kenglik (lat)</span>
            <input className="a-input" name="lat" defaultValue={values.lat} inputMode="decimal" placeholder="41.3111" />
          </label>
          <label className="a-field">
            <span>Uzunlik (lng)</span>
            <input className="a-input" name="lng" defaultValue={values.lng} inputMode="decimal" placeholder="69.2797" />
          </label>
          <p className="a-field" style={{ color: "var(--a-muted)", fontSize: 12, justifyContent: "flex-end" }}>
            Koordinatalar xaritadagi nuqta uchun. Yandex Xaritada joyni o&apos;ng tugma bilan bosib, raqamlarni nusxalang.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <HallBuilder name="blocks" initial={values.blocks} />
      </div>

      <div className="a-card" style={{ position: "sticky", bottom: 0, zIndex: 2 }}>
        {state?.error && (
          <p className="a-error" role="alert" style={{ marginBottom: 10 }}>
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="a-ok" role="status" style={{ marginBottom: 10 }}>
            {state.ok}
          </p>
        )}
        <div className="a-actions">
          <button className="a-btn a-btn-primary" disabled={pending}>
            {pending ? "Saqlanmoqda…" : "Saqlash"}
          </button>
          <small style={{ color: "var(--a-muted)" }}>Sxemadagi o&apos;zgarishlar yangi yaratiladigan tadbir zallariga qo&apos;llanadi; sotuvdagi tadbirlar o&apos;zgarmaydi.</small>
        </div>
      </div>
    </form>
  );
}
