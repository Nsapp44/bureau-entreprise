/**
 * Planificateur des sorties de bureau (pur, sans React/Pixi).
 *
 * - Café : un agent qui attend plus de 5 min va boire un café. En principe
 *   cela n'arrive jamais (un agent n'attend jamais plus de 5 min) : chaque
 *   café est donc une alerte, et le compteur sert de surveillance.
 * - Pause : sortie aléatoire vers le coin détente. Yanis sort plus souvent.
 */

import { pickNear, type DogGrid, type Rng } from "./dogBehavior";
import {
  COFFEE_MACHINE_POSITION,
  LOUNGE_POSITION,
} from "@/constants/positions";
import type { OutingKind } from "@/machines/agentMachineCommon";
import type { Position } from "@/types";

export const COFFEE_WAIT_MS = 5 * 60 * 1000;
/** Intervalle entre deux vérifications du planificateur. */
export const PLANNER_TICK_MS = 5000;
/** Probabilité de pause par vérification (~1 pause / 20 min en moyenne). */
export const BREAK_CHANCE_PER_TICK = 0.004;
/** Yanis sort ~3 fois plus souvent que les autres. */
export const YANIS_BREAK_FACTOR = 3;
/** Délai minimal entre deux sorties d'un même agent. */
export const OUTING_COOLDOWN_MS = 2 * 60 * 1000;

/** États backend où l'agent attend (au lieu de travailler). */
const WAITING_STATES = new Set(["waiting", "waiting_permission"]);

/** Point de départ de la recherche d'une case libre pour chaque sortie. */
const COFFEE_ANCHOR: Position = {
  x: COFFEE_MACHINE_POSITION.x,
  y: COFFEE_MACHINE_POSITION.y + 50,
};
const LOUNGE_ANCHOR: Position = {
  x: LOUNGE_POSITION.x + 110,
  y: LOUNGE_POSITION.y + 55,
};

export function breakChance(name: string | null): number {
  const isYanis = (name ?? "").trim().toLowerCase() === "yanis";
  return BREAK_CHANCE_PER_TICK * (isYanis ? YANIS_BREAK_FACTOR : 1);
}

/** Case libre où l'agent va se poster, ou null si rien de libre. */
export function pickOutingTarget(
  grid: DogGrid,
  kind: OutingKind,
  rng: Rng,
): Position | null {
  const anchor = kind === "coffee" ? COFFEE_ANCHOR : LOUNGE_ANCHOR;
  return pickNear(grid, anchor, rng, 6);
}

export interface PlannedAgent {
  id: string;
  name: string | null;
  phase: string;
  backendState: string;
}

export interface OutingPlan {
  coffee: string[];
  breaks: string[];
}

export class OutingPlanner {
  private waitingSince = new Map<string, number>();
  private lastOuting = new Map<string, number>();

  /** Appelée toutes les PLANNER_TICK_MS ; renvoie qui doit sortir. */
  tick(now: number, agents: PlannedAgent[], rng: Rng): OutingPlan {
    const plan: OutingPlan = { coffee: [], breaks: [] };
    const seen = new Set<string>();

    for (const agent of agents) {
      seen.add(agent.id);
      const atDesk = agent.phase === "idle";
      const waiting = WAITING_STATES.has(agent.backendState);

      if (!atDesk || !waiting) {
        this.waitingSince.delete(agent.id);
      } else if (!this.waitingSince.has(agent.id)) {
        this.waitingSince.set(agent.id, now);
      }
      if (!atDesk) continue;

      const last = this.lastOuting.get(agent.id);
      if (last !== undefined && now - last < OUTING_COOLDOWN_MS) continue;

      const since = this.waitingSince.get(agent.id);
      if (since !== undefined && now - since >= COFFEE_WAIT_MS) {
        plan.coffee.push(agent.id);
      } else if (rng() < breakChance(agent.name)) {
        plan.breaks.push(agent.id);
      }
    }

    for (const id of [...this.waitingSince.keys()]) {
      if (!seen.has(id)) this.waitingSince.delete(id);
    }
    for (const id of [...this.lastOuting.keys()]) {
      if (!seen.has(id)) this.lastOuting.delete(id);
    }
    return plan;
  }

  /** À appeler quand la sortie a vraiment démarré. */
  markOuting(agentId: string, now: number): void {
    this.lastOuting.set(agentId, now);
    this.waitingSince.delete(agentId);
  }
}
