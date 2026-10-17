/**
 * Regroupe la consommation du jour par famille de modèle (Opus, Sonnet…)
 * pour le tableau blanc : « claude-sonnet-5-5 » et « claude-sonnet-4-6 »
 * comptent ensemble dans « Sonnet ».
 */

import type { TokenTotals } from "./tokenFormat";

export interface FamilyUsage {
  family: string;
  total: number;
  /** Part du total (0 à 1). */
  share: number;
}

const FAMILIES: ReadonlyArray<readonly [string, string]> = [
  ["opus", "Opus"],
  ["sonnet", "Sonnet"],
  ["haiku", "Haiku"],
  ["fable", "Fable"],
];

export function modelFamily(model: string): string {
  const id = model.toLowerCase();
  for (const [needle, label] of FAMILIES) {
    if (id.includes(needle)) return label;
  }
  return "Autre";
}

/** Familles non vides, de la plus gourmande à la moins gourmande. */
export function groupByFamily(
  byModel: Record<string, TokenTotals>,
): FamilyUsage[] {
  const sums = new Map<string, number>();
  for (const [model, totals] of Object.entries(byModel)) {
    const family = modelFamily(model);
    sums.set(family, (sums.get(family) ?? 0) + (totals.total || 0));
  }
  const all = [...sums.entries()].filter(([, total]) => total > 0);
  const grand = all.reduce((acc, [, total]) => acc + total, 0);
  return all
    .map(([family, total]) => ({
      family,
      total,
      share: grand > 0 ? total / grand : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
