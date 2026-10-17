/**
 * DeskGrid Components
 *
 * Renders the desk grid with:
 * - Desk surfaces and keyboards (DeskSurfacesBase - behind agent arms)
 * - Monitors and desk accessories (DeskSurfacesTop - in front of agent arms)
 * - Task marquees on occupied desks
 */

import { type ReactNode, useMemo } from "react";
import { Texture } from "pixi.js";
import { getDeskOrigin } from "@/constants/positions";
import { DeskMarquee } from "./DeskMarquee";
import { RgbTower } from "./RgbTower";
import { DeskFunItem, type FunItemKind } from "./DeskFunItem";
import type { LedBadge } from "@/utils/providers";

// ============================================================================
// TYPES
// ============================================================================

export interface DeskPosition {
  x: number;
  y: number;
  isEmpty: boolean;
}

type DeskItem = "mug" | "thermos" | FunItemKind | "none";

// ============================================================================
// CONSTANTS
// ============================================================================

// Desk grid layout: see getDeskOrigin in @/constants/positions

// Teintes des tasses (sprites en niveaux de gris) : palette resserrée,
// neutre et chaude, pour ne pas concurrencer les bandeaux des fournisseurs.
const ACCESSORY_TINTS = [
  0xffffff, // Blanc
  0xd9dde3, // Gris clair
  0xf3d9b1, // Sable
  0xb8c4d6, // Bleu-gris
  0xffffff,
  0xe8c8a0, // Beige orangé
  0xd9dde3,
  0xf3d9b1,
];

// Deterministic "random" desk items - precomputed shuffled sequence
// Avoids row patterns while ensuring good variety
const DESK_ITEM_SEQUENCE: DeskItem[] = [
  "pokeball",
  "mug",
  "none",
  "pcb",
  "thermos",
  "cigs",
  "none",
  "ramen",
  "gameboy",
  "none",
  "mug",
  "pokeball",
  "beer",
  "thermos",
  "pcb",
  "can",
  "cigs",
  "gameboy",
  "ramen",
  "none",
];

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to compute desk positions based on desk count and occupancy.
 */
