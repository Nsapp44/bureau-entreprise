import { describe, it, expect } from "vitest";
import {
  buildLedBadge,
  providerColor,
  providerColorNumber,
  providerStyle,
  providerTag,
} from "./providers";

describe("providers", () => {
  it.each([
    ["anthropic", "#FF8A4C", "Claude"],
    ["openai", "#10A37F", "OpenAI"],
  ])("%s has its documented colour and name", (id, color, name) => {
    expect(providerStyle(id)).toEqual({ color, name });
  });

  it("falls back to the cyan 'unknown' style", () => {
    expect(providerColor("unknown")).toBe("#4DD2FF");
    expect(providerColor(null)).toBe("#4DD2FF");
    expect(providerColor(undefined)).toBe("#4DD2FF");
    expect(providerColor("brand-new-provider")).toBe("#4DD2FF");
  });

  it("converts the colour to a Pixi number", () => {
    expect(providerColorNumber("openai")).toBe(0x10a37f);
    expect(providerColorNumber(null)).toBe(0x4dd2ff);
  });

  it("tags only OpenAI agents", () => {
    expect(providerTag("openai")).toBe("OpenAI");
    expect(providerTag("anthropic")).toBeNull();
    expect(providerTag(null)).toBeNull();
  });
});

describe("buildLedBadge", () => {
  it("prefixes OpenAI and uses the provider colour", () => {
    expect(
      buildLedBadge({
        kind: "sous-fifre",
        modelLabel: "GPT-5.6",
        provider: "openai",
      }),
    ).toEqual({ text: "OpenAI · sous-fifre · GPT-5.6", color: "#10A37F" });
  });

  it("omits the prefix for Claude and a missing model", () => {
    expect(
      buildLedBadge({
        kind: "lecteur",
        modelLabel: "Sonnet 5.5",
        provider: "anthropic",
      }),
    ).toEqual({ text: "lecteur · Sonnet 5.5", color: "#FF8A4C" });
    expect(
      buildLedBadge({ kind: "chef", modelLabel: null, provider: null }),
    ).toEqual({ text: "chef", color: "#4DD2FF" });
  });
});
