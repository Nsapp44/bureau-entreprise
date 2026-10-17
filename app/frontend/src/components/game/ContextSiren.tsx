"use client";

import type { Graphics } from "pixi.js";
import { useCallback, useRef, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { useCurrentContext } from "@/hooks/useUsage";
import { formatTokens } from "@/utils/tokenFormat";

/**
 * Module mural près de la machine à café : petit écran avec le contexte de la
 * session active (tokens) et, au-dessus, un gyrophare silencieux qui tourne
 * quand la conversation est trop lourde (seuils 60 k / 110 k côté backend).
 */

const W = 100;
const H = 64;

const COLORS = {
  ok: 0x43c35b,
  heavy: 0xff8c1a,
  critical: 0xe53935,
} as const;

const drawNothing = (g: Graphics): void => {
  g.clear();
};

function Beacon(): ReactNode {
  const beamRef = useRef<Graphics | null>(null);
  const angleRef = useRef(0);

  const drawBase = useCallback((g: Graphics) => {
    g.clear();
    g.roundRect(-14, -3, 28, 5, 2);
    g.fill(0x2a2e36);
    g.roundRect(-9, -12, 18, 10, 5);
    g.fill(0xc62828);
    g.roundRect(-6, -10, 6, 4, 2);
    g.fill({ color: 0xffcdd2, alpha: 0.7 });
  }, []);

  useTick((ticker) => {
    const g = beamRef.current;
    if (!g) return;
    angleRef.current += ticker.deltaTime * 0.12;
    const a = angleRef.current;
    const c = Math.cos(a);
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(a));
    g.clear();
    g.circle(0, -7, 12 + 4 * pulse);
    g.fill({ color: 0xff1744, alpha: 0.18 + 0.2 * pulse });
    const reach = c * 46;
    g.poly([0, -7, reach, -15, reach, 1]);
    g.fill({ color: 0xff5252, alpha: 0.4 * Math.abs(c) });
  });

  return (
    <pixiContainer x={W / 2} y={-1}>
      <pixiGraphics ref={beamRef} draw={drawNothing} />
      <pixiGraphics draw={drawBase} />
    </pixiContainer>
  );
}

export function ContextSiren(): ReactNode {
  const cur = useCurrentContext();
  const level = cur?.level ?? "ok";
  const color = COLORS[level];

  const drawPanel = useCallback((g: Graphics) => {
    g.clear();
    g.roundRect(3, 3, W, H, 5);
    g.fill({ color: 0x000000, alpha: 0.3 });
    g.roundRect(0, 0, W, H, 5);
    g.fill(0x16181d);
    g.stroke({ width: 3, color: 0x0a0b0e });
    g.rect(8, 8, W - 16, 14);
    g.fill(0xff6a13);
    g.roundRect(8, 26, W - 16, H - 34, 3);
    g.fill(0x0b0d10);
  }, []);

  if (!cur?.sessionId) return null;

  const text = (
    value: string,
    y: number,
    size: number,
    fill: string,
  ): ReactNode => (
    <pixiContainer x={W / 2} y={y} scale={0.5}>
      <pixiText
        text={value}
        anchor={0.5}
        style={{
          fontFamily: '"Arial Black", Arial, sans-serif',
          fontSize: size,
          fontWeight: "bold",
          fill,
        }}
        resolution={2}
      />
    </pixiContainer>
  );

  return (
    <pixiContainer>
      {level === "critical" && <Beacon />}
      <pixiGraphics draw={drawPanel} />
      {text("CONTEXTE", 15, 20, "#ffffff")}
      {text(
        formatTokens(cur.context),
        44,
        44,
        `#${color.toString(16).padStart(6, "0")}`,
      )}
    </pixiContainer>
  );
}
