import { useEffect, useState } from "react";
import { darknessAt } from "@/components/game/city/timeUtils";

const REFRESH_MS = 60_000;

/** Obscurité courante (0 jour, 1 nuit) d'après l'heure du PC, relue chaque minute. */
export function useDarkness(): number {
  const [darkness, setDarkness] = useState(() => darknessAt(new Date()));
  useEffect(() => {
    const id = setInterval(
      () => setDarkness(darknessAt(new Date())),
      REFRESH_MS,
    );
    return () => clearInterval(id);
  }, []);
  return darkness;
}
