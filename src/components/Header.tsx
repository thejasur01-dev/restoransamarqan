import Link from "next/link";
import { Suspense } from "react";
import { site } from "@/lib/site";
import { Logo } from "./Logo";
import { SearchForm, SearchFormFallback } from "./SearchForm";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <div className={`wrapper ${styles.inner}`}>
        <div className={styles.logo}>
          <Logo />
        </div>
        <p className={styles.tagline}>
          {site.tagline[0]}
          <br />
          {site.tagline[1]}
        </p>
        {site.features.phoneLogin && (
          <Link href="/my" className={styles.myTickets}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M3 7.5V5h18v2.5a2.5 2.5 0 0 0 0 5V15h0v4H3v-6.5a2.5 2.5 0 0 0 0-5Z" strokeLinejoin="round" />
              <path d="M14 5v14" strokeDasharray="2 2" />
            </svg>
            <span>Mening chiptalarim</span>
          </Link>
        )}
        <div className={styles.search}>
          {/* The query is read from the URL on the client; the fallback is the same empty form */}
          <Suspense fallback={<SearchFormFallback />}>
            <SearchForm />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
