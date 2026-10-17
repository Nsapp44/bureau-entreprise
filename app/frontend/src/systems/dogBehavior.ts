/**
 * Comportement pur d'Rex, le chien du bureau.
 * Aucune dependance a React/Pixi : l'etat est mis a jour par `stepDog`.
 * Le chien n'est jamais ajoute a la grille comme obstacle dynamique.
 */

import { TileType, type PathGrid, type NavigationGrid } from "./navigationGrid";
import { findWorldPath } from "./astar";
import type { Position } from "@/types";
import { DEFAULT_PET_SITE, type PetSite } from "./petSite";

export type Vec2 = Position;

/** Grille minimale requise (NavigationGrid la satisfait). */
export type DogGrid = PathGrid & Pick<NavigationGrid, "getStaticTile">;

export const DOG_SPEED = 110; // px/s
export const DOG_FRAME_MS = 120;
export const DOG_REST_MIN_S = 1;
export const DOG_REST_MAX_S = 4;
/** Probabilite qu'une nouvelle destination soit un agent. */
export const DOG_VISIT_CHANCE = 0.2;
/** Probabilite d'aller boire ou manger a la place d'errer. */
export const DOG_MEAL_CHANCE = 0.12;
export const DOG_MEAL_MIN_S = 6;
export const DOG_MEAL_MAX_S = 10;
/** Probabilite de rejoindre les chats quand ils jouent. */
export const DOG_PLAY_CHANCE = 0.4;
/** Temps passe pres d'un agent qui travaille depuis un moment. */
export const DOG_VISIT_MIN_S = 4;
export const DOG_VISIT_MAX_S = 8;

export type DogGoal = "wander" | "visit" | "drink" | "eat" | "play";

export interface DogState {
  goal: DogGoal;
  x: number;
  y: number;
  /** 1 = regarde a droite, -1 = a gauche */
  facing: 1 | -1;
  /** 0 ou 1 */
  frame: 0 | 1;
  mode: "run" | "rest";
  restLeft: number; // secondes
  path: Vec2[];
  animMs: number;
  /** Lieux (gamelles, jeu) ; absent : ceux de l'ancien bureau. */
  site?: PetSite;
}

export type Rng = () => number;

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))];
}

/** Case de sol libre (hors mur, bureau, ascenseur) ? */
export function isFreeFloor(grid: DogGrid, gx: number, gy: number): boolean {
  return (
    grid.getStaticTile(gx, gy) === TileType.FLOOR && grid.isWalkable(gx, gy)
  );
}

/** Liste toutes les cases libres (centres en coordonnees monde). */
export function listFreeTiles(
  grid: DogGrid,
  width: number,
  height: number,
): Vec2[] {
  const out: Vec2[] = [];
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      if (isFreeFloor(grid, gx, gy)) out.push(grid.gridToWorld(gx, gy));
    }
  }
  return out;
}

/** Destination aleatoire sur une case libre, ou null s'il n'y en a pas. */
export function pickDestination(
  grid: DogGrid,
  width: number,
  height: number,
  rng: Rng,
): Vec2 | null {
  const tiles = listFreeTiles(grid, width, height);
  return tiles.length === 0 ? null : pick(tiles, rng);
}

/** Case libre proche d'un point (anneau croissant), ou null. */
export function pickNear(
  grid: DogGrid,
  target: Vec2,
  rng: Rng,
  maxRadius = 3,
): Vec2 | null {
  const c = grid.worldToGrid(target.x, target.y);
  for (let r = 1; r <= maxRadius; r++) {
    const ring: Vec2[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isFreeFloor(grid, c.gx + dx, c.gy + dy)) {
          ring.push(grid.gridToWorld(c.gx + dx, c.gy + dy));
        }
      }
    }
    if (ring.length > 0) return pick(ring, rng);
  }
  return null;
}

export function createDog(start: Vec2, site?: PetSite): DogState {
  return {
    site,
    x: start.x,
    y: start.y,
    facing: 1,
    frame: 0,
    mode: "rest",
    goal: "wander",
    restLeft: 0,
    path: [],
    animMs: 0,
  };
}

