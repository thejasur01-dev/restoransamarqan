import Link from "next/link";

export function EventTabs({ id, title, slug, active }: { id: number; title: string; slug: string; active: "info" | "seating" }) {
  return (
    <>
      <p className="a-crumbs">
        <Link href="/admin/events">Tadbirlar</Link> / {title}
      </p>
      <div className="a-head">
        <h1>{title}</h1>
        <div className="a-actions">
          <a className="a-btn" href={`/e/${slug}`} target="_blank" rel="noopener">
            Saytda ko&apos;rish ↗
          </a>
          <Link className="a-btn" href={`/admin/orders?event=${id}`}>
            Buyurtmalar
          </Link>
          <a className="a-btn" href={`/api/admin/export/attendees?event=${id}`}>
            ⬇ Mehmonlar ro&apos;yxati
          </a>
        </div>
      </div>
      <nav className="a-tabs">
        <Link href={`/admin/events/${id}`} aria-current={active === "info" ? "page" : undefined}>
          Ma&apos;lumotlar
        </Link>
        <Link href={`/admin/events/${id}/seating`} aria-current={active === "seating" ? "page" : undefined}>
          Narxlar va zal
        </Link>
      </nav>
    </>
  );
}
