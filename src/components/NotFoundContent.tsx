import Link from "next/link";

export function NotFoundContent() {
  return (
    <div className="wrapper" style={{ padding: "115px 16px 120px" }}>
      <h1 style={{ color: "var(--c-text)", fontSize: 36, fontWeight: 500, marginBottom: 20 }}>Sahifa topilmadi</h1>
      <p style={{ color: "var(--c-text-2)", fontSize: 18, marginBottom: 30 }}>
        Tadbir o&apos;chirilgan yoki havola noto&apos;g&apos;ri bo&apos;lishi mumkin.
      </p>
      <Link href="/" className="btn">
        Barcha tadbirlar
      </Link>
    </div>
  );
}
