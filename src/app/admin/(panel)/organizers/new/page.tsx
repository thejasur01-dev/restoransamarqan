import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrganizerForm } from "@/components/admin/OrganizerForm";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Yangi tashkilotchi" };

async function NewOrganizer() {
  await requireAdminPage("organizers");
  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/organizers">Tashkilotchilar</Link> / Yangi
      </p>
      <div className="a-head">
        <h1>Yangi tashkilotchi</h1>
      </div>
      <OrganizerForm values={{ name: "", legalName: "", inn: "", phone: "", email: "" }} />
    </>
  );
}

export default function NewOrganizerPage() {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <NewOrganizer />
    </Suspense>
  );
}
