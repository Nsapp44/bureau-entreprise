/**
 * Comportement pur des deux chats du bureau (aucune dépendance à React/Pixi).
 *
 * Machine d'états : dorment presque tout le temps dans les niches de l'arbre
 * à chat ; de temps en temps ils descendent soit jouer ensemble, soit boire,
 * soit manger, ou vont voir un agent qui attend ou faire une sieste sur le
 * canapé, puis remontent dormir. Mise à jour par `stepCats`.
 */

import { findWorldPath } from "./astar";
import {
  isFreeFloor,
  pickNear,
  type DogGrid,
  type Rng,
  type Vec2,
} from "./dogBehavior";
import { DEFAULT_PET_SITE, type PetSite } from "./petSite";

export const CAT_SPEED = 55; // px/s
export const CAT_PLAY_SPEED = 95; // px/s
export const CAT_FRAME_MS = 150;
export const CAT_SLEEP_MIN_S = 12;
export const CAT_SLEEP_MAX_S = 22;
/** Les chats dorment ~2,5 fois plus longtemps en pleine nuit. */
export const CAT_NIGHT_SLEEP_FACTOR = 2.5;

/** Facteur de sieste pour une obscurité de 0 (jour) à 1 (nuit). */
export function sleepScaleFor(darkness: number): number {
  return 1 + (CAT_NIGHT_SLEEP_FACTOR - 1) * Math.max(0, Math.min(1, darkness));
}
export const CAT_PLAY_MIN_S = 20;
export const CAT_PLAY_MAX_S = 35;
export const CAT_MEAL_MIN_S = 12;
export const CAT_MEAL_MAX_S = 20;
/** Probabilité que le réveil mène à une partie de jeu (sinon boire/manger). */
export const CAT_PLAY_CHANCE = 0.3;
/** Probabilité qu'un chat réveillé aille voir un agent qui attend (s'il y en a). */
export const CAT_VISIT_CHANCE = 0.35;
export const CAT_VISIT_MIN_S = 8;
export const CAT_VISIT_MAX_S = 14;
/** Part des réveils qui finissent en sieste sur le canapé. */
export const CAT_NAP_CHANCE = 0.15;
/** Part des réveils où le chat va faire tomber un objet (juste sous la sieste). */
export const CAT_KNOCK_CHANCE = 0.1;
export const CAT_KNOCK_SIT_S = 2;
export const CAT_KNOCK_WATCH_S = 3;
/** Durée de chute, puis durée pendant laquelle l'objet reste au sol. */
export const CAT_DROP_FALL_S = 0.4;
export const CAT_DROP_LIFE_S = 25;
/** Hauteur d'où tombe l'objet (px). */
export const CAT_DROP_HEIGHT = 16;
/** Pause entre deux bonds pendant le jeu. */
const PLAY_HOP_REST_S = 0.35;

export type CatMode =
  "sleep" | "walk" | "play" | "drink" | "eat" | "sit" | "knock";
export type CatGoal =
  "play" | "drink" | "eat" | "sleep" | "visit" | "nap" | "knock";
/** Index de l'image : 0/1 marche, 2 endormi, 3 tête baissée (boit/mange). */
export type CatPose = 0 | 1 | 2 | 3;

/** Objet poussé par un chat : tombe puis reste au sol quelques secondes. */
export interface CatDrop {
  x: number;
  y: number;
  /** Secondes depuis le début de la chute. */
  age: number;
}

export interface CatState {
  /** Objet que ce chat vient de faire tomber (null : aucun). */
  drop: CatDrop | null;
  x: number;
  y: number;
  /** 1 = regarde à droite, -1 = à gauche */
  facing: 1 | -1;
  frame: 0 | 1;
  mode: CatMode;
  goal: CatGoal;
  path: Vec2[];
  /** Secondes restantes dans l'état courant (sommeil, jeu, repas). */
  timer: number;
  /** Repos entre deux bonds (jeu). */
  hopRest: number;
  animMs: number;
  /** Niche où le chat dort (pieds). */
  spot: Vec2;
  /** Case libre au pied de l'arbre. */
  base: Vec2;
  /** Case libre devant le canapé (null : pas de sieste sur le canapé). */
  sofaStand: Vec2 | null;
  /** Dort sur le canapé plutôt que dans la niche. */
  onSofa: boolean;
  /** Multiplie la durée des siestes (1 le jour, plus la nuit). */
  sleepScale: number;
  /** Lieux (canapé, gamelles, jeu) de la scène. */
  site: PetSite;
}

function between(min: number, max: number, rng: Rng): number {
  return min + rng() * (max - min);
}

/** Case libre contenant `p`, sinon la plus proche ; null si rien de libre. */
export function standPoint(grid: DogGrid, p: Vec2, rng: Rng): Vec2 | null {
  const g = grid.worldToGrid(p.x, p.y);
  if (isFreeFloor(grid, g.gx, g.gy)) return grid.gridToWorld(g.gx, g.gy);
  return pickNear(grid, p, rng, 3);
}

