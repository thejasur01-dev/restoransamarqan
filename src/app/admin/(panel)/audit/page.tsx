import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { db, schema } from "@/db";
import { dateTime } from "@/components/admin/format";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = { title: "Amallar jurnali" };

const ENTITY_LINK: Record<string, (id: string) => string> = {
  event: (id) => `/admin/events/${id}`,
  order: (id) => `/admin/orders/${id}`,
  venue: (id) => `/admin/venues/${id}`,
  organizer: (id) => `/admin/organizers/${id}`,
};

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  await requireAdminPage("audit");
  const sp = await searchParams;
  const pick = (k: string) => ((Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "").trim();
  const entity = pick("entity");
  const before = Number(pick("before")) || null;
  const { adminAudit, admins } = schema;

  const where: SQL[] = [];
  if (entity) where.push(eq(adminAudit.entity, entity));
  if (before) where.push(lt(adminAudit.id, before));

  const rows = await db
    .select({ id: adminAudit.id, action: adminAudit.action, entity: adminAudit.entity, entityId: adminAudit.entityId, details: adminAudit.details, createdAt: adminAudit.createdAt, admin: admins.name })
    .from(adminAudit)
    .leftJoin(admins, eq(admins.id, adminAudit.adminId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(adminAudit.id))
    .limit(100);

  return (
    <>
      <div className="a-head">
        <div>
          <h1>Amallar jurnali</h1>
          <p>Kim, qachon va nimani o&apos;zgartirgani. Jurnal o&apos;zgartirilmaydi.</p>
        </div>
      </div>
      <form className="a-filters" method="get">
        <label className="a-field">
          <span>Obyekt</span>
          <select name="entity" defaultValue={entity}>
            <option value="">Barchasi</option>
            {["event", "order", "venue", "organizer", "price_category", "admin", "orders", "events", "attendees", "image"].map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <button className="a-btn">Ko&apos;rsatish</button>
      </form>
      <div className="a-table-wrap">
        <table className="a-table">
          <thead>
            <tr>
              <th>Vaqt</th>
              <th>Admin</th>
              <th>Amal</th>
              <th>Obyekt</th>
              <th>Tafsilotlar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dateTime(r.createdAt)}</td>
                <td>{r.admin ?? "—"}</td>
                <td>
                  <span className="a-badge">{r.action}</span>
                </td>
                <td>
                  {r.entityId && ENTITY_LINK[r.entity] ? <Link href={ENTITY_LINK[r.entity](r.entityId)}>{r.entity} #{r.entityId.slice(0, 8)}</Link> : `${r.entity}${r.entityId ? ` #${r.entityId.slice(0, 8)}` : ""}`}
                </td>
                <td className="wrap a-mono" style={{ fontSize: 12, color: "var(--a-muted)" }}>
                  {r.details ? JSON.stringify(r.details).slice(0, 200) : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 100 && (
        <div className="a-pager">
          <Link className="a-btn a-btn-sm" href={`?${new URLSearchParams({ ...(entity ? { entity } : {}), before: String(rows[rows.length - 1].id) })}`}>
            Eskiroqlari →
          </Link>
        </div>
      )}
    </>
  );
}

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}
