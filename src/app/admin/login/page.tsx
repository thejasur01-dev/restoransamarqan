import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Kirish" };

export default function AdminLoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="a-card" style={{ width: 380, maxWidth: "100%", padding: "30px 28px" }}>
        <p style={{ fontFamily: "var(--font-logo), cursive", fontSize: 32, color: "var(--a-brand)", textAlign: "center" }}>Chipta</p>
        <h1 style={{ margin: "6px 0 22px", fontSize: 18, textAlign: "center", color: "var(--a-muted)", fontWeight: 400 }}>Admin panelga kirish</h1>
        <LoginForm />
      </div>
    </div>
  );
}
