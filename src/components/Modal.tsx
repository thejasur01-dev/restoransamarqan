"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import styles from "./Modal.module.css";

export function Modal({ children, labelledBy }: { children: React.ReactNode; labelledBy: string }) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const previousFocus = document.activeElement as HTMLElement | null;
    // Compensate for the disappearing scrollbar so the page behind doesn't jump sideways
    const scrollbar = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`;
    panelRef.current?.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = "";
      root.style.paddingRight = "";
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [router]);

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      onMouseDown={(e) => {
        // Close only when the press starts on the backdrop itself, not when a text selection ends there
        if (e.target === overlayRef.current) router.back();
      }}
    >
      <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={labelledBy} tabIndex={-1}>
        <button type="button" className={styles.close} onClick={() => router.back()} aria-label="Yopish">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <path d="M4 4l22 22M26 4 4 26" stroke="currentColor" strokeWidth="2.6" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
}
