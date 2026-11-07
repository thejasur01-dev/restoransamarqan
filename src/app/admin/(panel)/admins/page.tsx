import type { Metadata } from "next";
import { Suspense } from "react";
import { asc } from "drizzle-orm";
import { db, schema } from "@/db";
import { AdminRow, CreateAdminForm } from "@/components/admin/AdminsClient";
import { dateTime } from "@/components/admin/format";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Adminlar" };

async function Admins() {
  const me = await requireAdminPage("admins");
  const { admins } = schema;
  const rows = await db
    .select({ id: admins.id, email: admins.email, name: admins.name, role: admins.role, active: admins.active, lastLoginAt: admins.lastLoginAt })
    .from(admins)
    .orderBy(asc(admins.name));

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Adminlar</h1>
          <p>Rol yoki holat o&apos;zgarsa, admin tizimdan chiqariladi va yangi huquqlar darhol ishlaydi.</p>
        </div>
      </div>
      <CreateAdminForm />
      <div className="a-table-wrap" style={{ marginTop: 16 }}>
        <table className="a-table">
          <thead>
            <tr>
              <th>Admin</th>
              <th>Oxirgi kirish</th>
              <th colSpan={2}>Rol va holat</th>
              <th>Parol</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <AdminRow key={a.id} isMe={a.id === me.id} admin={{ id: a.id, email: a.email, name: a.name, role: a.role, active: a.active, lastLogin: dateTime(a.lastLoginAt) }} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function AdminsPage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Admins />
    </Suspense>
  );
}
