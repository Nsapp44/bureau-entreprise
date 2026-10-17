"use client";

/**
 * Mesure le temps de travail de chaque prénom d'agent pendant que le bureau
 * est ouvert, et le garde dans localStorage pour la journée en cours.
 * À monter une seule fois (dans le tableau blanc, toujours affiché).
 */

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import {
  WORK_LOG_STORAGE_KEY,
  accumulate,
  emptyLog,
  parseLog,
  type WorkLog,
} from "@/systems/workTracker";

const TICK_MS = 5000;
/** Un onglet endormi ne doit pas créditer des heures de travail d'un coup. */
const MAX_STEP_S = 15;

function readStored(now: Date): WorkLog {
  if (typeof window === "undefined") return emptyLog(now);
  try {
    return parseLog(window.localStorage.getItem(WORK_LOG_STORAGE_KEY), now);
  } catch {
    return emptyLog(now);
  }
}

function store(log: WorkLog): void {
  try {
    window.localStorage.setItem(WORK_LOG_STORAGE_KEY, JSON.stringify(log));
  } catch {
    // stockage indisponible : le suivi reste valable tant que la page est ouverte
  }
}

export function useWorkTracker(): WorkLog {
  const [log, setLog] = useState<WorkLog>(() => readStored(new Date()));
  const logRef = useRef(log);

  useEffect(() => {
    let current = logRef.current;
    let last = Date.now();
    const id = window.setInterval(() => {
      const nowMs = Date.now();
      const dt = Math.min((nowMs - last) / 1000, MAX_STEP_S);
      last = nowMs;
      const agents = Array.from(useGameStore.getState().agents.values()).map(
        (a) => ({ name: a.name, state: a.backendState }),
      );
      const next = accumulate(current, agents, dt, new Date(nowMs));
      if (next !== current) {
        current = next;
        store(next);
        setLog(next);
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  return log;
}
