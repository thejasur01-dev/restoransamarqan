import styles from "./ListSkeleton.module.css";

export function ListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <div className={styles.title} />
      <div className={styles.grid}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.media} />
            <div className={styles.line} />
            <div className={`${styles.line} ${styles.short}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
