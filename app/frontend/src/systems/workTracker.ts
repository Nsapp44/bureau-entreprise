/**
 * Temps de travail par prénom d'agent, sur la journée locale.
 *
 * Le backend ne sait pas attribuer les tokens à un agent du bureau (les
 * sous-agents sont comptés dans leur session parente) : on mesure donc le
 * temps passé à travailler, tant que le bureau est ouvert. Module pur ;
 * le branchement (intervalle, localStorage) est dans hooks/useWorkTracker.
 */

import type { AgentState as BackendAgentState } from "@/types";

/** États qui comptent comme du travail. */
const WORKING_STATES: ReadonlySet<string> = new Set(["working", "thinking"]);

export interface WorkLog {
  /** Jour local au format AAAA-MM-JJ. */
  date: string;
  /** Secondes de travail par prénom. */
  seconds: Record<string, number>;
}

export interface TrackedAgent {
  name: string | null;
  state: BackendAgentState;
}

export function localDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function emptyLog(now: Date): WorkLog {
  return { date: localDateKey(now), seconds: {} };
}

/** Prénom propre (première lettre en majuscule), ou null s'il n'y en a pas. */
export function firstName(name: string | null): string | null {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Ajoute `dtSec` secondes à chaque agent qui travaille. Repart de zéro si le
 * jour a changé. Renvoie le même objet quand rien n'a changé.
 */
export function accumulate(
  log: WorkLog,
  agents: readonly TrackedAgent[],
  dtSec: number,
  now: Date,
): WorkLog {
  const today = localDateKey(now);
  const base = log.date === today ? log : emptyLog(now);
  let next: WorkLog | null = base === log ? null : base;
  if (dtSec <= 0) return next ?? log;
  for (const agent of agents) {
    const name = firstName(agent.name);
    if (!name || !WORKING_STATES.has(agent.state)) continue;
    if (!next) next = { date: base.date, seconds: { ...base.seconds } };
    next.seconds[name] = (next.seconds[name] ?? 0) + dtSec;
  }
  return next ?? log;
}

/** L'agent qui a le plus travaillé aujourd'hui, ou null si personne. */
export function topWorker(
  log: WorkLog,
): { name: string; seconds: number } | null {
  let best: { name: string; seconds: number } | null = null;
  for (const [name, seconds] of Object.entries(log.seconds)) {
    if (seconds > 0 && (!best || seconds > best.seconds)) {
      best = { name, seconds };
    }
  }
  return best;
}

/** Classement décroissant (égalité : ordre alphabétique). */
export function ranking(
  log: WorkLog,
): Array<{ name: string; seconds: number }> {
  return Object.entries(log.seconds)
    .filter(([, s]) => s > 0)
    .map(([name, seconds]) => ({ name, seconds }))
    .sort((a, b) => b.seconds - a.seconds || a.name.localeCompare(b.name));
}

/** 45 -> "45 s", 125 -> "2 min", 4000 -> "1 h 07". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")}`;
}

export const WORK_LOG_STORAGE_KEY = "office.workLog";

export function parseLog(raw: string | null, now: Date): WorkLog {
  if (!raw) return emptyLog(now);
  try {
    const data = JSON.parse(raw) as Partial<WorkLog>;
    if (data.date !== localDateKey(now) || typeof data.seconds !== "object") {
      return emptyLog(now);
    }
    const seconds: Record<string, number> = {};
    for (const [k, v] of Object.entries(data.seconds ?? {})) {
      if (typeof v === "number" && Number.isFinite(v) && v > 0) seconds[k] = v;
    }
    return { date: data.date, seconds };
  } catch {
    return emptyLog(now);
  }
}
