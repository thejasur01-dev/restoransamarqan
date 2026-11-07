export function Spinner() {
  return (
    <div role="status" aria-label="Yuklanmoqda" style={{ display: "grid", placeItems: "center", minHeight: 320 }}>
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#d6efec" strokeWidth="3" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="var(--c-brand)" strokeWidth="3" strokeDasharray="40 126" strokeLinecap="round">
          <animateTransform attributeName="transform" type="rotate" from="0 24 24" to="360 24 24" dur="0.9s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}
