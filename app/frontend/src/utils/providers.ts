/**
 * Provider (who serves the model) display table. The backend
 * (`core/providers.py`) decides the value; this file only maps it to a colour
 * and a short name. Only Claude (Anthropic) and ChatGPT (OpenAI, via Codex)
 * agents are expected; anything else falls back to the "unknown" style.
 */

export type ProviderId = "anthropic" | "openai" | "unknown";

export interface ProviderStyle {
  /** CSS hex colour, shared by the LED strip, badges and event log. */
  color: string;
  /** Name shown in text ("Claude", "OpenAI"); null when unknown. */
  name: string | null;
}

export const PROVIDER_STYLES: Record<ProviderId, ProviderStyle> = {
  anthropic: { color: "#FF8A4C", name: "Claude" },
  openai: { color: "#10A37F", name: "OpenAI" },
  unknown: { color: "#4DD2FF", name: null },
};

export function providerStyle(
  provider: string | null | undefined,
): ProviderStyle {
  return (
    PROVIDER_STYLES[(provider ?? "unknown") as ProviderId] ??
    PROVIDER_STYLES.unknown
  );
}

/** CSS colour (`#rrggbb`) of a provider; cyan when unknown. */
export function providerColor(provider: string | null | undefined): string {
  return providerStyle(provider).color;
}

/** Same colour as a Pixi number (0xrrggbb). */
export function providerColorNumber(
  provider: string | null | undefined,
): number {
  return parseInt(providerColor(provider).slice(1), 16);
}

/** "OpenAI" for OpenAI agents, null for Claude (the default) or unknown. */
export function providerTag(
  provider: string | null | undefined,
): string | null {
  return provider === "openai" ? PROVIDER_STYLES.openai.name : null;
}

export interface LedBadge {
  text: string;
  color: string;
}

/**
 * Text and colour of a desk LED strip: "OpenAI · SOUS-FIFRE · GPT-5.6" in the
 * provider colour. The marquee upper-cases the text itself.
 */
export function buildLedBadge(parts: {
  kind: string;
  modelLabel: string | null;
  provider: string | null | undefined;
}): LedBadge {
  const segments = [providerTag(parts.provider), parts.kind, parts.modelLabel];
  return {
    text: segments.filter(Boolean).join(" · "),
    color: providerColor(parts.provider),
  };
}
