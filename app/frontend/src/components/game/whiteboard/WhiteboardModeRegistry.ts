/**
 * WhiteboardModeRegistry - Mode metadata and helper functions for the whiteboard.
 *
 * Centralizes mode names, icons, and cycling logic so that Whiteboard.tsx
 * and individual mode components do not need to duplicate this information.
 */

import type { WhiteboardMode } from "@/types";

// ============================================================================
// MODE METADATA
// ============================================================================

export interface ModeInfo {
  name: string;
  icon: string;
}

export const MODE_INFO: Record<WhiteboardMode, ModeInfo> = {
  0: { name: "CONSO", icon: "⚡" },
  1: { name: "STAR", icon: "⭐" },
  2: { name: "TODO", icon: "📋" },
};

export const WHITEBOARD_MODE_COUNT = 3;

/**
 * Returns the next mode index, wrapping around after the last mode.
 */
export function getNextMode(current: WhiteboardMode): WhiteboardMode {
  return ((current + 1) % WHITEBOARD_MODE_COUNT) as WhiteboardMode;
}

/**
 * Returns display info for a given mode.
 */
export function getModeInfo(mode: WhiteboardMode): ModeInfo {
  return MODE_INFO[mode];
}
