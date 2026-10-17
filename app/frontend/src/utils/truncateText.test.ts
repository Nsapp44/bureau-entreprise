import { describe, it, expect } from "vitest";
import { truncateText } from "./truncateText";

describe("truncateText", () => {
  it("keeps short text", () => {
    expect(truncateText("abc", 5)).toBe("abc");
    expect(truncateText("abcde", 5)).toBe("abcde");
  });
  it("truncates with an ellipsis", () => {
    expect(truncateText("abcdefgh", 5)).toBe("abcd…");
  });
  it("handles tiny limits", () => {
    expect(truncateText("abc", 1)).toBe("…");
    expect(truncateText("abc", 0)).toBe("");
  });
});
