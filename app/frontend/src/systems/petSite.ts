/**
 * Lieux et zone de marche des animaux (chiens, chats).
 *
 * Par défaut : ceux de l'ancien bureau (constantes de positions.ts, grille de
 * navigation du bureau). Une scène différente (ex. Conversations) fournit son
 * propre `PetWalk` : lieux (canapé, gamelles, arbre, jeu) et grille de marche
 * qui exclut les postes et les meubles.
 */

import type { Position } from "@/types";
import {
  CAT_FOOD_STAND,
  CAT_PLAY_CENTER,
  CAT_SLEEP_SPOTS,
  CAT_SOFA_SPOT,
  CAT_SOFA_STAND,
  CAT_TREE_BASE,
  CAT_WATER_STAND,
} from "@/constants/positions";
import {
  TILE_SIZE,
  TileType,
  type GridPosition,
  type PathGrid,
} from "./navigationGrid";

export interface PetSite {
  /** Canapé : place du chat endormi (pieds) et case libre devant. */
  sofaSpot: Position;
  sofaStand: Position;
  /** Cases où l'on se tient pour boire / manger. */
  waterStand: Position;
  foodStand: Position;
  /** Pied de l'arbre à chat et niches où dorment les chats. */
  treeBase: Position;
  sleepSpots: Position[];
  /** Centre de la zone de jeu. */
  playCenter: Position;
}

/** Lieux de l'ancien bureau. */
export const DEFAULT_PET_SITE: PetSite = {
  sofaSpot: CAT_SOFA_SPOT,
  sofaStand: CAT_SOFA_STAND,
  waterStand: CAT_WATER_STAND,
  foodStand: CAT_FOOD_STAND,
  treeBase: CAT_TREE_BASE,
  sleepSpots: CAT_SLEEP_SPOTS,
  playCenter: CAT_PLAY_CENTER,
};

/** Rectangle (x1, y1, x2, y2) en pixels, interdit aux animaux. */
export type PetBlock = readonly [number, number, number, number];

/** Grille de marche rectangulaire (cases de 32 px), bords et blocs interdits. */
export class PetWalkGrid implements PathGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly free: Uint8Array;

  constructor(
    widthPx: number,
    heightPx: number,
    minY: number,
    blocks: ReadonlyArray<PetBlock>,
  ) {
    this.cols = Math.ceil(widthPx / TILE_SIZE);
    this.rows = Math.ceil(heightPx / TILE_SIZE);
    this.free = new Uint8Array(this.cols * this.rows).fill(1);
    for (let gx = 0; gx < this.cols; gx++) {
      for (let gy = 0; gy < Math.floor(minY / TILE_SIZE); gy++) {
        this.free[gy * this.cols + gx] = 0;
      }
    }
    for (const [x1, y1, x2, y2] of blocks) {
      const gx2 = Math.min(this.cols, Math.ceil(x2 / TILE_SIZE));
      const gy2 = Math.min(this.rows, Math.ceil(y2 / TILE_SIZE));
      for (let gx = Math.max(0, Math.floor(x1 / TILE_SIZE)); gx < gx2; gx++) {
        for (let gy = Math.max(0, Math.floor(y1 / TILE_SIZE)); gy < gy2; gy++) {
          this.free[gy * this.cols + gx] = 0;
        }
      }
    }
  }

  worldToGrid(x: number, y: number): GridPosition {
    return { gx: Math.floor(x / TILE_SIZE), gy: Math.floor(y / TILE_SIZE) };
  }

  gridToWorld(gx: number, gy: number): Position {
    return {
      x: gx * TILE_SIZE + TILE_SIZE / 2,
      y: gy * TILE_SIZE + TILE_SIZE / 2,
    };
  }

  isWalkable(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= this.cols || gy >= this.rows) return false;
    return this.free[gy * this.cols + gx] === 1;
  }

  getStaticTile(gx: number, gy: number): TileType {
    return this.isWalkable(gx, gy) ? TileType.FLOOR : TileType.WALL;
  }

  getCost(): number {
    return 1;
  }

  getNeighbors(gx: number, gy: number): GridPosition[] {
    const out: GridPosition[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        if (dx !== 0 && dy !== 0) {
          // Pas de coupe de coin
          if (!this.isWalkable(gx + dx, gy) || !this.isWalkable(gx, gy + dy)) {
            continue;
          }
        }
        if (
          gx + dx >= 0 &&
          gy + dy >= 0 &&
          gx + dx < this.cols &&
          gy + dy < this.rows
        ) {
          out.push({ gx: gx + dx, gy: gy + dy });
        }
      }
    }
    return out;
  }
}

/** Lieux + zone de marche fournis à OfficeDog / OfficeCats par une scène. */
export interface PetWalk {
  grid: PetWalkGrid;
  site: PetSite;
}
