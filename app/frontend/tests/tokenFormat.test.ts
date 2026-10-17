import { describe, expect, it } from "vitest";
import { formatTokens, formatTokensFull } from "@/utils/tokenFormat";

describe("formatTokens", () => {
  it("formats small, k and M values", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(12_300)).toBe("12,3 k");
    expect(formatTokens(1_200_000)).toBe("1,2 M");
    expect(formatTokens(0)).toBe("0");
  });
  it("rolls 999 950 over to M", () => {
    expect(formatTokens(999_990)).toBe("1,0 M");
  });
  it("guards invalid input", () => {
    expect(formatTokens(NaN)).toBe("0");
    expect(formatTokens(-5)).toBe("0");
  });
});

describe("formatTokensFull", () => {
  it("groups thousands", () => {
    expect(formatTokensFull(1234567)).toBe("1 234 567");
    expect(formatTokensFull(12)).toBe("12");
  });
});
