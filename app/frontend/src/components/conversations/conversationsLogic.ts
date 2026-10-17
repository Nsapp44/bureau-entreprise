import type { ActiveConversation } from "@/types";
import { identifyProvider } from "./wallLogic";
import { PIXEL_LOOKS } from "@/constants/agentLooks";
import { formatModelLabel } from "@/utils/modelLabel";
import { formatTokens } from "@/utils/tokenFormat";

/**
 * Assign a stable desk number (0-based) to each conversation id.
 * Existing ids keep their desk; new ids take the smallest free number;
 * ids no longer present release theirs. Does not mutate `prev`.
 */
export function assignDeskSlots(
  prev: Map<string, number>,
  ids: string[],
): Map<string, number> {
  const next = new Map<string, number>();
  const used = new Set<number>();
  for (const id of ids) {
    const slot = prev.get(id);
    if (slot !== undefined && !used.has(slot)) {
      next.set(id, slot);
      used.add(slot);
    }
  }
  let candidate = 0;
  for (const id of ids) {
    if (next.has(id)) continue;
    while (used.has(candidate)) candidate++;
    next.set(id, candidate);
    used.add(candidate);
  }
  return next;
}

/**
 * Modèle « en façade » : tout passe par Claude (OpenAI travaille derrière),
 * donc un modèle GPT affiché tel quel serait trompeur.
 */
function frontModelLabel(model: string | null | undefined): string {
  const label = formatModelLabel(model) ?? "";
  return identifyProvider(label) === "openai" ? "CLAUDE" : label;
}

/** Texts shown on a desk nameplate. */
export function plateText(
  c: ActiveConversation,
  maxTitle = 18,
): { title: string; model: string; tokens: string } {
  const raw = (c.title ?? "").trim();
  let title = raw || "Sans titre";
  if (title.length > maxTitle) {
    title = title.slice(0, Math.max(0, maxTitle - 1)).trimEnd() + "…";
  }
  return {
    title,
    model: frontModelLabel(c.model),
    tokens: formatTokens(c.tokensTotal ?? 0),
  };
}

/** Counters for the "now" panel. "waiting" = idle conversations. */
export function nowCounts(
  convs: ActiveConversation[],
  totalDesks: number,
): { needsYou: number; working: number; waiting: number; freeDesks: number } {
  let needsYou = 0;
  let working = 0;
  let waiting = 0;
  for (const c of convs) {
    if (c.status === "needs_you") needsYou++;
    else if (c.status === "working") working++;
    else waiting++;
  }
  return {
    needsYou,
    working,
    waiting,
    freeDesks: Math.max(0, totalDesks - convs.length),
  };
}

/** Label for why a conversation needs the user. */
export function alertText(
  needsReason?: string | null,
  currentTask?: string | null,
  max = 18,
): string {
  const base = needsLabel(needsReason);
  const task = (currentTask ?? "").trim();
  if (!task) return base;
  const txt = `${base} : ${task}`;
  return txt.length <= max ? txt : txt.slice(0, Math.max(0, max - 1)) + "…";
}

export function needsLabel(needsReason?: string | null): string {
  if (needsReason === "permission") return "Permission";
  if (needsReason === "question") return "Question";
  return "Besoin de toi";
}

/**
 * Personnage du poste (Florian, Martial...) : un par poste, dans l'ordre des
 * looks existants ; au-delà, « Florian 2 » (même règle que l'ancien bureau).
 */
export function agentNameForDesk(deskIndex: number): string {
  const keys = Object.keys(PIXEL_LOOKS);
  if (keys.length === 0) return "";
  const key = keys[deskIndex % keys.length];
  const name = key.charAt(0).toUpperCase() + key.slice(1);
  const round = Math.floor(deskIndex / keys.length) + 1;
  return round > 1 ? `${name} ${round}` : name;
}
