import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { Spinner } from "@/components/Spinner";
import { formatEventDate, formatPrice } from "@/lib/format";
import { formatUzPhone } from "@/lib/phone";
import { formatTicketCode, getOrder } from "@/lib/seating";
import { site } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Buyurtma", robots: { index: false, follow: false } };

async function Tickets({ items, title }: { items: Array<{ row: string; place: string; section: string; ticketCode: string | null }>; title: string }) {
  const tickets = await Promise.all(
    items
      .filter((i) => i.ticketCode)
      .map(async (i) => ({
        ...i,
        // Generated from our own A-Z/2-9 code, so the SVG markup is safe to inline
        svg: await QRCode.toString(i.ticketCode!, { type: "svg", margin: 1, errorCorrectionLevel: "M" }),
      })),
  );
  return (
    <div className={styles.tickets}>
      {tickets.map((t) => (
        <figure key={t.ticketCode} className={styles.ticket}>
          <div className={styles.qr} role="img" aria-label={`QR-kod: ${formatTicketCode(t.ticketCode!)}`} dangerouslySetInnerHTML={{ __html: t.svg }} />
          <figcaption>
            <b>{title}</b>
            <span>
              {t.row}-qator, {t.place}-o&apos;rin · {t.section}
            </span>
            <code>{formatTicketCode(t.ticketCode!)}</code>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function Order({ params }: { params: PageProps<"/order/[id]">["params"] }) {
  const { id } = await params;
  // The unguessable order id is what grants access to this page
  if (!UUID.test(id)) notFound();
  const order = await getOrder(id);
  if (!order) notFound();

  const state = order.status === "paid" ? "paid" : order.status === "pending" && !order.expired ? "pending" : "closed";

  return (
    <div className={styles.panel}>
      <p className={styles.number}>Buyurtma № {order.number}</p>

      {state === "paid" && (
        <>
          <h1 className={styles.title}>To&apos;lov qabul qilindi</h1>
          <p className={styles.text}>
            Kirishda chipta QR-kodini ko&apos;rsating.
            {site.features.phoneLogin ? (
              <>
                {" "}
                Chiptalar doim <Link href="/my">«Mening chiptalarim»</Link> bo&apos;limida turadi.
              </>
            ) : (
              " Bu sahifa havolasini saqlab qo'ying."
            )}
          </p>
        </>
      )}
      {state === "pending" && (
        <>
          <h1 className={styles.title}>Buyurtma qabul qilindi</h1>
          <div className={styles.notice}>
            <b>To&apos;lov kutilmoqda.</b> Onlayn to&apos;lov tizimi tez orada ulanadi. O&apos;rinlaringiz{" "}
            {new Intl.DateTimeFormat("uz-Latn-UZ", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(order.expiresAt)}{" "}
            gacha saqlanadi.
          </div>
        </>
      )}
      {state === "closed" && (
        <>
          <h1 className={styles.title}>Buyurtma muddati tugagan</h1>
          <p className={styles.text}>To&apos;lov o&apos;z vaqtida amalga oshirilmagani uchun o&apos;rinlar bo&apos;shatildi.</p>
        </>
      )}

      <div className={styles.event}>
        <Link href={`/e/${order.event.slug}`}>{order.event.title}</Link>
        <p>
          {formatEventDate(order.event.startsAt)} · {order.event.venueName}, {order.event.city}, {order.event.address}
        </p>
      </div>

      {state === "paid" && <Tickets items={order.items} title={order.event.title} />}

      <ul className={styles.items}>
        {order.items.map((i, idx) => (
          <li key={idx}>
            <span>
              {i.row}-qator, {i.place}-o&apos;rin <small>{i.section}</small>
            </span>
            <span>{formatPrice(i.price)}</span>
          </li>
        ))}
      </ul>
      <p className={styles.total}>
        <span>Jami</span>
        <b>{formatPrice(order.total)}</b>
      </p>

      <p className={styles.contact}>
        {order.email} · {formatUzPhone(order.phone)}
      </p>

      {state === "closed" && (
        <Link href={`/e/${order.event.slug}/buy`} className="btn">
          Qaytadan tanlash
        </Link>
      )}
    </div>
  );
}

export default function OrderPage({ params }: PageProps<"/order/[id]">) {
  return (
    <div className={styles.page}>
      <Suspense fallback={<Spinner />}>
        <Order params={params} />
      </Suspense>
    </div>
  );
}
