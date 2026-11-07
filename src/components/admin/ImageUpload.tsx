"use client";

import { useRef, useState } from "react";

/** Uploads a poster and keeps its URL in a hidden input named `name`. */
export function ImageUpload({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    if (file.size > 5 * 1024 * 1024) return setError("Rasm 5 MB dan katta bo'lmasin");
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? "Yuklab bo'lmadi");
      setUrl(data.url);
    } catch {
      setError("Internet aloqasini tekshiring");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="a-field">
      <span>Afisha rasmi</span>
      <input type="hidden" name={name} value={url} />
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div
          style={{
            width: 288,
            aspectRatio: "360 / 200",
            borderRadius: 6,
            background: url ? `#1d2b2a url("${url}") center / cover no-repeat` : "#eef1f1",
            display: "grid",
            placeItems: "center",
            color: "var(--a-muted)",
            border: "1px solid var(--a-border)",
          }}
        >
          {!url && "Rasm yo'q"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="a-btn" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Yuklanmoqda…" : url ? "Boshqa rasm" : "Rasm yuklash"}
          </button>
          <small>JPG, PNG yoki WEBP, 5 MB gacha. Tavsiya: 1080×600 px.</small>
          {error && <small style={{ color: "var(--a-red)" }}>{error}</small>}
        </div>
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
    </div>
  );
}