function startRest(dog: DogState, rng: Rng): void {
  dog.mode = "rest";
  dog.path = [];
  dog.frame = 0;
  dog.animMs = 0;
  if (dog.goal === "drink" || dog.goal === "eat") {
    // Il boit/mange tourne vers la droite (sinon les pattes sont dans la gamelle).
    dog.facing = 1;
    dog.restLeft = DOG_MEAL_MIN_S + rng() * (DOG_MEAL_MAX_S - DOG_MEAL_MIN_S);
  } else if (dog.goal === "play") {
    dog.restLeft = 0.3 + rng() * 0.8;
  } else if (dog.goal === "visit") {
    dog.restLeft =
      DOG_VISIT_MIN_S + rng() * (DOG_VISIT_MAX_S - DOG_VISIT_MIN_S);
  } else {
    dog.restLeft = DOG_REST_MIN_S + rng() * (DOG_REST_MAX_S - DOG_REST_MIN_S);
  }
}

/** Case libre contenant `p`, sinon la plus proche. */
function standAt(grid: DogGrid, p: Vec2, rng: Rng): Vec2 | null {
  const g = grid.worldToGrid(p.x, p.y);
  if (isFreeFloor(grid, g.gx, g.gy)) return grid.gridToWorld(g.gx, g.gy);
  return pickNear(grid, p, rng, 3);
}

/** Choisit un objectif et une destination, calcule le chemin A* ; sinon repose. */
function planTrip(
  dog: DogState,
  grid: DogGrid,
  width: number,
  height: number,
  visitTargets: Vec2[],
  rng: Rng,
  catsPlaying: boolean,
): void {
  let dest: Vec2 | null = null;
  let goal: DogGoal = "wander";
  const site = dog.site ?? DEFAULT_PET_SITE;
  const playChance = dog.goal === "play" ? 0.8 : DOG_PLAY_CHANCE;
  if (catsPlaying && rng() < playChance) {
    dest = pickNear(grid, site.playCenter, rng, 3);
    goal = "play";
  } else if (visitTargets.length > 0 && rng() < DOG_VISIT_CHANCE) {
    dest = pickNear(grid, pick(visitTargets, rng), rng);
    goal = "visit";
  } else if (rng() < DOG_MEAL_CHANCE) {
    goal = rng() < 0.5 ? "drink" : "eat";
    dest = standAt(
      grid,
      goal === "drink" ? site.waterStand : site.foodStand,
      rng,
    );
  }
  if (!dest) {
    goal = "wander";
    dest = pickDestination(grid, width, height, rng);
  }
  dog.goal = goal;
  if (!dest) return startRest(dog, rng);

  const path = findWorldPath({ x: dog.x, y: dog.y }, dest, undefined, grid);
  if (path.length === 0) {
    dog.goal = "wander";
    return startRest(dog, rng);
  }
  dog.path = path;
  dog.mode = "run";
  dog.animMs = 0;
}

/**
 * Avance l'etat de `dtMs` millisecondes (mutation en place).
 * `visitTargets` : positions d'agents/boss qu'il peut aller voir.
 */
export function stepDog(
  dog: DogState,
  dtMs: number,
  grid: DogGrid,
  width: number,
  height: number,
  visitTargets: Vec2[] = [],
  rng: Rng = Math.random,
  catsPlaying = false,
): void {
  const clampedMs = Math.min(dtMs, 100); // evite les sauts apres un onglet en pause
  const dt = clampedMs / 1000;

  if (dog.mode === "rest") {
    dog.frame = 0;
    dog.restLeft -= dt;
    if (dog.restLeft <= 0) {
      planTrip(dog, grid, width, height, visitTargets, rng, catsPlaying);
    }
    return;
  }

  let budget = DOG_SPEED * dt;
  while (budget > 0 && dog.path.length > 0) {
    const t = dog.path[0];
    const dx = t.x - dog.x;
    const dy = t.y - dog.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.5) dog.facing = dx > 0 ? 1 : -1;
    if (dist <= budget) {
      dog.x = t.x;
      dog.y = t.y;
      budget -= dist;
      dog.path.shift();
    } else {
      dog.x += (dx / dist) * budget;
      dog.y += (dy / dist) * budget;
      budget = 0;
    }
  }

  dog.animMs += clampedMs;
  dog.frame = Math.floor(dog.animMs / DOG_FRAME_MS) % 2 === 0 ? 0 : 1;

  if (dog.path.length === 0) startRest(dog, rng);
}
