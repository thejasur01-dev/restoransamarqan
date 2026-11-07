"use client";

import { useActionState } from "react";
import { saveEventAction } from "@/app/admin/_actions/events";
import { ImageUpload } from "./ImageUpload";

type Option = { id: number; name: string };

export type EventFormValues = {
  id?: number;
  title: string;
  slug: string;
  type: string;
  venueId: number | "";
  organizerId: number | "";
  startsAt: string;
  ageLimit: number;
  imageUrl: string;
  description: string;
  officialUrl: string;
  status: "draft" | "published" | "cancelled";
  holdMinutes: number;
};

export function EventForm({ values, venues, organizers }: { values: EventFormValues; venues: Option[]; organizers: Option[] }) {
  const [state, action, pending] = useActionState(saveEventAction, null);

  return (
    <form action={action} className="a-card">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="a-form a-form-2">
        <label className="a-field a-span-2">
          <span>Nomi</span>
          <input className="a-input" name="title" defaultValue={values.title} required maxLength={200} placeholder="Musiqiy loto (Toshkent, Navo Lounge)" />
        </label>
        <label className="a-field">
          <span>Turi</span>
          <input className="a-input" name="type" defaultValue={values.type} required maxLength={60} list="event-types" />
          <datalist id="event-types">
            <option value="Uchrashuv" />
            <option value="Konsert" />
            <option value="Shou" />
            <option value="O'yin" />
            <option value="Spektakl" />
            <option value="Festival" />
          </datalist>
        </label>
        <label className="a-field">
          <span>Sana va vaqt (Toshkent)</span>
          <input className="a-input" type="datetime-local" name="startsAt" defaultValue={values.startsAt} required />
        </label>
        <label className="a-field">
          <span>Joy</span>
          <select name="venueId" defaultValue={values.venueId} required>
            <option value="">— tanlang —</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Tashkilotchi</span>
          <select name="organizerId" defaultValue={values.organizerId} required>
            <option value="">— tanlang —</option>
            {organizers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <div className="a-span-2">
          <ImageUpload name="imageUrl" defaultValue={values.imageUrl} />
        </div>
        <label className="a-field a-span-2">
          <span>Tavsif</span>
          <textarea name="description" defaultValue={values.description} rows={8} maxLength={10000} />
          <small>Bo&apos;sh qator yangi xatboshi bo&apos;ladi.</small>
        </label>
        <label className="a-field">
          <span>Rasmiy sahifa (ixtiyoriy)</span>
          <input className="a-input" name="officialUrl" defaultValue={values.officialUrl} placeholder="https://t.me/..." maxLength={300} />
        </label>
        <label className="a-field">
          <span>Yosh chegarasi</span>
          <select name="ageLimit" defaultValue={values.ageLimit}>
            {[0, 6, 12, 16, 18].map((a) => (
              <option key={a} value={a}>
                {a === 0 ? "Cheklovsiz" : `${a}+`}
              </option>
            ))}
          </select>
        </label>
        <label className="a-field">
          <span>Holati</span>
          <select name="status" defaultValue={values.status}>
            <option value="draft">Qoralama — saytda ko&apos;rinmaydi</option>
            <option value="published">E&apos;lon qilingan — saytda sotuvda</option>
            <option value="cancelled">Bekor qilingan — saytdan olinadi</option>
          </select>
        </label>
        <label className="a-field">
          <span>Savatda saqlash vaqti (daqiqa)</span>
          <input className="a-input" type="number" name="holdMinutes" min={5} max={60} defaultValue={values.holdMinutes} />
        </label>
        <label className="a-field a-span-2">
          <span>Havola nomi (ixtiyoriy)</span>
          <input className="a-input" name="slug" defaultValue={values.slug} placeholder="Bo'sh qoldirsangiz, nomidan avtomatik yaratiladi" maxLength={90} />
          <small>Sahifa manzili: /e/{values.slug || "…"}</small>
        </label>

        {state?.error && (
          <p className="a-error a-span-all" role="alert">
            {state.error}
          </p>
        )}
        {state?.ok && (
          <p className="a-ok a-span-all" role="status">
            {state.ok}
          </p>
        )}
        <div className="a-actions a-span-all">
          <button className="a-btn a-btn-primary" disabled={pending}>
            {pending ? "Saqlanmoqda…" : values.id ? "Saqlash" : "Yaratish va zalga o'tish"}
          </button>
        </div>
      </div>
    </form>
  );
}
