/** Pure helpers to format token counts (fr locale, compact). */

export interface TokenTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface UsageBreakdown {
  totals: TokenTotals;
  byModel: Record<string, TokenTotals>;
  /** Taille du contexte au dernier message (sessions seulement). */
  context?: number;
}

function fr(value: number, digits: number): string {
  // Manual formatting: avoids narrow no-break spaces and ICU differences.
  return value.toFixed(digits).replace(".", ",");
}

/** 950 -> "950", 12300 -> "12,3 k", 1200000 -> "1,2 M". */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0";
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = Math.round(n / 100) / 10;
    if (k < 1000) return `${fr(k, 1)} k`;
  }
  return `${fr(Math.round(n / 100_000) / 10, 1)} M`;
}

/** Full number with space thousands separators: 1234567 -> "1 234 567". */
export function formatTokensFull(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
