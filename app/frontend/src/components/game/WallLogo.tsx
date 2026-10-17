"use client";

import { Assets, Texture } from "pixi.js";
import { useEffect, useState, type ReactNode } from "react";
import { WALL_LOGO_POSITION } from "@/constants/positions";

const LOGO_SIZE = 80;

/** Wall logo with a small "Bureau entreprise" caption below. */
export function WallLogo(): ReactNode {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    const assetPath = "/sprites/logo-bureau-wall.png";
    Assets.load(assetPath)
      .then((t) => setTexture(t as Texture))
      .catch((err) => {
        console.warn(`[WallLogo] Failed to load ${assetPath}:`, err);
      });
  }, []);

  return (
    <pixiContainer x={WALL_LOGO_POSITION.x} y={WALL_LOGO_POSITION.y}>
      {texture && (
        <pixiSprite
          texture={texture}
          anchor={0.5}
          width={LOGO_SIZE}
          height={LOGO_SIZE}
        />
      )}
      <pixiContainer y={LOGO_SIZE / 2 + 12} scale={0.5}>
        <pixiText
          text="Bureau entreprise"
          anchor={0.5}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 20,
            fontWeight: "bold",
            fill: "#F3F1EC",
          }}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}
