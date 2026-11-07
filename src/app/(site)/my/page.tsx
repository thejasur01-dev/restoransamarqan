import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CabinetLogin, LogoutButton } from "@/components/auth/CabinetClient";
import { Spinner } from "@/components/Spinner";
import { getCurrentCustomer } from "@/lib/auth";
import { formatEventDate, formatPrice } from "@/lib/format";
import { formatUzPhone } from "@/lib/phone";
import { listCustomerOrders } from "@/lib/seating";
import { site } from "@/lib/site";
import styles from "./page.module.css";

export const metadata: Metadata = { title: "Mening chiptalarim", robots: { index: false, follow: false } };

type Order = Awaited<ReturnType<typeof listCustomerOrders>>[number];

function OrderCard({ order }: { order: Order }) {
  const status =
    order.status === "paid" ? { text: "To'langan", cls: styles.paid } : { text: "To'lov kutilmoqda", cls: styles.pending };
  return (
    <Link href={`/order/${order.id}`} className={styles.card}>
      <div className={styles.thumb}>
        <Image src={order.event.imageUrl} alt="" fill sizes="120px" unoptimized={order.event.imageUrl.endsWith(".svg")} />
      </div>
      <div className={styles.info}>
        <h3>{order.event.title}</h3>
        <p>
          {formatEventDate(order.event.startsAt)} · {order.event.venueName}, {order.event.city}
        </p>
        <p className={styles.meta}>
          <span className={status.cls}>{status.text}</span>
          <span>
            {order.tickets} ta chipta · {formatPrice(order.total)}
          </span>
        </p>
      </div>
    </Link>
  );
}

async function Cabinet() {
  if (!site.features.phoneLogin) notFound();
  const customer = await getCurrentCustomer();
  if (!customer) {
    return (
      <div className={styles.login}>
        <h1 className={styles.title}>Mening chiptalarim</h1>
        <CabinetLogin />
      </div>
    );
  }

  const orders = await listCustomerOrders(customer.id);
  const upcoming = orders.filter((o) => o.upcoming);
  const archive = orders.filter((o) => !o.upcoming && o.status === "paid");

  return (
    <>
      <div className={styles.head}>
        <h1 className={styles.title}>Mening chiptalarim</h1>
        <div className={styles.account}>
          <span>{formatUzPhone(customer.phone)}</span>
          <LogoutButton />
        </div>
      </div>

      <section aria-labelledby="upcoming">
        <h2 id="upcoming" className={styles.section}>
          Kelgusi tadbirlar
        </h2>
        {upcoming.length ? (
          <div className={styles.list}>
            {upcoming.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            Hozircha chiptalar yo&apos;q. <Link href="/">Afishani ko&apos;rish</Link>
          </p>
        )}
      </section>

      {archive.length > 0 && (
        <section aria-labelledby="archive">
          <h2 id="archive" className={styles.section}>
            Arxiv
          </h2>
          <div className={styles.list}>
            {archive.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export default function MyTicketsPage() {
  return (
    <div className={`wrapper ${styles.page}`}>
      <Suspense fallback={<Spinner />}>
        <Cabinet />
      </Suspense>
    </div>
  );
}
