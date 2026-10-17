/**
 * Turn raw event-log entries into one readable French sentence each.
 *
 * Pure module (no React / store access): the caller resolves the acting agent
 * and passes it in, so everything here is trivially testable.
 */
import { formatModelLabel } from "@/utils/modelLabel";
import { providerColor } from "@/utils/providers";

export const BOSS_AGENT_IDS: readonly string[] = ["main", "boss"];

export interface PhraseEvent {
  type: string;
  agentId?: string | null;
  summary?: string | null;
  detail?: object | null;
}

/** Minimal agent shape needed to name the actor. */
export interface PhraseAgent {
  name?: string | null;
  model?: string | null;
  color?: string | null;
  provider?: string | null;
}

export interface EventPhrase {
  icon: string;
  /** Who acts ("Boss", "Louis"); null when the event has no actor. */
  actor: string | null;
  isBoss: boolean;
  /** Short model label shown next to the actor (agents only). */
  actorModel: string | null;
  /** Colour of the model provider, for the model label. */
  actorModelColor: string | null;
  actorColor: string | null;
  /** Sentence fragment that follows the actor. */
  text: string;
  /** Redundant / technical events, hidden unless "Détails techniques". */
  hidden: boolean;
}

const HIDDEN_TYPES = new Set(["agent_update", "subagent_info"]);

const ICONS: Record<string, string> = {
  pre_tool_use: "🔧",
  post_tool_use: "⚠️",
  user_prompt_submit: "💬",
  permission_request: "⏳",
  subagent_start: "🧑‍💼",
  subagent_stop: "✅",
  session_start: "🟢",
  session_end: "⚪",
  stop: "🏁",
  context_compaction: "🧹",
  error: "⚠️",
  notification: "🔔",
};

export function isBossId(agentId: string | null | undefined): boolean {
  return !!agentId && BOSS_AGENT_IDS.includes(agentId);
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : path;
}

function filePathOf(toolInput: unknown): string | null {
  if (!toolInput || typeof toolInput !== "object") return null;
  const input = toolInput as Record<string, unknown>;
  const p = input.file_path ?? input.notebook_path ?? input.path;
  return typeof p === "string" && p.length > 0 ? basename(p) : null;
}

function readableMcpServer(raw: string): string {
  const cleaned = raw.replace(/^Claude_/, "").replace(/_/g, " ");
  return cleaned.toLowerCase() === "browser" ? "le navigateur" : cleaned;
}

/** Short French verb phrase for a tool call ("lit README.md"). */
export function describeTool(toolName: unknown, toolInput?: unknown): string {
  const name = typeof toolName === "string" ? toolName : "";
  const file = filePathOf(toolInput);
  switch (name) {
    case "Read":
      return file ? `lit ${file}` : "lit un fichier";
    case "Write":
      return file ? `écrit ${file}` : "écrit un fichier";
    case "Edit":
    case "MultiEdit":
    case "NotebookEdit":
      return file ? `modifie ${file}` : "modifie un fichier";
    case "Bash":
    case "PowerShell":
      return "lance une commande";
    case "Grep":
    case "Glob":
      return "cherche dans les fichiers";
    case "WebFetch":
    case "WebSearch":
      return "consulte le web";
    case "Agent":
    case "Task":
      return "délègue une tâche";
    case "TodoWrite":
      return "met à jour la liste de tâches";
  }
  if (name.startsWith("mcp__")) {
    const server = name.split("__")[1];
    if (server) return `utilise ${readableMcpServer(server)}`;
  }
  return name ? `utilise ${name}` : "utilise un outil";
}

function nameOf(agent: PhraseAgent | undefined | null): string {
  return agent?.name || "Agent";
}

/**
 * Build the phrase for one event.
 * @param agent The acting agent resolved from the store (undefined if gone).
 */
export function buildEventPhrase(
  event: PhraseEvent,
  agent?: PhraseAgent | null,
): EventPhrase {
  const { type } = event;
  const detail = (event.detail ?? {}) as Record<string, unknown>;
  const boss = isBossId(event.agentId) || type === "context_compaction";
  const hasActor = boss || !!event.agentId;

  const actor = !hasActor ? null : boss ? "Boss" : nameOf(agent);
  const base = {
    icon: ICONS[type] ?? "•",
    actor,
    isBoss: boss,
    actorModel: boss ? null : formatModelLabel(agent?.model),
    actorModelColor: boss ? null : providerColor(agent?.provider),
    actorColor: boss ? null : (agent?.color ?? null),
    hidden: HIDDEN_TYPES.has(type),
  };
  const make = (
    text: string,
    over: Partial<EventPhrase> = {},
  ): EventPhrase => ({
    ...base,
    text,
    ...over,
  });

  switch (type) {
    case "pre_tool_use":
      return make(describeTool(detail.toolName, detail.toolInput));
    case "post_tool_use": {
      if (detail.errorType) {
        const tool =
          typeof detail.toolName === "string" ? detail.toolName : "outil";
        return make(`⚠ échec : ${tool}`, { hidden: false });
      }
      return make("a terminé un outil", { hidden: true });
    }
    case "subagent_start": {
      const name =
        (typeof detail.agentName === "string" && detail.agentName) ||
        nameOf(agent);
      return make(`embauche ${name}`, {
        actor: "Boss",
        isBoss: true,
        actorModel: null,
        actorModelColor: null,
        actorColor: null,
      });
    }
    case "subagent_stop":
      return make("a terminé");
    case "user_prompt_submit":
      return make("Nouvelle demande", { actor: null, isBoss: false });
    case "stop":
      return make("a fini sa tâche");
    case "session_start":
      return make("Session ouverte", { actor: null, isBoss: false });
    case "session_end":
      return make("Session fermée", { actor: null, isBoss: false });
    case "context_compaction":
      return make("range son bureau (compaction)");
    case "permission_request":
      return make("⏳ attend ton autorisation");
    case "error":
      return make(`⚠ erreur : ${event.summary ?? ""}`.trim());
    default:
      return make(event.summary ?? type.replace(/_/g, " "));
  }
}
