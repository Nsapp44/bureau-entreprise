"use client";

/**
 * "God mode" decorations for the boss (Claude): rotating light rays and a
 * pulsing glow behind him, a floating golden halo and glowing eyes.
 * Animations only touch refs (no React re-render per frame).
 */

import { Graphics } from "pixi.js";
import { useTick } from "@pixi/react";
import { useCallback, useRef, type ReactNode } from "react";

const GOLD = 0xffd54a;
const GOLD_LIGHT = 0xfff2a8;
const RAY_COUNT = 12;
const RAY_LENGTH = 78;
const SPARKS = 7;

function drawRays(g: Graphics): void {
  g.clear();
  for (let i = 0; i < RAY_COUNT; i++) {
    const a = (i / RAY_COUNT) * Math.PI * 2;
    const spread = 0.09;
    g.poly([
      0,
      0,
      Math.cos(a - spread) * RAY_LENGTH,
      Math.sin(a - spread) * RAY_LENGTH,
      Math.cos(a + spread) * RAY_LENGTH,
      Math.sin(a + spread) * RAY_LENGTH,
    ]);
    g.fill({ color: GOLD, alpha: i % 2 ? 0.1 : 0.16 });
  }
}

function drawGlow(g: Graphics): void {
  g.clear();
  for (let r = 56; r > 0; r -= 8) {
    g.circle(0, 0, r);
    g.fill({ color: GOLD_LIGHT, alpha: 0.05 });
  }
}

function drawSpark(g: Graphics): void {
  g.clear();
  g.rect(-1, -3, 2, 6);
  g.rect(-3, -1, 6, 2);
  g.fill(GOLD_LIGHT);
}

/** Rays + glow + rising sparkles, drawn behind the boss's chair. */
export function GodAura({ y }: { y: number }): ReactNode {
  const raysRef = useRef<Graphics | null>(null);
  const glowRef = useRef<Graphics | null>(null);
  const sparkRefs = useRef<(Graphics | null)[]>([]);
  const timeRef = useRef(0);

  useTick((ticker) => {
    timeRef.current += ticker.deltaMS / 1000;
    const t = timeRef.current;
    if (raysRef.current) raysRef.current.rotation = t * 0.15;
    if (glowRef.current) {
      const s = 1 + Math.sin(t * 2) * 0.08;
      glowRef.current.scale.set(s);
      glowRef.current.alpha = 0.75 + Math.sin(t * 2) * 0.25;
    }
    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return;
      const phase = (t * 0.35 + i / SPARKS) % 1;
      spark.x = Math.round(Math.sin(i * 2.4 + t * 0.8) * (26 + (i % 3) * 10));
      spark.y = Math.round(30 - phase * 90);
      spark.alpha = Math.sin(phase * Math.PI);
    });
  });

  return (
    <pixiContainer y={y}>
      <pixiGraphics ref={raysRef} draw={drawRays} />
      <pixiGraphics ref={glowRef} draw={drawGlow} />
      {Array.from({ length: SPARKS }, (_, i) => (
        <pixiGraphics
          key={i}
          ref={(g: Graphics | null) => {
            sparkRefs.current[i] = g;
          }}
          draw={drawSpark}
        />
      ))}
    </pixiContainer>
  );
}

/** Floating golden halo above the head. */
export function GodHalo({ y }: { y: number }): ReactNode {
  const haloRef = useRef<Graphics | null>(null);
  const timeRef = useRef(0);

  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.ellipse(0, 0, 19, 6);
    g.stroke({ width: 7, color: GOLD, alpha: 0.25 });
    g.ellipse(0, 0, 17, 5);
    g.stroke({ width: 3, color: GOLD });
    g.ellipse(0, -1, 17, 5);
    g.stroke({ width: 1, color: GOLD_LIGHT });
  }, []);

  useTick((ticker) => {
    timeRef.current += ticker.deltaMS / 1000;
    if (haloRef.current) {
      haloRef.current.y = y + Math.round(Math.sin(timeRef.current * 2.2) * 2);
    }
  });

  return <pixiGraphics ref={haloRef} draw={draw} y={y} />;
}

/** Glowing eyes (replaces the old sunglasses). */
export function drawGodEyes(g: Graphics): void {
  g.clear();
  g.circle(-8, 0, 6);
  g.circle(8, 0, 6);
  g.fill({ color: GOLD, alpha: 0.3 });
  g.rect(-11, -2, 6, 5);
  g.rect(5, -2, 6, 5);
  g.fill(GOLD_LIGHT);
  g.rect(-9, -1, 2, 2);
  g.rect(7, -1, 2, 2);
  g.fill(0xffffff);
}
