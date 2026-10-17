/**
 * OfficeDog - Austin, le chien du bureau. Un seul useTick, position en ref
 * (pas de re-render React, pas de store global). Le zIndex du conteneur est
 * mis a jour a chaque tick (= y des pieds) pour le tri en profondeur.
 */

import { extend, useTick } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";
import { useMemo, useRef, type ReactNode } from "react";
import dogData from "@/constants/austinDog.json";
import { useGameStore } from "@/stores/gameStore";
import {
  GRID_HEIGHT,
  GRID_WIDTH,
  getNavigationGrid,
} from "@/systems/navigationGrid";
import {
  createDog,
  listFreeTiles,
  stepDog,
  type DogState,
} from "@/systems/dogBehavior";
import { longWorkers, petShared } from "@/systems/petShared";
import type { PetWalk } from "@/systems/petSite";

extend({ Container, Graphics, Text });

const PIXEL: number = dogData.pixel;
const PALETTE = dogData.palette as Record<string, string>;
const FRAMES = dogData.frames as string[][];
const COLS = FRAMES[0][0].length;
const ROWS = FRAMES[0].length;

function drawFrame(g: Graphics, frame: string[]): void {
  g.clear();
  for (let row = 0; row < frame.length; row++) {
    const line = frame[row];
    for (let col = 0; col < line.length; col++) {
      const color = PALETTE[line[col]];
      if (!color) continue;
      g.rect(col * PIXEL, row * PIXEL, PIXEL, PIXEL).fill(color);
    }
  }
}

export interface OfficeDogProps {
  /** Zone de marche et lieux ; absent : ceux de l'ancien bureau. */
  walk?: PetWalk;
}

export function OfficeDog({ walk }: OfficeDogProps = {}): ReactNode {
  const rootRef = useRef<Container>(null);
  const bodyRef = useRef<Container>(null);
  const frameRefs = useRef<(Graphics | null)[]>([null, null]);
  const dogRef = useRef<DogState | null>(null);
  const workSince = useRef(new Map<string, number>());

  // Graphics precalcules une fois par frame ; le sens = scale.x
  const drawers = useMemo(
    () => FRAMES.map((f) => (g: Graphics) => drawFrame(g, f)),
    [],
  );

  useTick((ticker) => {
    const root = rootRef.current;
    const body = bodyRef.current;
    const f0 = frameRefs.current[0];
    const f1 = frameRefs.current[1];
    if (!root || !body || !f0 || !f1) return;
    const grid = walk?.grid ?? getNavigationGrid();
    const cols = walk?.grid.cols ?? GRID_WIDTH;
    const rows = walk?.grid.rows ?? GRID_HEIGHT;

    if (!dogRef.current) {
      const tiles = listFreeTiles(grid, cols, rows);
      if (tiles.length === 0) return;
      dogRef.current = createDog(
        tiles[Math.floor(Math.random() * tiles.length)],
        walk?.site,
      );
    }
    const dog = dogRef.current;

    // Il vient près des agents qui travaillent depuis un moment (> 90 s).
    const visit = longWorkers(
      workSince.current,
      useGameStore.getState().agents.values(),
      Date.now(),
    );
    stepDog(
      dog,
      ticker.deltaMS,
      grid,
      cols,
      rows,
      visit,
      Math.random,
      petShared.catsPlaying,
    );

    root.visible = true;
    root.x = Math.round(dog.x);
    root.y = Math.round(dog.y);
    root.zIndex = dog.y;
    body.scale.x = dog.facing;
    f0.visible = dog.frame === 0;
    f1.visible = dog.frame === 1;
  });

  const w = COLS * PIXEL;
  const h = ROWS * PIXEL;

  return (
    <pixiContainer ref={rootRef} visible={false}>
      {/* Corps centre en x, pieds (bas du sprite) sur la position */}
      <pixiContainer ref={bodyRef} y={-h}>
        {drawers.map((draw, i) => (
          <pixiGraphics
            key={i}
            ref={(g: Graphics | null) => {
              frameRefs.current[i] = g;
            }}
            draw={draw}
            x={-w / 2}
            visible={i === 0}
          />
        ))}
      </pixiContainer>
      <pixiText
        text={dogData.name}
        anchor={0.5}
        y={-h - 8}
        style={{
          fontFamily: "monospace",
          fontSize: 16,
          fill: 0xffffff,
          fontWeight: "bold",
          stroke: { width: 3, color: 0x000000 },
        }}
        scale={0.5}
        resolution={2}
      />
    </pixiContainer>
  );
}
