"use client";

import { useEffect, useState } from "react";

/** Heure courante, rafraîchie toutes les `everyMs` (30 s par défaut). */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
