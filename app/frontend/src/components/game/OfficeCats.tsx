/**
 * OfficeCats - les deux chats du bureau (noir et roux). Même principe que
 * OfficeDog : un seul useTick, état en ref, zIndex = y des pieds pour le tri
 * en profondeur. Les images viennent de constants/officeCats.json.
 */

import { extend, useTick } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import { useMemo, useRef, type ReactNode } from "react";
import catData from "@/constants/officeCats.json";
import { useGameStore } from "@/stores/gameStore";
import { useDarkness } from "@/hooks/useDarkness";
import { getNavigationGrid } from "@/systems/navigationGrid";
import {
  CAT_DROP_FALL_S,
  CAT_DROP_HEIGHT,
  CAT_DROP_LIFE_S,
  catPose,
  createCats,
  sleepScaleFor,
  stepCats,
  type CatState,
} from "@/systems/catBehavior";
import { longWorkers, petShared } from "@/systems/petShared";
import type { PetWalk } from "@/systems/petSite";

extend({ Container, Graphics });

const PIXEL: number = catData.pixel;
const FRAMES = catData.frames as string[][];

function drawFrame(
  g: Graphics,
  frame: string[],
  palette: Record<string, string>,
): void {
  g.clear();
  for (let row = 0; row < frame.length; row++) {
    const line = frame[row];
    for (let col = 0; col < line.length; col++) {
      const color = palette[line[col]];
      if (!color) continue;
      g.rect(col * PIXEL, row * PIXEL, PIXEL, PIXEL).fill(color);
    }
  }
}

interface CatSpriteProps {
  index: number;
  catsRef: { current: CatState[] | null };
}

function CatSprite({ index, catsRef }: CatSpriteProps): ReactNode {
  const rootRef = useRef<Container>(null);
  const bodyRef = useRef<Container>(null);
  const poseRefs = useRef<(Graphics | null)[]>([]);
  const palette = catData.cats[index].palette as Record<string, string>;

  const drawers = useMemo(
    () => FRAMES.map((f) => (g: Graphics) => drawFrame(g, f, palette)),
    [palette],
  );

  useTick(() => {
    const root = rootRef.current;
    const body = bodyRef.current;
    const cat = catsRef.current?.[index];
    if (!root || !body || !cat) return;
    const pose = catPose(cat);
    root.visible = true;
    root.x = Math.round(cat.x);
    root.y = Math.round(cat.y);
    root.zIndex = cat.y;
    body.scale.x = cat.facing;
    poseRefs.current.forEach((g, i) => {
      if (g) g.visible = i === pose;
    });
  });

  return (
    <pixiContainer ref={rootRef} visible={false}>
      {/* Corps centré en x, pieds (bas du sprite) sur la position */}
      <pixiContainer ref={bodyRef}>
        {drawers.map((draw, i) => {
          const rows = FRAMES[i].length;
          const cols = FRAMES[i][0].length;
          return (
            <pixiGraphics
              key={i}
              ref={(g: Graphics | null) => {
                poseRefs.current[i] = g;
              }}
              draw={draw}
              x={-(cols * PIXEL) / 2}
              y={-rows * PIXEL}
              visible={i === 0}
            />
          );
        })}
      </pixiContainer>
    </pixiContainer>
  );
}

/** Tasse poussée par un chat : tombe, rebondit un peu, laisse une flaque. */
function drawMug(g: Graphics): void {
  g.clear();
  g.rect(-4, -8, 8, 8).fill("#f2f2f2");
  g.rect(-4, -5, 8, 2).fill("#d9534f");
  g.rect(4, -6, 3, 4).fill("#f2f2f2");
}

function drawPuddle(g: Graphics): void {
  g.clear();
  g.rect(-9, -2, 18, 3).fill("#6b4423");
}

function CatDrop({ index, catsRef }: CatSpriteProps): ReactNode {
  const rootRef = useRef<Container>(null);
  const mugRef = useRef<Graphics>(null);
  const puddleRef = useRef<Graphics>(null);

  useTick(() => {
    const root = rootRef.current;
    const mug = mugRef.current;
    const puddle = puddleRef.current;
    const drop = catsRef.current?.[index]?.drop;
    if (!root || !mug || !puddle) return;
    if (!drop) {
      root.visible = false;
      return;
    }
    root.visible = true;
    root.x = Math.round(drop.x);
    root.y = Math.round(drop.y);
    root.zIndex = drop.y;
    const t = Math.min(1, drop.age / CAT_DROP_FALL_S);
    // Chute (accélérée) puis petit rebond
    const lift =
      t < 1
        ? CAT_DROP_HEIGHT * (1 - t * t)
        : Math.max(
            0,
            4 *
              Math.sin(
                Math.min(1, (drop.age - CAT_DROP_FALL_S) / 0.25) * Math.PI,
              ),
          );
    mug.y = -lift;
    mug.rotation = drop.age > CAT_DROP_FALL_S ? 1.2 : t * 0.8;
    puddle.visible = drop.age > CAT_DROP_FALL_S;
    root.alpha = Math.min(1, (CAT_DROP_LIFE_S - drop.age) / 3);
  });

  return (
    <pixiContainer ref={rootRef} visible={false}>
      <pixiGraphics ref={puddleRef} draw={drawPuddle} visible={false} />
      <pixiGraphics ref={mugRef} draw={drawMug} />
    </pixiContainer>
  );
}

export interface OfficeCatsProps {
  /** Zone de marche et lieux ; absent : ceux de l'ancien bureau. */
  walk?: PetWalk;
}

export function OfficeCats({ walk }: OfficeCatsProps = {}): ReactNode {
  const catsRef = useRef<CatState[] | null>(null);
  const workSince = useRef(new Map<string, number>());
  const darkness = useDarkness();

  // Un seul tick pour l'état ; les sprites lisent catsRef
  useTick((ticker) => {
    const grid = walk?.grid ?? getNavigationGrid();
    if (!catsRef.current) {
      catsRef.current = createCats(grid, Math.random, walk?.site);
      if (!catsRef.current) return;
    }
    for (const cat of catsRef.current) cat.sleepScale = sleepScaleFor(darkness);
    // Un agent qui attend (réponse ou permission) ou qui travaille depuis
    // plus de 90 s attire la visite d'un chat.
    const agents = useGameStore.getState().agents;
    const visit: { x: number; y: number }[] = longWorkers(
      workSince.current,
      agents.values(),
      Date.now(),
    );
    for (const a of agents.values()) {
      if (
        a.backendState === "waiting" ||
        a.backendState === "waiting_permission"
      )
        visit.push(a.currentPosition);
    }
    stepCats(catsRef.current, ticker.deltaMS, grid, Math.random, visit);
    petShared.catsPlaying = catsRef.current.some((c) => c.mode === "play");
  });

  return (
    <>
      {catData.cats.map((_, i) => (
        <CatSprite key={i} index={i} catsRef={catsRef} />
      ))}
      {catData.cats.map((_, i) => (
        <CatDrop key={`drop${i}`} index={i} catsRef={catsRef} />
      ))}
    </>
  );
}
