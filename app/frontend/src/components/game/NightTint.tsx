"use client";

import { Graphics } from "pixi.js";
import { useCallback, type ReactNode } from "react";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/canvas";
import { useDarkness } from "@/hooks/useDarkness";

/** Opacité maximale du voile de nuit (la pièce reste lisible). */
const MAX_ALPHA = 0.2;
/**
 * Voile bleu nuit sur tout le bureau : la pièce s'assombrit le soir, comme la
 * fenêtre et l'horloge qui suivent l'heure du PC.
 */
export function NightTint(): ReactNode {
  const darkness = useDarkness();

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      if (darkness <= 0) return;
      g.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      g.fill({ color: 0x0a1038, alpha: MAX_ALPHA * darkness });
    },
    [darkness],
  );

  return <pixiGraphics draw={draw} eventMode="none" />;
}
