import { describe, expect, it } from "vitest";
import { AGENT_LOOKS, PIXEL_LOOKS, getAgentLook } from "@/constants/agentLooks";

describe("getAgentLook", () => {
  it("returns the fixed colour for a known name", () => {
    expect(getAgentLook("Florian", "#000000").color).toBe("#F5C518");
  });
  it("ignores case and accents", () => {
    expect(getAgentLook("Noémie", "#000").color).toBe(AGENT_LOOKS.noemie.color);
    expect(getAgentLook("NOEMIE", "#000").color).toBe(AGENT_LOOKS.noemie.color);
  });
  it("keeps the base hue for numbered duplicates but shades it", () => {
    const base = getAgentLook("Yanis", "#000").color;
    const dup = getAgentLook("Yanis 2", "#000").color;
    expect(dup).not.toBe(base);
    expect(dup).toMatch(/^#[0-9A-F]{6}$/);
    expect(getAgentLook("Yanis 2", "#000").accessory).toBe(
      getAgentLook("Yanis", "#000").accessory,
    );
  });
  it("falls back for unknown or missing names", () => {
    expect(getAgentLook("Bob", "#123456").color).toBe("#123456");
    expect(getAgentLook(null, "#123456").color).toBe("#123456");
  });
  it("has 8 distinct colours", () => {
    const set = new Set(Object.values(AGENT_LOOKS).map((l) => l.color));
    expect(set.size).toBe(8);
  });

  it("body colour comes from agentPixelLooks.json", () => {
    for (const [k, p] of Object.entries(PIXEL_LOOKS)) {
      expect(getAgentLook(k, "#000").color).toBe(p.body);
    }
  });
  it("resolves the pixel look and darkens the body of duplicates", () => {
    const base = getAgentLook("Florian", "#000");
    const dup = getAgentLook("Florian 2", "#000");
    expect(dup.pixel).not.toBeNull();
    expect(dup.pixel?.rects).toEqual(base.pixel?.rects);
    expect(dup.color).not.toBe(base.color);
    expect(dup.pixel?.body).toBe(dup.color);
  });
  it("resolves Noemie with or without accent", () => {
    expect(getAgentLook("Noémie", "#000").pixel).toBe(PIXEL_LOOKS.noemie);
    expect(getAgentLook("noemie", "#000").pixel).toBe(PIXEL_LOOKS.noemie);
  });
  it("gives no pixel look to unknown names", () => {
    expect(getAgentLook("Bob", "#123456").pixel).toBeNull();
    expect(getAgentLook(null, "#123456").pixel).toBeNull();
  });
});
