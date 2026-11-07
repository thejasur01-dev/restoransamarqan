import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { can, getAdmin, type Permission } from "@/lib/admin/auth";
import { logoutAction } from "../_actions/auth";

const ROLE_NAMES = { owner: "Egasi", manager: "Menejer", checker: "Nazoratchi" } as const;

const NAV: Array<{ href: string; label: string; icon: string; permission: Permission }> = [
  { href: "/admin", label: "Hisobotlar", icon: "📊", permission: "reports" },
  { href: "/admin/events", label: "Tadbirlar", icon: "🎫", permission: "events" },
  { href: "/admin/orders", label: "Buyurtmalar", icon: "🧾", permission: "orders" },
  { href: "/admin/checkin", label: "Chipta tekshirish", icon: "📷", permission: "checkin" },
  { href: "/admin/venues", label: "Joylar va zallar", icon: "🏛", permission: "venues" },
  { href: "/admin/organizers", label: "Tashkilotchilar", icon: "🏢", permission: "organizers" },
  { href: "/admin/admins", label: "Adminlar", icon: "👤", permission: "admins" },
  { href: "/admin/audit", label: "Amallar jurnali", icon: "🗂", permission: "audit" },
];

async function Shell({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  const items = NAV.filter((n) => can(admin, n.permission)).map(({ permission: _p, ...rest }) => rest);

  return (
    <AdminNav
      items={items}
      footer={
        <div className="a-side-foot">
          <b>{admin.name}</b>
          <span>{ROLE_NAMES[admin.role]}</span>
          <div className="a-actions" style={{ marginTop: 8 }}>
            <a href="/admin/profile">Profil</a>
            <form action={logoutAction}>
              <button style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "inherit", textDecoration: "underline" }}>Chiqish</button>
            </form>
          </div>
        </div>
      }
    >
      {children}
    </AdminNav>
  );
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="a-main">Yuklanmoqda…</div>}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
