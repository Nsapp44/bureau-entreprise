import type { QuotaReading } from "@/hooks/useUsage";
import { formatTokens, type UsageBreakdown } from "@/utils/tokenFormat";
import { groupByFamily } from "@/utils/usageFamilies";

export type Provider = "claude" | "openai";

const ACCOUNT: Record<Provider, QuotaReading["account"]> = {
  claude: "claude",
  openai: "chatgpt",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteTotal(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}

function readTotal(value: unknown): number | undefined {
  const direct = finiteTotal(value);
  if (direct !== undefined) return direct;
  if (!isRecord(value)) return undefined;
  return (
    finiteTotal(value.total) ??
    finiteTotal(value.totalTokens) ??
    finiteTotal(value.total_tokens)
  );
}

export function identifyProvider(name: string): Provider | undefined {
  const n = name.toLowerCase();
  if (
    /(^|[^a-z0-9])(anthropic|claude|sonnet|opus|haiku)(?=$|[^a-z0-9])/.test(n)
  )
    return "claude";
  if (/(^|[^a-z0-9])(openai|chatgpt|gpt|o[134])(?=$|[^a-z0-9])/.test(n))
    return "openai";
  return undefined;
}

/** Tokens du jour par fournisseur (logique de ConsoMode). */
export function providerTotals(usage: UsageBreakdown | null): {
  claude: number;
  openai: number;
  total: number;
} {
  const r = { claude: 0, openai: 0, total: 0 };
  if (!usage) return r;
  let recognizedClaude = false;
  const byModel: unknown = usage.byModel;
  const entries: Array<[string, unknown]> = isRecord(byModel)
    ? Object.entries(byModel)
    : [];
  for (const [key, value] of entries) {
    const provider = identifyProvider(key);
    const total = readTotal(value);
    if (provider === undefined || total === undefined) continue;
    r[provider] += total;
    if (provider === "claude") recognizedClaude = true;
  }
  if (!recognizedClaude) {
    for (const family of groupByFamily(usage.byModel)) {
      if (identifyProvider(family.family) === "claude") {
        r.claude += finiteTotal(family.total) ?? 0;
      }
    }
  }
  r.total = finiteTotal(usage.totals?.total) ?? r.claude + r.openai;
  return r;
}

export interface QuotaRow {
  window: "5h" | "7j";
  /** Libellé de la fenêtre (« 5 h » / « 7 j »). */
  label: string;
  /** Remplissage de la jauge, 0..1 (consommé pour Claude, restant pour OpenAI). */
  fraction: number;
  text: string;
  known: boolean;
}

/**
 * Lecture officielle : percent = % CONSOMMÉ. Claude affiche « x % utilisé »,
 * OpenAI (interface ChatGPT) affiche « x % restant » (= 100 - percent).
 */
export function quotaRows(
  readings: QuotaReading[] | null,
  provider: Provider,
  nowSec: number,
): QuotaRow[] {
  return (["5h", "7j"] as const).map((window) => {
    const label = window === "5h" ? "5 h" : "7 j";
    const r = readings?.find(
      (q) => q.account === ACCOUNT[provider] && q.window === window,
    );
    const live = r && (r.resetsAt === null || r.resetsAt > nowSec);
    if (!r || !live || !Number.isFinite(r.percent)) {
      return { window, label, fraction: 0, text: "—", known: false };
    }
    const used = Math.min(100, Math.max(0, r.percent));
    if (provider === "openai") {
      const left = Math.round(100 - used);
      return {
        window,
        label,
        fraction: left / 100,
        text: `${left} % restant`,
        known: true,
      };
    }
    const u = Math.round(used);
    return {
      window,
      label,
      fraction: u / 100,
      text: `${u} % utilisé`,
      known: true,
    };
  });
}

/** Plan affiché à côté du fournisseur (« MAX », « PLUS »...). */
export function planOf(
  readings: QuotaReading[] | null,
  provider: Provider,
): string {
  const r = readings?.find((q) => q.account === ACCOUNT[provider] && q.plan);
  return r?.plan ? r.plan.toUpperCase() : "";
}

/** « lu il y a 3 min » d'après la lecture la plus récente, ou « — ». */
export function readAgeText(
  readings: QuotaReading[] | null,
  nowSec: number,
): string {
  let latest: number | null = null;
  for (const q of readings ?? []) {
    if (q.readAt !== null && (latest === null || q.readAt > latest))
      latest = q.readAt;
  }
  if (latest === null) return "—";
  const min = Math.max(0, Math.floor((nowSec - latest) / 60));
  if (min < 1) return "lu à l'instant";
  if (min < 60) return `lu il y a ${min} min`;
  return `lu il y a ${Math.floor(min / 60)} h`;
}

/** Heure et date de l'horloge du mur : « 14:32 » / « sam. 11/10 ». */
export function clockText(d: Date): { time: string; day: string } {
  const p = (n: number): string => String(n).padStart(2, "0");
  const weekdays = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  return {
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
    day: `${weekdays[d.getDay()]} ${p(d.getDate())}/${p(d.getMonth() + 1)}`,
  };
}

/** Coupe avec « … » au-delà de max caractères. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + "…";
}

/** Total de tokens du jour des conversations. */
export function conversationsTokensToday(
  convs: Array<{ tokensToday?: number }>,
): number {
  let t = 0;
  for (const c of convs) t += finiteTotal(c.tokensToday) ?? 0;
  return t;
}

/** Total compact sur 3 chiffres maxi avec l'unité : « 61 M », « 6,1 M », « 842 k ». */
export function tokensShort(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  const units: Array<[number, string]> = [
    [1_000_000_000, "G"],
    [1_000_000, "M"],
    [1_000, "k"],
  ];
  for (const [div, unit] of units) {
    if (n >= div) {
      const v = n / div;
      const txt =
        v < 10 ? v.toFixed(1).replace(".", ",") : String(Math.round(v));
      // 999,6 k s'arrondit à 1000 : passer à l'unité suivante.
      if (txt === "1000" && unit !== "G") return tokensShort(div * 1000);
      return `${txt} ${unit}`;
    }
  }
  return String(Math.round(n));
}

export function tokensLabel(n: number | undefined): string {
  return n === undefined ? "—" : formatTokens(n);
}
