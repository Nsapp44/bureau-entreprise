import { describe, expect, it } from "vitest";
import type { ActiveConversation } from "@/types";
import {
  alertText,
  assignDeskSlots,
  needsLabel,
  nowCounts,
  plateText,
} from "@/components/conversations/conversationsLogic";

function conv(
  status: ActiveConversation["status"],
  extra: Partial<ActiveConversation> = {},
): ActiveConversation {
  return { sessionId: "s", status, ...extra };
}

describe("assignDeskSlots", () => {
  it("assigns 0..n-1 to new ids in order", () => {
    const m = assignDeskSlots(new Map(), ["a", "b", "c"]);
    expect([...m.entries()]).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2],
    ]);
  });

  it("keeps desk numbers stable when others leave or arrive", () => {
    const first = assignDeskSlots(new Map(), ["a", "b", "c"]);
    const second = assignDeskSlots(first, ["c", "a", "d"]);
    expect(second.get("a")).toBe(0);
    expect(second.get("c")).toBe(2);
    expect(second.get("d")).toBe(1);
    expect(second.has("b")).toBe(false);
  });

  it("frees a desk then reassigns it to the smallest free number", () => {
    const first = assignDeskSlots(new Map(), ["a", "b", "c"]);
    const afterLeave = assignDeskSlots(first, ["a", "c"]);
    expect(afterLeave.get("c")).toBe(2);
    const afterJoin = assignDeskSlots(afterLeave, ["a", "c", "z"]);
    expect(afterJoin.get("z")).toBe(1);
  });

  it("does not mutate prev", () => {
    const prev = new Map([["a", 0]]);
    assignDeskSlots(prev, ["b", "c"]);
    expect([...prev.entries()]).toEqual([["a", 0]]);
  });

  it("handles empty ids and duplicate stale slots", () => {
    expect(assignDeskSlots(new Map([["a", 0]]), []).size).toBe(0);
    const m = assignDeskSlots(
      new Map([
        ["a", 0],
        ["b", 0],
      ]),
      ["a", "b"],
    );
    expect(new Set(m.values()).size).toBe(2);
  });
});

describe("plateText", () => {
  it("keeps a short title and formats model and tokens", () => {
    const r = plateText(
      conv("working", {
        title: "Court",
        model: "claude-haiku-4-5-20251001",
        tokensTotal: 12300,
      }),
    );
    expect(r).toEqual({ title: "Court", model: "Haiku 4.5", tokens: "12,3 k" });
  });

  it("truncates long titles with an ellipsis", () => {
    const r = plateText(conv("idle", { title: "A".repeat(30) }));
    expect(r.title).toBe("A".repeat(17) + "…");
    expect(r.title.length).toBe(18);
  });

  it("does not truncate a title of exactly maxTitle", () => {
    expect(plateText(conv("idle", { title: "B".repeat(18) })).title).toBe(
      "B".repeat(18),
    );
  });

  it("respects a custom maxTitle", () => {
    expect(plateText(conv("idle", { title: "abcdefgh" }), 5).title).toBe(
      "abcd…",
    );
  });

  it("falls back for missing title, model and tokens", () => {
    expect(plateText(conv("idle"))).toEqual({
      title: "Sans titre",
      model: "",
      tokens: "0",
    });
    expect(plateText(conv("idle", { title: "   " })).title).toBe("Sans titre");
    expect(plateText(conv("idle", { title: null, model: null })).model).toBe(
      "",
    );
  });
});

describe("nowCounts", () => {
  it("counts by status and free desks", () => {
    const r = nowCounts(
      [conv("working"), conv("working"), conv("needs_you"), conv("idle")],
      6,
    );
    expect(r).toEqual({ needsYou: 1, working: 2, waiting: 1, freeDesks: 2 });
  });

  it("handles empty list and never returns negative free desks", () => {
    expect(nowCounts([], 4)).toEqual({
      needsYou: 0,
      working: 0,
      waiting: 0,
      freeDesks: 4,
    });
    expect(nowCounts([conv("idle"), conv("idle")], 1).freeDesks).toBe(0);
  });
});

describe("needsLabel", () => {
  it("maps known reasons", () => {
    expect(needsLabel("permission")).toBe("Permission");
    expect(needsLabel("question")).toBe("Question");
  });

  it("falls back for unknown, null, undefined", () => {
    expect(needsLabel("other")).toBe("Besoin de toi");
    expect(needsLabel(null)).toBe("Besoin de toi");
    expect(needsLabel()).toBe("Besoin de toi");
  });
});

describe("alertText", () => {
  it("ajoute la tâche en cours et coupe", () => {
    expect(alertText("permission", "Bash")).toBe("Permission : Bash");
    expect(alertText("question", null)).toBe("Question");
    expect(alertText("permission", "Edit un très long fichier").length).toBe(
      18,
    );
  });
});
