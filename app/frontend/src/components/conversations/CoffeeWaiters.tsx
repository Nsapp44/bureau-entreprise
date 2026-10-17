import { ROOMS_W } from "./WorkshopRooms";

/** Scène à largeur fixe : hauteur, largeur (hauteur x 1,65, multiple de 32), bord gauche des pièces. */
export const SCENE_H = 1164; // 188 (mur) + 3 pièces de 325 ; 1164 x 1,65 = 1920 = ROOMS_X 960 + ROOMS_W 960
export const VIEW_W = Math.round((SCENE_H * 1.65) / 32) * 32;
export const ROOMS_X = VIEW_W - ROOMS_W;

/** Constantes de la machine à café de la scène des conversations. */

/** Au plus 4 personnages à la machine à café. */
export const MAX_COFFEE_WAITERS = 4;

/**
 * Machine à café de la scène : centre du sprite (59 x 65 px), collée au mur du
 * fond, tout à droite de la zone ouverte (juste à gauche des pièces, x < 680).
 * La file d'attente se place devant.
 */
export const COFFEE_SPOT = { x: ROOMS_X - 70, y: 136 };

const FIRST_X = COFFEE_SPOT.x - 80;
const STEP_X = 38;
/** Centre du cercle du bas (comme SeatBody : y du poste + 24). */
export const FEET_Y = COFFEE_SPOT.y + 84;

/** x stable de la voie `i` au pied de la machine (toutes < ROOMS_X). */
export function waiterX(i: number): number {
  return FIRST_X + i * STEP_X;
}
