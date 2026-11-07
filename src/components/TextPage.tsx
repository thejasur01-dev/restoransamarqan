export function TextPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="wrapper" style={{ padding: "80px 16px 100px" }}>
      <div style={{ maxWidth: 820, background: "#fff", padding: "48px 56px", boxShadow: "var(--shadow-card)" }}>
        <h1 style={{ color: "var(--c-text)", fontSize: 36, fontWeight: 500, marginBottom: 24 }}>{title}</h1>
        <div style={{ color: "var(--c-text-2)", fontSize: 18, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
