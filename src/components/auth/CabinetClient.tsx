"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneLogin } from "./PhoneLogin";

export function CabinetLogin() {
  const router = useRouter();
  return (
    <PhoneLogin
      hint="Chipta sotib olishda tasdiqlagan telefon raqamingizni kiriting — barcha chiptalaringiz shu yerda."
      onVerified={() => router.refresh()}
    />
  );
}

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      style={{ padding: 0, border: 0, background: "none", color: "var(--c-brand)", cursor: "pointer", textDecoration: "underline", fontSize: "inherit" }}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        router.refresh();
      }}
    >
      Chiqish
    </button>
  );
}
