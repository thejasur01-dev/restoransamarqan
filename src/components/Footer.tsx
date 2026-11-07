import Link from "next/link";
import { cacheLife } from "next/cache";
import { site } from "@/lib/site";
import { Logo } from "./Logo";
import styles from "./Footer.module.css";

const PAYMENT_METHODS = ["CLICK", "Payme", "UZCARD", "HUMO", "VISA", "Mastercard"];

function Socials() {
  return (
    <p className={styles.socials}>
      <a href={site.socials.telegram} target="_blank" rel="noopener noreferrer" aria-label="Telegram">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.9 4.3 18.7 19.5c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.2l-4.8-1.5c-1-.3-1-1 .2-1.5l18.9-7.3c.9-.3 1.6.2 1.4 1.4Z" />
        </svg>
      </a>
      <a href={site.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
        </svg>
      </a>
    </p>
  );
}

export async function Footer() {
  "use cache";
  cacheLife("days");
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className="wrapper">
        <Logo size="sm" />
        <div className={styles.cols}>
          <div className={`${styles.col} ${styles.col1}`}>
            <p className={styles.subtitle}>© {year}</p>
            <p className={styles.legal}>
              Ushbu saytdan foydalanib, siz <Link href={site.legalUrl}>foydalanish qoidalariga</Link> rozilik
              bildirasiz
            </p>
            <div className={styles.desktopOnly}>
              <Socials />
            </div>
          </div>
          <div className={`${styles.col} ${styles.col2}`}>
            <p className={styles.subtitle}>
              To&apos;lov <br className={styles.desktopBr} />
              usullari
            </p>
            <ul className={styles.payments} aria-label="Qabul qilinadigan to'lov usullari">
              {PAYMENT_METHODS.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
          <div className={`${styles.col} ${styles.col3}`}>
            <p className={styles.subtitle}>
              Ro&apos;yxatdan o&apos;ting <br className={styles.desktopBr} />
              va chipta soting
            </p>
            <Link href={site.registerUrl} className={`btn ${styles.register}`}>
              Ro&apos;yxatdan o&apos;tish
            </Link>
            <div className={styles.mobileOnly}>
              <Socials />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
