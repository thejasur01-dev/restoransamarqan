import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { ORDER_STATUS, dateTime, money } from "@/components/admin/format";
import { ContactsForm, StatusActions } from "@/components/admin/OrderActions";
import { requireAdminPage } from "@/lib/admin/auth";
import { formatTicketCode } from "@/lib/seating";

export const metadata: Metadata = { title: "Buyurtma" };

const { orders, orderItems, events, venues, eventSeats, priceCategories, adminAudit, admins } = schema;

async function OrderDetail({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdminPage("orders");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [order] = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      expired: sql<boolean>`${orders.status} = 'pending' and ${orders.expiresAt} <= now()`,
      total: orders.total,
      phone: orders.phone,
      email: orders.email,
      comment: orders.comment,
      createdAt: orders.createdAt,
      paidAt: orders.paidAt,
      expiresAt: orders.expiresAt,
      provider: orders.paymentProvider,
      txn: orders.providerTransactionId,
      eventId: events.id,
      eventTitle: events.title,
      eventSlug: events.slug,
      startsAt: events.startsAt,
      venue: venues.name,
    })
    .from(orders)
    .innerJoin(events, eq(events.id, orders.eventId))
    .innerJoin(venues, eq(venues.id, events.venueId))
    .where(eq(orders.id, id));
  if (!order) notFound();

  const [items, history] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        section: eventSeats.section,
        row: eventSeats.row,
        place: eventSeats.place,
        category: priceCategories.name,
        price: orderItems.price,
        code: orderItems.ticketCode,
        checkedInAt: orderItems.checkedInAt,
      })
      .from(orderItems)
      .innerJoin(eventSeats, eq(eventSeats.id, orderItems.seatId))
      .innerJoin(priceCategories, eq(priceCategories.id, eventSeats.priceCategoryId))
      .where(eq(orderItems.orderId, id))
      .orderBy(asc(eventSeats.id)),
    db
      .select({ action: adminAudit.action, createdAt: adminAudit.createdAt, admin: admins.name })
      .from(adminAudit)
      .leftJoin(admins, eq(admins.id, adminAudit.adminId))
      .where(sql`${adminAudit.entity} = 'order' and ${adminAudit.entityId} = ${id}`)
      .orderBy(desc(adminAudit.createdAt))
      .limit(20),
  ]);

  const st = order.expired ? ORDER_STATUS.expired : ORDER_STATUS[order.status];

  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/orders">Buyurtmalar</Link> / № {order.number}
      </p>
      <div className="a-head">
        <div>
          <h1>
            Buyurtma № {order.number} <span className={`a-badge ${st.cls}`}>{st.label}</span>
          </h1>
          <p>{money(order.total)}</p>
        </div>
        <div className="a-actions">
          <a className="a-btn" href={`/order/${order.id}`} target="_blank" rel="noopener">
            Mijoz sahifasi ↗
          </a>
        </div>
      </div>

      <div className="a-grid a-grid-2">
        <div className="a-card">
          <h2>Ma&apos;lumotlar</h2>
          <dl className="a-dl">
            <dt>Tadbir</dt>
            <dd>
              <Link href={`/admin/events/${order.eventId}`}>{order.eventTitle}</Link>
              <div style={{ color: "var(--a-muted)" }}>
                {dateTime(order.startsAt)} · {order.venue}
              </div>
            </dd>
            <dt>Yaratilgan</dt>
            <dd>{dateTime(order.createdAt)}</dd>
            <dt>To&apos;langan</dt>
            <dd>{dateTime(order.paidAt)}</dd>
            {order.status === "pending" && (
              <>
                <dt>Bron tugaydi</dt>
                <dd>{dateTime(order.expiresAt)}</dd>
              </>
            )}
            <dt>To&apos;lov tizimi</dt>
            <dd>{order.provider ?? "—"}</dd>
            <dt>Tranzaksiya</dt>
            <dd className="a-mono">{order.txn ?? "—"}</dd>
          </dl>
        </div>
        <div className="a-card">
          <h2>Amallar</h2>
          <StatusActions orderId={order.id} status={order.status} expired={order.expired} />
          <p style={{ color: "var(--a-muted)", fontSize: 13, marginTop: 12 }}>
            Qaytarishda pul avtomatik qaytmaydi — uni to&apos;lov tizimi (Click) kabinetidan qaytaring.
          </p>
        </div>
      </div>

      <div className="a-card">
        <h2>Xaridor kontaktlari</h2>
        <ContactsForm orderId={order.id} phone={order.phone} email={order.email ?? ""} comment={order.comment ?? ""} />
      </div>

      <div className="a-card">
        <h2>Chiptalar</h2>
        <div className="a-table-wrap" style={{ border: 0 }}>
          <table className="a-table">
            <thead>
              <tr>
                <th>O&apos;rin</th>
                <th>Toifa</th>
                <th>Chipta kodi</th>
                <th>Kirish</th>
                <th className="num">Narx</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.section}, {i.row}-qator, {i.place}-o&apos;rin
                  </td>
                  <td>{i.category}</td>
                  <td className="a-mono">{i.code ? formatTicketCode(i.code) : "—"}</td>
                  <td>{i.checkedInAt ? <span className="a-badge a-badge-green">Kirgan {dateTime(i.checkedInAt)}</span> : "—"}</td>
                  <td className="num">{money(i.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {history.length > 0 && (
        <div className="a-card">
          <h2>Tarix</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: "var(--a-muted)" }}>
            {history.map((h, i) => (
              <li key={i}>
                {dateTime(h.createdAt)} — {h.admin ?? "tizim"}: {h.action}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

export default function OrderPage(props: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<p>Yuklanmoqda…</p>}>
      <OrderDetail {...props} />
    </Suspense>
  );
}
