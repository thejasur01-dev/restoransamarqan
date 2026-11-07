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
