"use client";

import { useSearchParams } from "next/navigation";
import styles from "./SearchForm.module.css";

function Form({ defaultValue }: { defaultValue: string }) {
  return (
    // Plain GET form: works before hydration and gives shareable /?q= URLs
    <form className={styles.form} action="/" method="get" role="search">
      <input
        className={styles.input}
        type="search"
        name="q"
        defaultValue={defaultValue}
        maxLength={100}
        autoComplete="off"
        aria-label="Tadbirlarni qidirish"
      />
      <button className={styles.button} type="submit" aria-label="Qidirish">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="14" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.8" />
          <path d="M8.8 15.2 3 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </form>
  );
}

export function SearchForm() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  // key resets the uncontrolled input when navigating between searches
  return <Form key={q} defaultValue={q} />;
}

export function SearchFormFallback() {
  return <Form defaultValue="" />;
}
