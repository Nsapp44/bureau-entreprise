"use client";

/**
 * DeskFunItem - petits objets posés sur les bureaux, dessinés en pixel art
 * simple (bière, paquet de cigarettes, pokéball, circuit imprimé...).
 *
 * L'origine du dessin est le milieu du bord bas de l'objet : on le pose en
 * donnant la position du point de contact avec le bureau.
 */

import { memo, useCallback, type ReactNode } from "react";
import type { Graphics } from "pixi.js";

export type FunItemKind =
  "beer" | "cigs" | "pokeball" | "pcb" | "can" | "ramen" | "gameboy";

type Drawer = (g: Graphics) => void;

const DRAWERS: Record<FunItemKind, Drawer> = {
  // Bouteille de bière brune.
  beer: (g) => {
    g.rect(-3.5, -12, 7, 12).fill(0x7c4a14);
    g.rect(-1.75, -19, 3.5, 7).fill(0x7c4a14);
    g.rect(-2.5, -20.5, 5, 2).fill(0xd4af37);
    g.rect(-3.5, -9, 7, 4.5).fill(0xf5e6b3);
    g.rect(-2.5, -8, 5, 1.5).fill(0xb45309);
    g.rect(-2.5, -11, 1.2, 9).fill({ color: 0xffffff, alpha: 0.25 });
  },
  // Paquet de cigarettes (sans marque) avec une cigarette qui dépasse.
  cigs: (g) => {
    g.rect(-2.5, -17, 2, 5).fill(0xfafafa);
    g.rect(-2.5, -13.5, 2, 1.6).fill(0xf59e0b);
    g.rect(-5.5, -13, 11, 13).fill(0xf3f4f6);
    g.rect(-5.5, -13, 11, 4.5).fill(0xb91c1c);
    g.rect(-1.5, -7.5, 3, 3).fill(0x111827);
    g.rect(-5.5, -1.5, 11, 1.5).fill({ color: 0x000000, alpha: 0.15 });
  },
  // Pokéball.
  pokeball: (g) => {
    g.circle(0, -7, 7).fill(0xf8fafc);
    g.moveTo(0, -7)
      .arc(0, -7, 7, Math.PI, Math.PI * 2)
      .closePath()
      .fill(0xdc2626);
    g.rect(-7, -8.2, 14, 2.4).fill(0x111827);
    g.circle(0, -7, 2.6).fill(0xf8fafc).stroke({ width: 1.2, color: 0x111827 });
    g.circle(0, -7, 7).stroke({ width: 1.2, color: 0x111827 });
  },
  // Circuit imprimé : carte verte, puce noire, pastilles dorées.
  pcb: (g) => {
    g.rect(-9.5, -12, 19, 12).fill(0x15803d);
    g.rect(-9.5, -12, 19, 12).stroke({ width: 1, color: 0x14532d });
    g.rect(-3.5, -9.5, 7, 6).fill(0x111827);
    g.rect(-2, -8, 2, 2).fill({ color: 0xffffff, alpha: 0.25 });
    g.rect(-8, -10, 3, 2).fill(0x1f2937);
    g.rect(5, -4.5, 3.5, 2.5).fill(0xfbbf24);
    for (let i = 0; i < 5; i++) {
      g.rect(-7.5 + i * 3.5, -1.8, 1.6, 1.8).fill(0xfbbf24);
    }
    g.moveTo(-3.5, -6.5)
      .lineTo(-9, -6.5)
      .stroke({ width: 0.8, color: 0x4ade80 });
    g.moveTo(3.5, -7).lineTo(8.5, -7).lineTo(8.5, -9.5).stroke({
      width: 0.8,
      color: 0x4ade80,
    });
  },
  // Canette de boisson énergisante.
  can: (g) => {
    g.rect(-4, -14, 8, 14).fill(0x0f172a);
    g.rect(-4.5, -15.5, 9, 1.8).fill(0xcbd5e1);
    g.rect(-4.5, -1.5, 9, 1.5).fill(0x94a3b8);
    g.moveTo(1, -12)
      .lineTo(-2, -7)
      .lineTo(0.5, -7)
      .lineTo(-1, -2.5)
      .lineTo(2.5, -8.5)
      .lineTo(0, -8.5)
      .closePath()
      .fill(0xa3e635);
  },
  // Nouilles instantanées.
  ramen: (g) => {
    g.poly([-6.5, -11, 6.5, -11, 4.5, 0, -4.5, 0]).fill(0xdc2626);
    g.rect(-5.5, -8, 11, 2.5).fill(0xfacc15);
    g.rect(-7, -13, 14, 2.4).fill(0xf8fafc);
    g.rect(2, -19, 1.4, 7).fill(0xd6a461);
    g.rect(4.4, -18, 1.4, 6).fill(0xd6a461);
  },
  // Console portable grise.
  gameboy: (g) => {
    g.roundRect(-5.5, -16, 11, 16, 1.5).fill(0xc7c7bb);
    g.rect(-4, -14.5, 8, 6.5).fill(0x4b5563);
    g.rect(-3, -13.5, 6, 4.5).fill(0x8bac0f);
    g.rect(-4, -5.5, 3.2, 1).fill(0x374151);
    g.rect(-3, -6.5, 1, 3.2).fill(0x374151);
    g.circle(2, -4.3, 1).fill(0x9d174d);
    g.circle(4, -5.7, 1).fill(0x9d174d);
  },
};

// Demi-largeur de l'ombre, proportionnelle à l'emprise de chaque objet.
const SHADOW_HALF_WIDTH: Record<FunItemKind, number> = {
  beer: 5,
  cigs: 7,
  pokeball: 7,
  pcb: 10.5,
  can: 5.5,
  ramen: 7.5,
  gameboy: 6.5,
};

function DeskFunItemComponent({
  kind,
  x = 0,
  y = 0,
  scale = 1,
}: {
  kind: FunItemKind;
  x?: number;
  y?: number;
  scale?: number;
}): ReactNode {
  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      // Ombre portée sous l'objet.
      g.ellipse(0, 0.5, SHADOW_HALF_WIDTH[kind], 2).fill({
        color: 0x000000,
        alpha: 0.22,
      });
      DRAWERS[kind](g);
    },
    [kind],
  );
  return <pixiGraphics x={x} y={y} scale={scale} draw={draw} />;
}

export const DeskFunItem = memo(DeskFunItemComponent);
