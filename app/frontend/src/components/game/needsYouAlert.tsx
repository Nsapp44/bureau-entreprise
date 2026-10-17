/**
 * Alerte « a besoin de toi » partagée : secousse + lueur du corps, halo et
 * badge « ! » pulsants. Utilisée par BossSprite (bureau d'une conversation)
 * et par les postes du Bureau général.
 */

"use client";

import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { useTick } from "@pixi/react";
import { Container, Graphics, TextStyle } from "pixi.js";

export const ATTENTION_COLOR = 0xff5a3c;
export const ATTENTION_PERIOD_MS = 2000;

const ATTENTION_MARK_STYLE: Partial<TextStyle> = {
  fontFamily: "monospace",
  fontSize: 22,
  fontWeight: "bold",
  fill: 0xffffff,
  stroke: { width: 3, color: 0x111111 },
};

const DESK_MARK_STYLE: Partial<TextStyle> = {
  fontFamily: "Arial, sans-serif",
  fontSize: 18,
  fontWeight: "bold",
  fill: 0x161514,
};

/** Double contour lumineux autour d'un corps arrondi centré sur (0, 0). */
export function drawAttentionGlow(
  g: Graphics,
  width: number,
  height: number,
): void {
  g.clear();
  g.roundRect(-width / 2, -height / 2, width, height, width / 2);
  g.stroke({ width: 12, color: ATTENTION_COLOR, alpha: 0.18 });
  g.roundRect(-width / 2, -height / 2, width, height, width / 2);
  g.stroke({ width: 6, color: ATTENTION_COLOR, alpha: 0.45 });
}

export function drawAttentionHalo(g: Graphics): void {
  g.clear();
  g.circle(0, 0, 24);
  g.fill({ color: ATTENTION_COLOR, alpha: 0.35 });
}

export function drawAttentionBadge(g: Graphics): void {
  g.clear();
  g.circle(0, 0, 16);
  g.fill(0x111111); // dark rim: readable on a white bubble
  g.circle(0, 0, 14.5);
  g.fill(0xffffff); // light ring: readable in the dark room
  g.circle(0, 0, 12);
  g.fill(ATTENTION_COLOR);
}

/** Pastille 26 px de la maquette : disque corail, bordure 2 px claire. */
function drawDeskBadge(g: Graphics): void {
  g.clear();
  g.circle(0, 0, 13);
  g.fill(0xf3f1ec);
  g.circle(0, 0, 11);
  g.fill(ATTENTION_COLOR);
}

interface ShakeOptions {
  active: boolean;
  /** Conteneurs secoués (déplacés de baseY + secousse). */
  targets: RefObject<Container | null>[];
  /** Lueur dont l'opacité pulse (optionnelle). */
  glowRef?: RefObject<Graphics | null>;
  /** Ordonnée de repos des conteneurs secoués. */
  baseY: number;
  /** Change => remise à zéro avant affichage (ex. texture du casque). */
  resetKey?: unknown;
}

/**
 * Secousse + pulsation de la lueur pendant l'alerte. Position remise à
 * l'état de repos avant la peinture, y compris quand l'alerte s'arrête.
 */
export function useNeedsYouShake({
  active,
  targets,
  glowRef,
  baseY,
  resetKey,
}: ShakeOptions): void {
  const timeRef = useRef(0);

  const optsRef = useRef({ targets, glowRef, baseY });
  useLayoutEffect(() => {
    optsRef.current = { targets, glowRef, baseY };
  });

  const applyFrame = useCallback((x: number, y: number, pulse: number) => {
    const o = optsRef.current;
    for (const ref of o.targets) {
      ref.current?.position.set(x, o.baseY + y);
    }
    if (o.glowRef?.current) {
      o.glowRef.current.alpha = 0.45 + pulse * 0.55;
    }
  }, []);

  useLayoutEffect(() => {
    timeRef.current = 0;
    applyFrame(0, 0, 0);
    return () => {
      timeRef.current = 0;
      applyFrame(0, 0, 0);
    };
  }, [active, resetKey, applyFrame]);

  useTick((ticker) => {
    if (!active) return;
    timeRef.current = (timeRef.current + ticker.deltaMS) % ATTENTION_PERIOD_MS;
    const phase = (timeRef.current / ATTENTION_PERIOD_MS) * Math.PI * 2;
    const pulse = (1 - Math.cos(phase)) / 2;
    applyFrame(Math.sin(phase * 8) * pulse, -3 * pulse, pulse);
  });
}

interface NeedsYouBadgeProps {
  x: number;
  y: number;
  /** "boss" : pastille d'origine ; "desk" : pastille 26 px de la maquette. */
  variant?: "boss" | "desk";
}

/** « ! » pulsant avec halo. */
function NeedsYouBadgeComponent({
  x,
  y,
  variant = "boss",
}: NeedsYouBadgeProps): ReactNode {
  const badgeRef = useRef<Container | null>(null);
  const haloRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);

  useTick((ticker) => {
    timeRef.current = (timeRef.current + ticker.deltaMS) % ATTENTION_PERIOD_MS;
    const phase = (timeRef.current / ATTENTION_PERIOD_MS) * Math.PI * 2;
    const pulse = (1 - Math.cos(phase)) / 2;
    badgeRef.current?.scale.set(1 + pulse * 0.15);
    if (haloRef.current) {
      haloRef.current.alpha = 0.3 + pulse * 0.7;
      haloRef.current.scale.set(1 + pulse * 0.25);
    }
  });

  const desk = variant === "desk";
  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics ref={haloRef} draw={drawAttentionHalo} />
      <pixiContainer ref={badgeRef}>
        <pixiGraphics draw={desk ? drawDeskBadge : drawAttentionBadge} />
        <pixiText
          text="!"
          anchor={0.5}
          y={1}
          style={desk ? DESK_MARK_STYLE : ATTENTION_MARK_STYLE}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const NeedsYouBadge = memo(NeedsYouBadgeComponent);
