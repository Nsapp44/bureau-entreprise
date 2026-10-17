/**
 * Fixed look per agent first name.
 *
 * Themes (placeholder until real sprites exist):
 *  - Florian   : chill, "Pokemon" vibe     -> warm electric yellow
 *  - Alexandre : robotics engineer/cyborg  -> metallic cyan steel
 *  - Martial   : old wise master           -> sage olive green
 *  - Guilherm  : vivid electron            -> neon electric blue
 *  - Noemie    : classy and clean          -> cream white
 *  - Orlane    : designer                  -> creative magenta
 *  - Yanis     : Russian style             -> deep red
 *  - Germain   : looks like a PCB          -> circuit-board green
 *
 * Source of truth: agentPixelLooks.json (body colour + pixel rects, drawn in
 * AgentSprite). `accessory` is kept as derived data.
 */

import pixelLooksJson from "./agentPixelLooks.json";

export type AgentAccessory = "sunglasses" | "headset" | "none";

/** [x, y, w, h, color] in px relative to the agent origin. */
export type PixelRect = readonly [number, number, number, number, string];

export interface PixelLook {
  theme: string;
  body: string;
  glasses: boolean;
  headset: boolean;
  orbit?: string;
  rects: readonly PixelRect[];
}

export interface AgentLook {
  color: string;
  accessory: AgentAccessory;
  /** Pixel-art look; null for unknown names (original capsule rendering). */
  pixel: PixelLook | null;
}

export const PIXEL_LOOKS: Readonly<Record<string, PixelLook>> = Object.fromEntries(
  Object.entries(pixelLooksJson as Record<string, unknown>).filter(
    ([k]) => !k.startsWith("_"),
  ),
) as Record<string, PixelLook>;

export const AGENT_LOOKS: Readonly<Record<string, AgentLook>> =
  Object.fromEntries(
    Object.entries(PIXEL_LOOKS).map(([k, p]) => [
      k,
      {
        color: p.body,
        accessory: p.glasses ? "sunglasses" : p.headset ? "headset" : "none",
        pixel: p,
      } satisfies AgentLook,
    ]),
  );

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Shift a hex colour's brightness by `delta` (-255..255) per channel. */
function shade(hex: string, delta: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const ch = (v: number): number => Math.max(0, Math.min(255, v + delta));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0").toUpperCase()}`;
}

/**
 * Resolve the look for an agent name ("Florian", "Florian 2", "Noémie 3").
 * Unknown / empty names keep `fallbackColor`. Duplicates (suffix >= 2) get a
 * slightly darker shade of the base colour.
 */
export function getAgentLook(
  name: string | null | undefined,
  fallbackColor: string,
): AgentLook {
  if (!name) return { color: fallbackColor, accessory: "none", pixel: null };
  const m = /^(.*?)(?:\s+(\d+))?$/.exec(name.trim());
  const base = normalizeName(m?.[1] ?? name);
  const suffix = m?.[2] ? parseInt(m[2], 10) : 1;
  const look = AGENT_LOOKS[base];
  if (!look) return { color: fallbackColor, accessory: "none", pixel: null };
  if (suffix <= 1) return look;
  const color = shade(look.color, -Math.min(60, (suffix - 1) * 25));
  return { ...look, color, pixel: look.pixel && { ...look.pixel, body: color } };
}
