import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { OrganizerForm } from "@/components/admin/OrganizerForm";
import { requireAdminPage } from "@/lib/admin/auth";
import { deleteOrganizerAction } from "@/app/admin/_actions/organizers";

export const metadata: Metadata = { title: "Tashkilotchi" };

async function EditOrganizer({ params, searchParams }: PageProps<"/admin/organizers/[id]">) {
  await requireAdminPage("organizers");
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id)) notFound();
  const [o] = await db.select().from(schema.organizers).where(eq(schema.organizers.id, id));
  if (!o) notFound();

  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/organizers">Tashkilotchilar</Link> / {o.name}
      </p>
      <div className="a-head">
        <h1>{o.name}</h1>
      </div>
      {sp.error === "in_use" && (
        <p className="a-error" style={{ marginBottom: 16 }}>
          Bu tashkilotchining tadbirlari bor — o&apos;chirib bo&apos;lmaydi.
        </p>
      )}
      <OrganizerForm values={{ id: o.id, name: o.name, legalName: o.legalName, inn: o.inn ?? "", phone: o.phone ?? "", email: o.email ?? "" }} />
      <div className="a-card">
        <form action={deleteOrganizerAction}>
          <input type="hidden" name="id" value={o.id} />
          <ConfirmButton message={`"${o.name}" o'chirilsinmi?`} className="a-btn a-btn-danger">
            O&apos;chirish
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}

export default function EditOrganizerPage(props: PageProps<"/admin/organizers/[id]">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <EditOrganizer {...props} />
    </Suspense>
  );
}
