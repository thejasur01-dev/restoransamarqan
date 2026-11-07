"use client";

import { useActionState } from "react";
import { deleteCategoryAction, saveCategoryAction } from "@/app/admin/_actions/events";

type Category = { id: number; name: string; price: number; color: string; seats: number };

function Row({ eventId, category }: { eventId: number; category?: Category }) {
  const [state, action, pending] = useActionState(saveCategoryAction, null);
  return (
    <form action={action} className="a-actions" style={{ alignItems: "flex-end", marginBottom: 10 }}>
      <input type="hidden" name="eventId" value={eventId} />
      {category && <input type="hidden" name="id" value={category.id} />}
      <label className="a-field" style={{ width: 70 }}>
        <span>Rang</span>
        <input type="color" name="color" defaultValue={category?.color ?? "#e00d0d"} style={{ width: 70, height: 38, padding: 2, border: "1px solid #cfd7d6", borderRadius: 6 }} />
      </label>
      <label className="a-field" style={{ flex: "1 1 180px" }}>
        <span>Nomi</span>
        <input className="a-input" name="name" defaultValue={category?.name} required maxLength={60} placeholder="Masalan: VIP stol" />
      </label>
      <label className="a-field" style={{ width: 160 }}>
        <span>Narx (so&apos;m)</span>
        <input className="a-input" type="number" name="price" min={0} step={1000} defaultValue={category?.price} required />
      </label>
      <button className={`a-btn ${category ? "" : "a-btn-primary"}`} disabled={pending}>
        {category ? "Saqlash" : "+ Qo'shish"}
      </button>
      {category && (
        <button
          className="a-btn a-btn-danger"
          formAction={deleteCategoryAction}
          formNoValidate
          disabled={category.seats > 0}
          title={category.seats > 0 ? "Bu toifada o'rindiqlar bor" : undefined}
        >
          O&apos;chirish
        </button>
      )}
      {category && <small style={{ color: "var(--a-muted)", alignSelf: "center" }}>{category.seats} ta o&apos;rin</small>}
      {state?.error && <small style={{ color: "var(--a-red)", width: "100%" }}>{state.error}</small>}
      {state?.ok && <small style={{ color: "var(--a-green)", width: "100%" }}>{state.ok}</small>}
    </form>
  );
}

export function CategoryEditor({ eventId, categories }: { eventId: number; categories: Category[] }) {
  return (
    <div className="a-card">
      <h2>Narx toifalari</h2>
      {categories.map((c) => (
        <Row key={c.id} eventId={eventId} category={c} />
      ))}
      <Row key={`new-${categories.length}`} eventId={eventId} />
      <small style={{ color: "var(--a-muted)" }}>Narx o&apos;zgarsa, yangi xaridlarga qo&apos;llanadi. To&apos;langan buyurtmalar o&apos;z narxida qoladi.</small>
    </div>
  );
}
