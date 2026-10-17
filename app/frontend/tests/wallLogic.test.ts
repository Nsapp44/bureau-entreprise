import { describe, expect, it } from "vitest";
import {
  clip,
  clockText,
  conversationsTokensToday,
  providerTotals,
  quotaRows,
  readAgeText,
  tokensShort,
} from "@/components/conversations/wallLogic";
import type { QuotaReading } from "@/hooks/useUsage";

const t = (total: number) => ({
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total,
});

const readings: QuotaReading[] = [
  {
    account: "claude",
    window: "5h",
    percent: 21,
    resetsAt: null,
    readAt: 1000,
    source: "x",
  },
  {
    account: "chatgpt",
    window: "5h",
    percent: 36,
    resetsAt: 5000,
    readAt: 940,
    source: "x",
  },
  {
    account: "chatgpt",
    window: "7j",
    percent: 20,
    resetsAt: 10,
    readAt: 940,
    source: "x",
  },
];

describe("wallLogic", () => {
  it("Claude = % utilisé, OpenAI = % restant, fenêtre expirée ignorée", () => {
    const c = quotaRows(readings, "claude", 2000);
    expect(c[0]).toMatchObject({
      fraction: 0.21,
      text: "21 % utilisé",
      known: true,
    });
    expect(c[1]).toMatchObject({ text: "—", known: false });
    const o = quotaRows(readings, "openai", 2000);
    expect(o[0]).toMatchObject({ fraction: 0.64, text: "64 % restant" });
    expect(o[1].known).toBe(false);
  });

  it("pas de crash sans données", () => {
    expect(quotaRows(null, "openai", 0)[0].text).toBe("—");
    expect(providerTotals(null)).toEqual({ claude: 0, openai: 0, total: 0 });
    expect(readAgeText(null, 0)).toBe("—");
  });

  it("répartit la conso par fournisseur", () => {
    const r = providerTotals({
      totals: t(100),
      byModel: { "claude-opus-5-5": t(70), "gpt-6-astra": t(30) },
    });
    expect(r).toEqual({ claude: 70, openai: 30, total: 100 });
  });

  it("âge de lecture, horloge, clip, tokens du jour", () => {
    expect(readAgeText(readings, 1180)).toBe("lu il y a 3 min");
    expect(clockText(new Date(2026, 9, 11, 14, 32)).day).toBe("dim. 11/10");
    expect(clip("abcdef", 4)).toBe("abc…");
    expect(conversationsTokensToday([{ tokensToday: 5 }, {}])).toBe(5);
  });
});

describe("tokensShort", () => {
  it("3 chiffres maxi avec unité", () => {
    expect(tokensShort(0)).toBe("0");
    expect(tokensShort(842)).toBe("842");
    expect(tokensShort(6_100)).toBe("6,1 k");
    expect(tokensShort(842_000)).toBe("842 k");
    expect(tokensShort(61_300_000)).toBe("61 M");
    expect(tokensShort(999_700)).toBe("1,0 M");
  });
});
