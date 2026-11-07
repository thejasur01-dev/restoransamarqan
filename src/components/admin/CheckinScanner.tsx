"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Result = {
  ok: boolean;
  message?: string;
  seat?: string;
  event?: string;
  usedAt?: string;
  orderNumber?: number;
  stats?: { inside: number; sold: number } | null;
};

type Event = { id: number; label: string };

const time = (iso: string) => new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Phone-camera QR scanner for the door, with manual code entry as a fallback. */
export function CheckinScanner({ events }: { events: Event[] }) {
  const [eventId, setEventId] = useState<number | null>(events[0]?.id ?? null);
  const [result, setResult] = useState<(Result & { code: string }) | null>(null);
  const [history, setHistory] = useState<Array<Result & { code: string; at: number }>>([]);
  const [stats, setStats] = useState<Result["stats"]>(null);
  const [camera, setCamera] = useState<"off" | "starting" | "on" | "error">("off");
  const [manual, setManual] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const busy = useRef(false);
  const lastCode = useRef<{ code: string; at: number } | null>(null);

  const check = useCallback(
    async (code: string) => {
      if (busy.current) return;
      // The same QR stays in front of the camera for a while: ignore repeats for 4 s
      const now = Date.now();
      if (lastCode.current && lastCode.current.code === code && now - lastCode.current.at < 4000) return;
      lastCode.current = { code, at: now };
      busy.current = true;
      try {
        const res = await fetch("/api/admin/checkin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code, eventId }),
        });
        const data: Result = await res.json();
        setResult({ ...data, code });
        setHistory((h) => [{ ...data, code, at: now }, ...h].slice(0, 30));
        if (data.stats) setStats(data.stats);
        navigator.vibrate?.(data.ok ? 80 : [60, 60, 60]);
      } catch {
        setResult({ ok: false, message: "Internet aloqasi yo'q — qayta urinib ko'ring", code });
      } finally {
        busy.current = false;
      }
    },
    [eventId],
  );

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    setCamera("off");
  }, []);

  async function start() {
    setCamera("starting");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play();
      }
      setCamera("on");
    } catch {
      setCamera("error");
    }
  }

  // Decode frames while the camera is on
  useEffect(() => {
    if (camera !== "on") return;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let decode: ((data: Uint8ClampedArray, w: number, h: number) => { data: string } | null) | null = null;
    import("jsqr").then((m) => (decode = m.default as typeof decode));

    const tick = () => {
      if (cancelled) return;
      const v = video.current;
      if (v && ctx && decode && v.readyState >= 2) {
        // Downscale for speed; QR codes on a phone screen are large enough
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = decode(img.data, img.width, img.height);
        if (found?.data) check(found.data);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [camera, check]);

  useEffect(() => stop, [stop]);

  const tone = result ? (result.ok ? "#13824b" : result.message?.includes("ishlatilgan") ? "#b07800" : "#d64545") : "#6b7776";

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="a-card">
        <label className="a-field">
          <span>Tadbir</span>
          <select value={eventId ?? ""} onChange={(e) => setEventId(Number(e.target.value) || null)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
            <option value="">Har qanday tadbir</option>
          </select>
        </label>
        {stats && (
          <p style={{ marginTop: 10, fontSize: 15 }}>
            Kirganlar: <b>{stats.inside}</b> / {stats.sold}
          </p>
        )}
      </div>

      <div className="a-card" style={{ textAlign: "center" }}>
        <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 8, background: "#000", display: camera === "on" ? "block" : "none", maxHeight: 360, objectFit: "cover" }} />
        {camera !== "on" && (
          <button type="button" className="a-btn a-btn-primary" style={{ height: 52, width: "100%", fontSize: 16 }} onClick={start} disabled={camera === "starting"}>
            {camera === "starting" ? "Kamera ochilmoqda…" : "📷 Kamerani yoqish"}
          </button>
        )}
        {camera === "on" && (
          <button type="button" className="a-btn" style={{ marginTop: 10 }} onClick={stop}>
            Kamerani o&apos;chirish
          </button>
        )}
        {camera === "error" && (
          <p className="a-error" style={{ marginTop: 10 }}>
            Kameraga ruxsat berilmadi. Brauzer sozlamalarida ruxsat bering yoki kodni qo&apos;lda kiriting. Kamera faqat HTTPS saytda ishlaydi.
          </p>
        )}

        <form
          className="a-actions"
          style={{ marginTop: 14 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) {
              lastCode.current = null;
              check(manual.trim());
              setManual("");
            }
          }}
        >
          <input
            className="a-input a-mono"
            style={{ flex: 1, textTransform: "uppercase", fontSize: 18, letterSpacing: 1 }}
            placeholder="XXXXX-XXXXX"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
            maxLength={20}
          />
          <button className="a-btn">Tekshirish</button>
        </form>
      </div>

      {result && (
        <div className="a-card" role="status" style={{ borderColor: tone, borderWidth: 3, textAlign: "center" }}>
          <p style={{ fontSize: 44, lineHeight: 1 }}>{result.ok ? "✅" : result.message?.includes("ishlatilgan") ? "⚠️" : "⛔"}</p>
          <p style={{ fontSize: 22, fontWeight: 500, color: tone, marginTop: 8 }}>{result.ok ? "Kirish mumkin" : result.message}</p>
          {result.seat && <p style={{ fontSize: 18, marginTop: 6 }}>{result.seat}</p>}
          {result.usedAt && <p style={{ color: "var(--a-muted)" }}>Kirgan vaqti: {time(result.usedAt)}</p>}
          {result.event && <p style={{ color: "var(--a-muted)" }}>{result.event}</p>}
        </div>
      )}

      {history.length > 0 && (
        <div className="a-card">
          <h2>So&apos;nggi tekshiruvlar</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
            {history.map((h, i) => (
              <li key={i} style={{ padding: "6px 0", borderBottom: "1px solid #eef1f1", display: "flex", gap: 10 }}>
                <span>{h.ok ? "✅" : "⛔"}</span>
                <span className="a-mono">{h.code.slice(-11)}</span>
                <span style={{ color: "var(--a-muted)" }}>{h.ok ? h.seat : h.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
