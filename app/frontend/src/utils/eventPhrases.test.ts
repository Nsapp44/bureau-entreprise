import { describe, expect, it } from "vitest";
import { buildEventPhrase, describeTool } from "./eventPhrases";

const louis = {
  name: "Louis",
  model: "claude-haiku-4-5-20251001",
  color: "#f00",
};

describe("describeTool", () => {
  it("translates known tools", () => {
    expect(describeTool("Read", { file_path: "C:\\a\\b\\README.md" })).toBe(
      "lit README.md",
    );
    expect(describeTool("Write", { file_path: "/x/y.ts" })).toBe("écrit y.ts");
    expect(describeTool("Edit", { file_path: "/x/y.ts" })).toBe("modifie y.ts");
    expect(describeTool("Read")).toBe("lit un fichier");
    expect(describeTool("PowerShell")).toBe("lance une commande");
    expect(describeTool("Glob")).toBe("cherche dans les fichiers");
    expect(describeTool("WebSearch")).toBe("consulte le web");
    expect(describeTool("Task")).toBe("délègue une tâche");
    expect(describeTool("TodoWrite")).toBe("met à jour la liste de tâches");
  });

  it("handles mcp tools and unknown tools", () => {
    expect(describeTool("mcp__Claude_Browser__browser_batch")).toBe(
      "utilise le navigateur",
    );
    expect(describeTool("mcp__Claude_in_Chrome__x")).toBe("utilise in Chrome");
    expect(describeTool("Foo")).toBe("utilise Foo");
  });
});

describe("buildEventPhrase", () => {
  it("names the boss for agent id main", () => {
    const p = buildEventPhrase({
      type: "pre_tool_use",
      agentId: "main",
      detail: { toolName: "Read", toolInput: { file_path: "/a/README.md" } },
    });
    expect(p.actor).toBe("Boss");
    expect(p.isBoss).toBe(true);
    expect(p.text).toBe("lit README.md");
  });

  it("names agents with model and color", () => {
    const p = buildEventPhrase(
      { type: "pre_tool_use", agentId: "a1", detail: { toolName: "Bash" } },
      louis,
    );
    expect(p.actor).toBe("Louis");
    expect(p.actorModel).toBe("Haiku 4.5");
    expect(p.actorColor).toBe("#f00");
    expect(p.text).toBe("lance une commande");
  });

  it("falls back to Agent when the agent is gone", () => {
    expect(
      buildEventPhrase({ type: "subagent_stop", agentId: "x" }).actor,
    ).toBe("Agent");
  });

  it("hides redundant events, shows failures", () => {
    expect(
      buildEventPhrase({ type: "post_tool_use", agentId: "main" }).hidden,
    ).toBe(true);
    const fail = buildEventPhrase({
      type: "post_tool_use",
      agentId: "main",
      detail: { toolName: "Bash", errorType: "x" },
    });
    expect(fail.hidden).toBe(false);
    expect(fail.text).toBe("⚠ échec : Bash");
    expect(
      buildEventPhrase({ type: "agent_update", agentId: "a" }).hidden,
    ).toBe(true);
    expect(
      buildEventPhrase({ type: "subagent_info", agentId: "a" }).hidden,
    ).toBe(true);
  });

  it("builds lifecycle phrases", () => {
    const start = buildEventPhrase(
      { type: "subagent_start", agentId: "a1" },
      louis,
    );
    expect(`${start.actor} ${start.text}`).toBe("Boss embauche Louis");
    expect(
      buildEventPhrase({ type: "user_prompt_submit", agentId: "main" }).text,
    ).toBe("Nouvelle demande");
    const stop = buildEventPhrase({ type: "stop", agentId: "main" });
    expect(`${stop.actor} ${stop.text}`).toBe("Boss a fini sa tâche");
    expect(buildEventPhrase({ type: "session_end" }).text).toBe(
      "Session fermée",
    );
    const c = buildEventPhrase({ type: "context_compaction", agentId: "main" });
    expect(`${c.actor} ${c.text}`).toBe("Boss range son bureau (compaction)");
    expect(
      buildEventPhrase({ type: "permission_request", agentId: "main" }).text,
    ).toBe("⏳ attend ton autorisation");
  });
});
