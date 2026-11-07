"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Seconds left until `deadline`, corrected for the difference between the visitor's
 * clock and the server's (`clockOffset` = serverNow - Date.now() at the time of the response).
 * `onExpire` fires once per deadline when it is reached.
 */
export function useCountdown(deadline: string | null, clockOffset: number, onExpire?: () => void) {
  const [now, setNow] = useState(() => Date.now());
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!deadline) return;
    const end = new Date(deadline).getTime();
    let fired = false;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (!fired && end - (t + clockOffset) <= 0) {
        fired = true;
        onExpireRef.current?.();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [deadline, clockOffset]);

  if (!deadline) return null;
  return Math.max(0, Math.round((new Date(deadline).getTime() - (now + clockOffset)) / 1000));
}

export function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
