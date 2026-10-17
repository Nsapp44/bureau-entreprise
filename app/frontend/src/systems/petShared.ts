/**
 * Etat partage entre le chien et les chats (aucune dependance React/Pixi) :
 * - `petShared.catsPlaying` : les chats jouent, le chien peut les rejoindre ;
 * - `longWorkers` : agents qui travaillent depuis assez longtemps pour attirer
 *   la visite des animaux.
 */

import type { Vec2 } from "./dogBehavior";

/** Un agent qui travaille depuis cette duree attire les animaux (agents < 5 min). */
export const LONG_WORK_MS = 90_000;

export const petShared = { catsPlaying: false };

interface WorkerLike {
  id: string;
  backendState: string;
  currentPosition: Vec2;
}

/**
 * Met a jour `since` (id -> debut du travail en cours) et renvoie les positions
 * des agents qui travaillent depuis au moins `LONG_WORK_MS`.
 */
export function longWorkers(
  since: Map<string, number>,
  agents: Iterable<WorkerLike>,
  now: number,
): Vec2[] {
  const out: Vec2[] = [];
  const seen = new Set<string>();
  for (const a of agents) {
    if (a.backendState !== "working" && a.backendState !== "thinking") continue;
    seen.add(a.id);
    const start = since.get(a.id) ?? now;
    since.set(a.id, start);
    if (now - start >= LONG_WORK_MS) out.push(a.currentPosition);
  }
  for (const id of Array.from(since.keys())) {
    if (!seen.has(id)) since.delete(id);
  }
  return out;
}
