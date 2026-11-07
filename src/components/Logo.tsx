import Link from "next/link";
import { site } from "@/lib/site";
import styles from "./Logo.module.css";

export function Logo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const [first, ...rest] = site.name;
  return (
    <Link href="/" className={`${styles.logo} ${styles[size]}`} aria-label={`${site.name} — bosh sahifa`}>
      <span className={styles.initial}>{first}</span>
      {rest.join("")}
    </Link>
  );
}