/** Crée les chats endormis ; null si le pied de l'arbre n'a aucune case libre. */
export function createCats(
  grid: DogGrid,
  rng: Rng = Math.random,
  site: PetSite = DEFAULT_PET_SITE,
): CatState[] | null {
  const base = standPoint(grid, site.treeBase, rng);
  if (!base) return null;
  const sofaStand = standPoint(grid, site.sofaStand, rng);
  return site.sleepSpots.map((spot) => ({
    x: spot.x,
    y: spot.y,
    facing: 1,
    frame: 0,
    mode: "sleep",
    goal: "sleep",
    path: [],
    timer: between(5, CAT_SLEEP_MAX_S, rng),
    hopRest: 0,
    animMs: 0,
    spot,
    base,
    sofaStand,
    onSofa: false,
    sleepScale: 1,
    site,
    drop: null,
  }));
}

export function catPose(cat: CatState): CatPose {
  if (cat.mode === "sleep") return 2;
  if (cat.mode === "drink" || cat.mode === "eat") return 3;
  return cat.path.length > 0 ? cat.frame : 0;
}

function sleepAgain(cat: CatState, rng: Rng): void {
  cat.x = cat.spot.x;
  cat.y = cat.spot.y;
  cat.onSofa = false;
  cat.mode = "sleep";
  cat.goal = "sleep";
  cat.path = [];
  cat.facing = 1;
  cat.timer = between(CAT_SLEEP_MIN_S, CAT_SLEEP_MAX_S, rng) * cat.sleepScale;
}

/** Met le chat en marche vers `dest` ; renvoie false si aucun chemin. */
function walkTo(
  cat: CatState,
  dest: Vec2 | null,
  goal: CatGoal,
  grid: DogGrid,
): boolean {
  cat.goal = goal;
  cat.mode = "walk";
  cat.animMs = 0;
  if (!dest) return false;
  if (Math.hypot(dest.x - cat.x, dest.y - cat.y) < 1) {
    cat.path = [];
    return true;
  }
  const path = findWorldPath({ x: cat.x, y: cat.y }, dest, undefined, grid);
  if (path.length === 0) return false;
  cat.path = path;
  return true;
}

/** Descend de l'arbre et part vers l'objectif (sinon se recouche). */
function startTrip(
  cat: CatState,
  goal: Exclude<CatGoal, "sleep">,
  grid: DogGrid,
  rng: Rng,
  visitTargets: Vec2[] = [],
): void {
  // Depuis le canapé, le chat saute devant ; sinon il descend de l'arbre.
  const from = cat.onSofa && cat.sofaStand ? cat.sofaStand : cat.base;
  cat.onSofa = false;
  cat.x = from.x;
  cat.y = from.y;
  let dest: Vec2 | null;
  if (goal === "play") dest = pickNear(grid, cat.site.playCenter, rng, 3);
  else if (goal === "nap") dest = cat.sofaStand;
  else if (goal === "visit" || goal === "knock") {
    const aim = visitTargets.length > 0 ? visitTargets : [cat.site.playCenter];
    const target = aim[Math.floor(rng() * aim.length)];
    dest = target ? pickNear(grid, target, rng, 2) : null;
  } else
    dest = standPoint(
      grid,
      goal === "drink" ? cat.site.waterStand : cat.site.foodStand,
      rng,
    );
  if (!walkTo(cat, dest, goal, grid)) sleepAgain(cat, rng);
}

function startReturn(cat: CatState, grid: DogGrid, rng: Rng): void {
  if (!walkTo(cat, cat.base, "sleep", grid)) sleepAgain(cat, rng);
}

/** Un chat se réveille : jeu à deux, ou boire, ou manger. */
function wake(
  cat: CatState,
  cats: CatState[],
  grid: DogGrid,
  rng: Rng,
  visitTargets: Vec2[],
): void {
  if (visitTargets.length > 0 && rng() < CAT_VISIT_CHANCE) {
    startTrip(cat, "visit", grid, rng, visitTargets);
    return;
  }
  const roll = rng();
  const othersAsleep = cats.every((c) => c === cat || c.mode === "sleep");
  if (roll < CAT_PLAY_CHANCE && othersAsleep) {
    for (const c of cats) startTrip(c, "play", grid, rng);
    return;
  }
  if (
    roll >= 1 - CAT_NAP_CHANCE - CAT_KNOCK_CHANCE &&
    roll < 1 - CAT_NAP_CHANCE
  ) {
    startTrip(cat, "knock", grid, rng, visitTargets);
    return;
  }
  if (cat.sofaStand && roll >= 1 - CAT_NAP_CHANCE) {
    startTrip(cat, "nap", grid, rng);
    return;
  }
  const meal = roll < (1 + CAT_PLAY_CHANCE) / 2 ? "drink" : "eat";
  startTrip(cat, meal, grid, rng);
}