export function useDeskPositions(
  deskCount: number,
  occupiedDesks: Set<number>,
  originFn: (n: number) => { x: number; y: number } = getDeskOrigin,
): DeskPosition[] {
  return useMemo(() => {
    const result: DeskPosition[] = [];

    for (let i = 0; i < deskCount; i++) {
      const deskNum = i + 1;
      const { x, y } = originFn(deskNum);
      const isEmpty = !occupiedDesks.has(deskNum);

      result.push({ x, y, isEmpty });
    }

    return result;
  }, [deskCount, occupiedDesks, originFn]);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const FUN_KINDS: ReadonlySet<DeskItem> = new Set<DeskItem>([
  "beer",
  "cigs",
  "pokeball",
  "pcb",
  "can",
  "ramen",
  "gameboy",
]);

function getDeskItem(index: number): DeskItem {
  return DESK_ITEM_SEQUENCE[index % DESK_ITEM_SEQUENCE.length];
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface DeskSurfacesBaseProps {
  deskCount: number;
  occupiedDesks: Set<number>;
  deskTexture: Texture | null;
  keyboardTexture: Texture | null;
  /** Échelle de chaque poste autour de son origine (1 par défaut). */
  deskScale?: number;
  /** Positions des postes (défaut : `getDeskOrigin`). */
  originFn?: (n: number) => { x: number; y: number };
}

/**
 * Renders desk surfaces and keyboards (behind agent arms).
 */
export function DeskSurfacesBase({
  deskCount,
  occupiedDesks,
  deskTexture,
  keyboardTexture,
  deskScale = 1,
  originFn,
}: DeskSurfacesBaseProps): ReactNode {
  const desks = useDeskPositions(deskCount, occupiedDesks, originFn);

  return (
    <>
      {desks.map((desk, i) => (
        <pixiContainer key={i} x={desk.x} y={desk.y} scale={deskScale}>
          {/* Desk surface */}
          {deskTexture && (
            <pixiSprite
              texture={deskTexture}
              anchor={{ x: 0.5, y: 0 }}
              y={30}
              scale={0.105}
            />
          )}
          {/* RGB gaming PC under the desk (left side, drawers are on the right) */}
          <pixiContainer x={-54} y={66} alpha={desk.isEmpty ? 0.45 : 1}>
            <RgbTower phase={i * 0.7} />
          </pixiContainer>
          {/* Keyboard - front of desk surface (near chair, agent types here) */}
          {keyboardTexture && (
            <pixiSprite
              texture={keyboardTexture}
              anchor={0.5}
              x={0}
              y={42}
              scale={0.04}
            />
          )}
        </pixiContainer>
      ))}
    </>
  );
}

/** LED texts for desks nobody sits at (one per desk, stable). */
const EMPTY_DESK_LABELS = [
  "PERSONNE ICI",
  "PARTI PECHER",
  "POSTE LIBRE",
  "PAUSE DEJEUNER",
  "REVIENS JAMAIS",
  "PAS D'AGENT, PAS DE BUG",
  "ON RECRUTE...",
  "ZZZ",
];

interface DeskSurfacesTopProps {
  deskCount: number;
  occupiedDesks: Set<number>;
  deskTasks: Map<number, string>;
  deskBadges: Map<number, LedBadge>;
  monitorTexture: Texture | null;
  coffeeMugTexture: Texture | null;
  thermosTexture: Texture | null;
  /** Pas de bandeau LED ni de marquee (le Bureau général a des plaques). */
  hideLedStrip?: boolean;
  /** Échelle de chaque poste autour de son origine (1 par défaut). */
  deskScale?: number;
  /** Positions des postes (défaut : `getDeskOrigin`). */
  originFn?: (n: number) => { x: number; y: number };
}

/**
 * Renders monitors and desk decorations (in front of agent arms).
 */
export function DeskSurfacesTop({
  deskCount,
  occupiedDesks,
  deskTasks,
  deskBadges,
  monitorTexture,
  coffeeMugTexture,
  thermosTexture,
  hideLedStrip = false,
  deskScale = 1,
  originFn,
}: DeskSurfacesTopProps): ReactNode {
  const desks = useDeskPositions(deskCount, occupiedDesks, originFn);

  return (
    <>
      {desks.map((desk, i) => (
        <pixiContainer key={i} x={desk.x} y={desk.y} scale={deskScale}>
          {/* Monitor - back of desk surface (far from chair) */}
          {monitorTexture && (
            <pixiSprite
              texture={monitorTexture}
              anchor={0.5}
              x={-45}
              y={27}
              scale={0.08}
            />
          )}
          {/* Desk accessory - right corner, cycles through items */}
          {getDeskItem(i) === "mug" && coffeeMugTexture && (
            <pixiSprite
              texture={coffeeMugTexture}
              anchor={0.5}
              x={50}
              y={40}
              scale={0.025}
              tint={ACCESSORY_TINTS[i % ACCESSORY_TINTS.length]}
            />
          )}
          {getDeskItem(i) === "thermos" && thermosTexture && (
            <pixiSprite
              texture={thermosTexture}
              anchor={0.5}
              x={52}
              y={40}
              scale={0.36}
            />
          )}
          {FUN_KINDS.has(getDeskItem(i)) && (
            <DeskFunItem kind={getDeskItem(i) as FunItemKind} x={52} y={47} />
          )}
          {/* Task marquee on desk surface - only for occupied desks */}
          {!hideLedStrip && <DeskMarquee text={deskTasks.get(i + 1) ?? ""} />}
          {/* LED strip: client + agent type + model in the provider colour
              when seated, a joke when empty */}
          {hideLedStrip ? null : deskBadges.has(i + 1) ? (
            <DeskMarquee
              text={deskBadges.get(i + 1)!.text.toUpperCase()}
              color={deskBadges.get(i + 1)!.color}
              y={87}
            />
          ) : (
            <DeskMarquee
              text={EMPTY_DESK_LABELS[i % EMPTY_DESK_LABELS.length]}
              color="#b8892a"
              y={87}
            />
          )}
        </pixiContainer>
      ))}
    </>
  );
}
