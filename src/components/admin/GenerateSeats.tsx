"use client";

import { useActionState } from "react";
import { generateSeatsAction } from "@/app/admin/_actions/events";

type Block = { id: string; label: string; seats: number };

export function GenerateSeats({
  eventId,
  blocks,
  categories,
  existingSeats,
  locked,
}: {
  eventId: number;
  blocks: Block[];
  categories: Array<{ id: number; name: string }>;
  existingSeats: number;
  locked: boolean;
}) {
  const [state, action, pending] = useActionState(generateSeatsAction, null);

  if (locked) {
    return (
      <p className="a-note">
        Sotuv boshlangan — zalni qayta yaratib bo&apos;lmaydi. O&apos;rindiqlarni pastdagi sxemada tahrirlang.
      </p>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (existingSeats > 0 && !confirm(`Mavjud ${existingSeats} ta o'rindiq o'chirilib, qaytadan yaratiladi. Davom etasizmi?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="eventId" value={eventId} />
      <p style={{ color: "var(--a-muted)", marginBottom: 12 }}>Joy sxemasidagi har bir blok qaysi narx toifasida sotilishini tanlang:</p>
      <div className="a-form a-form-3" style={{ marginBottom: 14 }}>
        {blocks.map((b) => (
          <label key={b.id} className="a-field">
            <span>
              {b.label} · {b.seats} ta o&apos;rin
            </span>
            <select name={`block:${b.id}`} required defaultValue={categories[0]?.id}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
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
      <button className="a-btn a-btn-primary" disabled={pending || categories.length === 0}>
        {pending ? "Yaratilmoqda…" : existingSeats > 0 ? "Zalni qayta yaratish" : "O'rindiqlarni yaratish"}
      </button>
    </form>
  );
}
