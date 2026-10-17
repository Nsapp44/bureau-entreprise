import { describe, it, expect } from "vitest";
import { formatModelLabel } from "./modelLabel";

describe("formatModelLabel", () => {
  it.each([
    ["claude-haiku-4-5-20251001", "Haiku 4.5"],
    ["claude-sonnet-5-5", "Sonnet 5.5"],
    ["claude-opus-5-5", "Opus 5.5"],
    ["claude-fable-5-1", "Fable 5.1"],
    ["claude-3-5-sonnet-20241022", "Sonnet 3.5"],
  ])("formats %s", (input, expected) => {
    expect(formatModelLabel(input)).toBe(expected);
  });

  it.each([
    ["gpt-5.6", "GPT-5.6"],
    ["gpt-5.6-sol", "GPT-5.6 Sol"],
    ["gpt-4o", "GPT-4o"],
    ["openai/gpt-5.6", "GPT-5.6"],
    ["deepseek-chat", "DeepSeek Chat"],
    ["deepseek-v4-pro", "DeepSeek V4 Pro"],
    ["gemini-2.5-pro", "Gemini 2.5 Pro"],
    ["qwen3:8b", "Qwen3 8B"],
    ["llama3.1:70b", "Llama3.1 70B"],
    ["mistral", "Mistral"],
  ])("formats non-Claude model %s", (input, expected) => {
    expect(formatModelLabel(input)).toBe(expected);
  });

  it("returns unknown ids unchanged", () => {
    expect(formatModelLabel("claude-mystery-9")).toBe("claude-mystery-9");
    expect(formatModelLabel("<synthetic>")).toBe("<synthetic>");
    expect(formatModelLabel("grok-4")).toBe("grok-4");
  });

  it("returns null for null/undefined/empty", () => {
    expect(formatModelLabel(null)).toBeNull();
    expect(formatModelLabel(undefined)).toBeNull();
    expect(formatModelLabel("")).toBeNull();
  });
});
