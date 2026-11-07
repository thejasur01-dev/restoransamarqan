import type { Metadata } from "next";
import { Suspense } from "react";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Profil" };

async function Profile() {
  const admin = await requireAdminPage("checkin");
  return (
    <>
      <div className="a-head">
        <div>
          <h1>Profil</h1>
          <p>
            {admin.name} · {admin.email}
          </p>
        </div>
      </div>
      <ChangePasswordForm />
    </>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Profile />
    </Suspense>
  );
}
