import { describe, expect, it } from "vitest";
import { darknessAt, nightDarkness } from "./timeUtils";

describe("nightDarkness", () => {
  it("vaut 1 la nuit et 0 en plein jour", () => {
    expect(nightDarkness({ hour: 2, progress: 0, phase: "night" })).toBe(1);
    expect(nightDarkness({ hour: 13, progress: 0, phase: "day" })).toBe(0);
  });
  it("glisse à l'aube et au crépuscule", () => {
    expect(nightDarkness({ hour: 7, progress: 0.25, phase: "dawn" })).toBe(
      0.75,
    );
    expect(nightDarkness({ hour: 19, progress: 0.25, phase: "dusk" })).toBe(
      0.25,
    );
  });
});

describe("darknessAt", () => {
  it("est sombre à 3 h et clair à 13 h (octobre)", () => {
    expect(darknessAt(new Date(2026, 9, 6, 3, 0))).toBe(1);
    expect(darknessAt(new Date(2026, 9, 6, 13, 0))).toBe(0);
  });
});
