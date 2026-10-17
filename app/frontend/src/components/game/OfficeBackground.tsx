/**
 * OfficeBackground — ambiance graphite.
 * Sol en grandes dalles, mur maillé et plinthe.
 */

import { type ReactNode, useMemo, useCallback } from "react";
import { Graphics, Texture } from "pixi.js";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "@/constants/canvas";

const WALL_HEIGHT = 250;
const WALL_TRIM_HEIGHT = 10;
const TILE_WIDTH = 240;
const TILE_HEIGHT = 160;

const FLOOR_JOINT_COLOR = 0x171a1e;
const TILE_LIGHT = 0x292d33;
const TILE_DARK = 0x25292f;
const WALL_COLOR = 0x1a1d22;
const WALL_TRIM_COLOR = 0x111419;
const WALL_ACCENT_COLOR = 0xff5a3c;
const WALL_MESH_COLOR = 0xf3f1ec;
const WALL_MESH_ALPHA = 0.08;
const WALL_MESH_CELL = 80;

interface OfficeBackgroundProps {
  floorTileTexture?: Texture | null;
}

interface TileData {
  x: number;
  y: number;
  width: number;
  height: number;
  tint: number;
}

function drawWalls(g: Graphics): void {
  g.rect(0, 0, CANVAS_WIDTH, WALL_HEIGHT).fill(WALL_COLOR);

  // Le maillage triangulé du mur du fond est conservé.
  const meshBottom = WALL_HEIGHT - WALL_TRIM_HEIGHT;
  const cols = Math.ceil(CANVAS_WIDTH / WALL_MESH_CELL);
  const rows = Math.ceil(meshBottom / WALL_MESH_CELL);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c * WALL_MESH_CELL;
      const y0 = r * WALL_MESH_CELL;
      const x1 = Math.min(x0 + WALL_MESH_CELL, CANVAS_WIDTH);
      const y1 = Math.min(y0 + WALL_MESH_CELL, meshBottom);

      if ((r + c) % 2 === 0) {
        g.moveTo(x0, y0).lineTo(x1, y1);
      } else {
        g.moveTo(x1, y0).lineTo(x0, y1);
      }

      g.moveTo(x0, y0).lineTo(x1, y0);
      g.moveTo(x0, y0).lineTo(x0, y1);
    }
  }

  g.stroke({
    width: 1,
    color: WALL_MESH_COLOR,
    alpha: WALL_MESH_ALPHA,
  });

  g.rect(
    0,
    WALL_HEIGHT - WALL_TRIM_HEIGHT,
    CANVAS_WIDTH,
    WALL_TRIM_HEIGHT,
  ).fill(WALL_TRIM_COLOR);

  g.rect(
    0,
    WALL_HEIGHT - WALL_TRIM_HEIGHT,
    CANVAS_WIDTH,
    1,
  ).fill(0x383d45);

  g.rect(0, WALL_HEIGHT - 3, CANVAS_WIDTH, 3).fill(WALL_ACCENT_COLOR);
}

export function OfficeBackground({
  floorTileTexture,
}: OfficeBackgroundProps): ReactNode {
  const tiles = useMemo(() => {
    const result: TileData[] = [];

    for (let y = WALL_HEIGHT; y < CANVAS_HEIGHT; y += TILE_HEIGHT) {
      const row = Math.floor((y - WALL_HEIGHT) / TILE_HEIGHT);

      for (let x = 0; x < CANVAS_WIDTH; x += TILE_WIDTH) {
        const column = Math.floor(x / TILE_WIDTH);
        const width = Math.min(TILE_WIDTH, CANVAS_WIDTH - x) - 1;
        const height = Math.min(TILE_HEIGHT, CANVAS_HEIGHT - y) - 1;

        if (width <= 0 || height <= 0) continue;

        result.push({
          x: x + 1,
          y: y + 1,
          width,
          height,
          tint: (row + column) % 2 === 0 ? TILE_LIGHT : TILE_DARK,
        });
      }
    }

    return result;
  }, []);

  const drawBackground = useCallback(
    (g: Graphics): void => {
      g.clear();

      g.rect(
        0,
        WALL_HEIGHT,
        CANVAS_WIDTH,
        Math.max(0, CANVAS_HEIGHT - WALL_HEIGHT),
      ).fill(FLOOR_JOINT_COLOR);

      for (const tile of tiles) {
        g.rect(tile.x, tile.y, tile.width, tile.height).fill(tile.tint);
      }

      drawWalls(g);
    },
    [tiles],
  );

  return (
    <>
      <pixiGraphics draw={drawBackground} />

      {floorTileTexture &&
        tiles.map((tile) => (
          <pixiSprite
            key={`${tile.x}:${tile.y}`}
            texture={floorTileTexture}
            x={tile.x}
            y={tile.y}
            width={tile.width}
            height={tile.height}
            anchor={0}
            tint={tile.tint}
            alpha={0.16}
          />
        ))}
    </>
  );
}
