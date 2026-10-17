import { describe, it, expect } from "vitest";
import { groupByFamily, modelFamily } from "./usageFamilies";
import type { TokenTotals } from "./tokenFormat";

function t(total: number): TokenTotals {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total };
}

describe("modelFamily", () => {
  it("reconnaît les familles quelle que soit la version", () => {
    expect(modelFamily("claude-sonnet-5-5")).toBe("Sonnet");
    expect(modelFamily("claude-opus-4-1-20250805")).toBe("Opus");
    expect(modelFamily("claude-haiku-4-5-20251001")).toBe("Haiku");
    expect(modelFamily("claude-fable-5-1")).toBe("Fable");
    expect(modelFamily("gpt-whatever")).toBe("Autre");
  });
});

describe("groupByFamily", () => {
  it("additionne les versions d'une même famille et trie par total", () => {
    const out = groupByFamily({
      "claude-sonnet-5-5": t(600),
      "claude-sonnet-4-6": t(200),
      "claude-opus-5-5": t(150),
      "claude-haiku-4-5-20251001": t(50),
    });
    expect(out.map((f) => f.family)).toEqual(["Sonnet", "Opus", "Haiku"]);
    expect(out[0].total).toBe(800);
    expect(out[0].share).toBeCloseTo(0.8);
    expect(out.reduce((a, f) => a + f.share, 0)).toBeCloseTo(1);
  });

  it("ignore les modèles à zéro et gère le vide", () => {
    expect(groupByFamily({})).toEqual([]);
    expect(groupByFamily({ "claude-opus-5-5": t(0) })).toEqual([]);
  });
});
