/**
 * Turn a raw model id into a short human label.
 *
 *   "claude-haiku-4-5-20251001"  -> "Haiku 4.5"
 *   "claude-3-5-sonnet-20241022" -> "Sonnet 3.5"
 *   "gpt-5.6-sol"                -> "GPT-5.6 Sol"
 *   "deepseek-v4-pro"            -> "DeepSeek V4 Pro"
 *   "gemini-2.5-pro"             -> "Gemini 2.5 Pro"
 *   "qwen3:8b"                   -> "Qwen3 8B"
 *
 * Unknown ids are returned unchanged; null/empty yields null.
 */
const FAMILIES = ["haiku", "sonnet", "opus", "fable"] as const;

const LOCAL_PREFIXES = [
  "qwen",
  "llama",
  "mistral",
  "mixtral",
  "phi",
  "gemma",
  "codellama",
];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatClaude(model: string, tokens: string[]): string {
  const family = tokens.find((t) => (FAMILIES as readonly string[]).includes(t));
  if (!family) return model;

  // Numeric tokens, dropping a trailing 8-digit date stamp (e.g. 20251001).
  const versions = tokens.filter((t) => /^\d{1,2}$/.test(t));
  const name = capitalize(family);
  return versions.length > 0 ? `${name} ${versions.join(".")}` : name;
}

/** "gpt-5.6-sol" -> "GPT-5.6 Sol"; "gpt-4o" -> "GPT-4o". */
function formatGpt(rest: string[]): string {
  if (rest.length === 0) return "GPT";
  const [version, ...suffix] = rest;
  return ["GPT-" + version, ...suffix.map(capitalize)].join(" ");
}

/** Words after a brand: "v4" -> "V4", everything else capitalised. */
function formatWords(words: string[]): string {
  return words
    .map((w) => (/^v\d/.test(w) ? w.toUpperCase() : capitalize(w)))
    .join(" ");
}

export function formatModelLabel(
  model: string | null | undefined,
): string | null {
  if (!model) return null;
  // Drop a routing prefix such as "openai/gpt-5.6" or "ollama/qwen3:8b".
  const id = model.toLowerCase().replace(/^[a-z0-9_.-]+\//, "");
  const tokens = id.split("-");

  if (tokens[0] === "claude") return formatClaude(model, tokens);
  if (tokens[0] === "gpt") return formatGpt(tokens.slice(1));
  if (tokens[0] === "deepseek") {
    return tokens.length > 1
      ? `DeepSeek ${formatWords(tokens.slice(1))}`
      : "DeepSeek";
  }
  if (tokens[0] === "gemini") {
    return tokens.length > 1
      ? `Gemini ${formatWords(tokens.slice(1))}`
      : "Gemini";
  }

  // Local (Ollama-style) models: "qwen3:8b" -> "Qwen3 8B".
  if (LOCAL_PREFIXES.some((p) => id.startsWith(p)) || id.includes(":")) {
    const [name, tag] = id.split(":");
    const label = formatWords(name.split("-"));
    return tag ? `${label} ${tag.toUpperCase()}` : label;
  }

  return model;
}