function napOnSofa(cat: CatState, rng: Rng): void {
  cat.x = cat.site.sofaSpot.x;
  cat.y = cat.site.sofaSpot.y;
  cat.onSofa = true;
  cat.mode = "sleep";
  cat.goal = "sleep";
  cat.path = [];
  cat.facing = 1;
  cat.timer = between(CAT_SLEEP_MIN_S, CAT_SLEEP_MAX_S, rng) * cat.sleepScale;
}

function arrive(cat: CatState, rng: Rng): void {
  switch (cat.goal) {
    case "nap":
      napOnSofa(cat, rng);
      break;
    case "visit":
      cat.mode = "sit";
      cat.timer = between(CAT_VISIT_MIN_S, CAT_VISIT_MAX_S, rng);
      break;
    case "knock":
      cat.mode = "knock";
      cat.timer = CAT_KNOCK_SIT_S + CAT_KNOCK_WATCH_S;
      break;
    case "play":
      cat.mode = "play";
      cat.timer = between(CAT_PLAY_MIN_S, CAT_PLAY_MAX_S, rng);
      cat.hopRest = 0;
      break;
    case "drink":
    case "eat":
      cat.mode = cat.goal;
      cat.facing = 1;
      cat.timer = between(CAT_MEAL_MIN_S, CAT_MEAL_MAX_S, rng);
      break;
    default:
      sleepAgain(cat, rng);
  }
}

/** Avance le long du chemin ; renvoie true si le chat a bougé. */
function advance(cat: CatState, dt: number, speed: number): boolean {
  let budget = speed * dt;
  const moved = cat.path.length > 0;
  while (budget > 0 && cat.path.length > 0) {
    const t = cat.path[0];
    const dx = t.x - cat.x;
    const dy = t.y - cat.y;
    const dist = Math.hypot(dx, dy);
    if (Math.abs(dx) > 0.5) cat.facing = dx > 0 ? 1 : -1;
    if (dist <= budget) {
      cat.x = t.x;
      cat.y = t.y;
      budget -= dist;
      cat.path.shift();
    } else {
      cat.x += (dx / dist) * budget;
      cat.y += (dy / dist) * budget;
      budget = 0;
    }
  }
  return moved;
}

function animate(cat: CatState, ms: number, moving: boolean): void {
  if (!moving) {
    cat.frame = 0;
    cat.animMs = 0;
    return;
  }
  cat.animMs += ms;
  cat.frame = Math.floor(cat.animMs / CAT_FRAME_MS) % 2 === 0 ? 0 : 1;
}

function stepCat(
  cat: CatState,
  cats: CatState[],
  dt: number,
  ms: number,
  grid: DogGrid,
  rng: Rng,
  visitTargets: Vec2[],
): void {
  switch (cat.mode) {
    case "sleep":
      cat.timer -= dt;
      if (cat.timer <= 0) wake(cat, cats, grid, rng, visitTargets);
      return;
    case "walk": {
      const moving = advance(cat, dt, CAT_SPEED);
      animate(cat, ms, moving);
      if (cat.path.length === 0) arrive(cat, rng);
      return;
    }
    case "play": {
      cat.timer -= dt;
      if (cat.timer <= 0) return startReturn(cat, grid, rng);
      const moving = advance(cat, dt, CAT_PLAY_SPEED);
      animate(cat, ms, moving);
      if (cat.path.length === 0) {
        cat.hopRest -= dt;
        if (cat.hopRest <= 0) {
          const dest = pickNear(grid, cat.site.playCenter, rng, 3);
          const path = dest
            ? findWorldPath({ x: cat.x, y: cat.y }, dest, undefined, grid)
            : [];
          cat.path = path;
          cat.hopRest = PLAY_HOP_REST_S;
        }
      }
      return;
    }
    case "knock":
      cat.timer -= dt;
      if (!cat.drop && cat.timer <= CAT_KNOCK_WATCH_S) {
        cat.drop = { x: cat.x + cat.facing * 12, y: cat.y, age: 0 };
      }
      if (cat.timer <= 0) startReturn(cat, grid, rng);
      return;
    default: // drink | eat | sit
      cat.timer -= dt;
      if (cat.timer <= 0) startReturn(cat, grid, rng);
  }
}

/** Avance tous les chats de `dtMs` millisecondes (mutation en place). */
export function stepCats(
  cats: CatState[],
  dtMs: number,
  grid: DogGrid,
  rng: Rng = Math.random,
  visitTargets: Vec2[] = [],
): void {
  const ms = Math.min(dtMs, 100); // évite les sauts après un onglet en pause
  for (const cat of cats) {
    if (cat.drop) {
      cat.drop.age += ms / 1000;
      if (cat.drop.age >= CAT_DROP_LIFE_S) cat.drop = null;
    }
    stepCat(cat, cats, ms / 1000, ms, grid, rng, visitTargets);
  }
}
