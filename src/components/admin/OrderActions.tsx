"use client";

import { useActionState } from "react";
import { cancelOrderAction, markPaidAction, updateContactsAction } from "@/app/admin/_actions/orders";

export function ContactsForm({ orderId, phone, email, comment }: { orderId: string; phone: string; email: string; comment: string }) {
  const [state, action, pending] = useActionState(updateContactsAction, null);
  return (
    <form action={action} className="a-form a-form-3">
      <input type="hidden" name="orderId" value={orderId} />
      <label className="a-field">
        <span>Telefon</span>
        <input className="a-input" name="phone" defaultValue={phone} required maxLength={40} />
      </label>
      <label className="a-field">
        <span>Email</span>
        <input className="a-input" name="email" type="email" defaultValue={email} maxLength={200} />
      </label>
      <label className="a-field">
        <span>Izoh</span>
        <input className="a-input" name="comment" defaultValue={comment} maxLength={500} />
      </label>
      {state?.error && <p className="a-error a-span-all">{state.error}</p>}
      {state?.ok && <p className="a-ok a-span-all">{state.ok}</p>}
      <div className="a-span-all">
        <button className="a-btn" disabled={pending}>
          {pending ? "Saqlanmoqda…" : "Kontaktlarni saqlash"}
        </button>
      </div>
    </form>
  );
}

export function StatusActions({ orderId, status, expired }: { orderId: string; status: string; expired: boolean }) {
  const [cancelState, cancel, cancelling] = useActionState(cancelOrderAction, null);
  const [paidState, markPaid, marking] = useActionState(markPaidAction, null);
  const state = cancelState ?? paidState;

  return (
    <div>
      <div className="a-actions">
        {status === "pending" && !expired && (
          <form action={markPaid} onSubmit={(e) => !confirm("To'lov olinganini tasdiqlaysizmi? Chiptalar darhol yaratiladi.") && e.preventDefault()}>
            <input type="hidden" name="orderId" value={orderId} />
            <button className="a-btn a-btn-primary" disabled={marking}>
              To&apos;lov olindi (qo&apos;lda)
            </button>
          </form>
        )}
        {(status === "pending" || status === "paid") && (
          <form
            action={cancel}
            onSubmit={(e) =>
              !confirm(status === "paid" ? "Buyurtma qaytarilsinmi? Chiptalar yaroqsiz bo'ladi, o'rinlar sotuvga qaytadi." : "Buyurtma bekor qilinsinmi?") && e.preventDefault()
            }
          >
            <input type="hidden" name="orderId" value={orderId} />
            <button className="a-btn a-btn-danger" disabled={cancelling}>
              {status === "paid" ? "Qaytarish (refund)" : "Bekor qilish"}
            </button>
          </form>
        )}
      </div>
      {state?.error && <p className="a-error" style={{ marginTop: 10 }}>{state.error}</p>}
      {state?.ok && <p className="a-ok" style={{ marginTop: 10 }}>{state.ok}</p>}
    </div>
  );
}
