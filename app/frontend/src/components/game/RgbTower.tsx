"use client";

/**
 * RgbTower - white glass mid-tower PC (Corsair 3500X style) standing under a
 * desk. Fans, RAM and the pump screen glow in colors that slowly cycle.
 * Fans are drawn white once and recolored through `tint` (no redraw per frame).
 */

import { Graphics } from "pixi.js";
import { useTick } from "@pixi/react";
import { useRef, type ReactNode } from "react";

const W = 24;
const H = 34;
const FANS = [
  { x: 19, y: 9 },
  { x: 19, y: 17 },
  { x: 19, y: 25 },
  { x: 8, y: 9 },
];

function drawCase(g: Graphics): void {
  g.clear();
  // Shell
  g.rect(0, 0, W, H);
  g.fill(0xeef0f2);
  g.stroke({ width: 1, color: 0x0c0c0f });
  // Top mesh
  g.rect(2, 1, W - 4, 2);
  g.fill(0xc9ccd1);
  // Interior seen through the glass
  g.rect(2, 4, W - 4, H - 8);
  g.fill(0x2a2d33);
  // Motherboard + GPU
  g.rect(3, 15, 12, 3);
  g.fill(0xdfe2e6);
  g.rect(3, 18, 12, 1);
  g.fill(0x9aa1ab);
  // PSU shroud
  g.rect(2, H - 8, W - 4, 4);
  g.fill(0xdfe2e6);
  // Glass reflection
  g.rect(3, 5, 1, 8);
  g.fill({ color: 0xffffff, alpha: 0.35 });
  // Feet
  g.rect(1, H, 4, 2);
  g.rect(W - 5, H, 4, 2);
  g.fill(0xc9ccd1);
}

function drawFan(g: Graphics): void {
  g.clear();
  g.circle(0, 0, 3.5);
  g.fill({ color: 0xffffff, alpha: 0.35 });
  g.circle(0, 0, 3.5);
  g.stroke({ width: 1, color: 0xffffff });
  g.rect(-0.5, -3, 1, 6);
  g.rect(-3, -0.5, 6, 1);
  g.fill({ color: 0xffffff, alpha: 0.6 });
  g.circle(0, 0, 1);
  g.fill(0xffffff);
}

function drawGlow(g: Graphics): void {
  g.clear();
  // RAM sticks + pump screen
  g.rect(11, 6, 1, 6);
  g.rect(13, 6, 1, 6);
  g.rect(5, 12, 4, 2);
  g.fill(0xffffff);
}

/** HSL (h in [0,1]) to a 0xRRGGBB number, full saturation, light 60%. */
function hue(h: number): number {
  const f = (n: number): number => {
    const k = (n + h * 12) % 12;
    const v = 0.6 - 0.4 * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

export function RgbTower({ phase = 0 }: { phase?: number }): ReactNode {
  const fanRefs = useRef<(Graphics | null)[]>([]);
  const glowRef = useRef<Graphics | null>(null);
  const timeRef = useRef(phase * 1000);

  useTick((ticker) => {
    timeRef.current += ticker.deltaMS;
    const t = timeRef.current / 6000;
    fanRefs.current.forEach((fan, i) => {
      if (!fan) return;
      fan.tint = hue((t + i * 0.08) % 1);
      fan.rotation = timeRef.current / 120;
    });
    if (glowRef.current) glowRef.current.tint = hue((t + 0.5) % 1);
  });

  return (
    <pixiContainer>
      <pixiGraphics draw={drawCase} />
      <pixiGraphics ref={glowRef} draw={drawGlow} />
      {FANS.map((f, i) => (
        <pixiGraphics
          key={i}
          ref={(g: Graphics | null) => {
            fanRefs.current[i] = g;
          }}
          x={f.x}
          y={f.y}
          draw={drawFan}
        />
      ))}
    </pixiContainer>
  );
}
