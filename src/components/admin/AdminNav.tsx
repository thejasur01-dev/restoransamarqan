"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = { href: string; label: string; icon: string };

export function AdminNav({ items, footer, children }: { items: Item[]; footer: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <div className="a-shell" data-menu={open ? "open" : "closed"}>
      <aside className="a-side">
        <Link href="/admin" className="a-brand" onClick={() => setOpen(false)}>
          Chipta
          <small>Admin panel</small>
        </Link>
        <nav className="a-nav" aria-label="Admin menyusi">
          {items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={active(i.href) ? "page" : undefined} onClick={() => setOpen(false)}>
              <span aria-hidden="true">{i.icon}</span>
              {i.label}
            </Link>
          ))}
          <a href="/" target="_blank" rel="noopener">
            <span aria-hidden="true">↗</span>
            Saytni ochish
          </a>
        </nav>
        {footer}
      </aside>
      <div>
        <div className="a-mobilebar">
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Menyu">
            ☰
          </button>
          <b>Admin panel</b>
        </div>
        <main className="a-main">{children}</main>
      </div>
    </div>
  );
}
