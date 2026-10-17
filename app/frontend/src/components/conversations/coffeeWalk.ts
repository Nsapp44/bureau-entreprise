/** Pure geometry of the walks of the general office (coffee, elevator). */

import {
  CONV_DESK_ORIGIN_Y_START,
  getConvDeskOrigin as getDeskOrigin,
} from "@/constants/positions";
import { DESK_SCALE } from "./ConversationSeat";
import { FEET_Y, ROOMS_X, waiterX } from "./CoffeeWaiters";
import type { CoffeeTrip } from "./coffeeTrips";

export interface Pt {
  x: number;
  y: number;
}

/** Seat point (centre of the bottom circle) relative to the desk origin. */
const SEAT_DY = 24 * DESK_SCALE;
/** Right corridor, between the last desk column (x <= 573) and the workshop rooms (x >= 680). */
const RIGHT_X = ROOMS_X - 36;
/** Row just below the coffee queue lanes (y ~ 220), above the first desk row. */
const TURN_Y = CONV_DESK_ORIGIN_Y_START - 30;
/** Elevator exit point in scene coordinates (departure position, container offset). */
export const ELEVATOR_EXIT: Pt = { x: 76, y: 138 };
/** Corridor of the first row (above its desks), reached straight from the elevator. */
const ELEVATOR_FLOOR_Y = CONV_DESK_ORIGIN_Y_START - 30;
/** Walking speed (px/s) for elevator walks. */
export const WALK_SPEED = 260;

/** Corridor y of the row, behind the chairs: between the rows (first row: above the block). */
function corridorY(slot: number): number {
  return getDeskOrigin(slot).y - 30;
}

function seatPoint(slot: number): Pt {
  const d = getDeskOrigin(slot);
  return { x: d.x, y: d.y + SEAT_DY };
}

/** Seat -> row corridor -> right corridor -> lane at the machine. */
export function coffeePath(slot: number, lane: number): Pt[] {
  const seat = seatPoint(slot);
  const cy = corridorY(slot);
  const lx = waiterX(lane);
  return [
    seat,
    { x: seat.x, y: cy },
    { x: RIGHT_X, y: cy },
    { x: RIGHT_X, y: TURN_Y },
    { x: lx, y: TURN_Y },
    { x: lx, y: FEET_Y },
  ];
}

/**
 * Elevator -> first-row corridor (y 249) -> [right corridor down to the row
 * corridor for lower rows] -> row corridor -> seat. No gap between desks, so
 * lower rows are reached by the right corridor.
 */
export function elevatorPath(slot: number): Pt[] {
  const seat = seatPoint(slot);
  const cy = corridorY(slot);
  const path: Pt[] = [
    ELEVATOR_EXIT,
    { x: ELEVATOR_EXIT.x, y: ELEVATOR_FLOOR_Y },
  ];
  if (cy !== ELEVATOR_FLOOR_Y) {
    path.push({ x: RIGHT_X, y: ELEVATOR_FLOOR_Y }, { x: RIGHT_X, y: cy });
  }
  path.push({ x: seat.x, y: cy }, seat);
  return path;
}

export function pathLength(path: Pt[]): number {
  let L = 0;
  for (let i = 1; i < path.length; i++) {
    L += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
  }
  return L;
}

/** Point at distance `d` along the polyline (clamped to its ends). */
export function pointAt(path: Pt[], d: number): Pt {
  if (d <= 0) return path[0];
  let left = d;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (left <= seg && seg > 0) {
      const t = left / seg;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    left -= seg;
  }
  return path[path.length - 1];
}

export interface WalkPos extends Pt {
  moving: boolean;
}

/** Position of a coffee trip: walks, never jumps. */
export function tripPosition(trip: CoffeeTrip, now: number): WalkPos {
  const path = coffeePath(trip.slot, trip.lane);
  const L = pathLength(path);
  const t = Math.max(0, Math.min(1, (now - trip.startedAt) / trip.walkMs));
  if (trip.phase === "drinking") return { ...pointAt(path, L), moving: false };
  const d = trip.phase === "going" ? t * L : (1 - t) * L;
  return { ...pointAt(path, d), moving: t < 1 };
}

/** Walk between the elevator and a desk. */
export interface TrafficWalker {
  sessionId: string;
  slot: number;
  /** arrive: elevator -> desk; leave: desk -> elevator. */
  kind: "arrive" | "leave";
  startedAt: number;
  durationMs: number;
}

export function makeTrafficWalker(
  sessionId: string,
  slot: number,
  kind: "arrive" | "leave",
  now: number,
): TrafficWalker {
  const L = pathLength(elevatorPath(slot));
  return {
    sessionId,
    slot,
    kind,
    startedAt: now,
    durationMs: Math.max(2500, (L / WALK_SPEED) * 1000),
  };
}

export function trafficPosition(w: TrafficWalker, now: number): WalkPos {
  const path = elevatorPath(w.slot);
  const L = pathLength(path);
  const t = Math.max(0, Math.min(1, (now - w.startedAt) / w.durationMs));
  const d = w.kind === "arrive" ? t * L : (1 - t) * L;
  return { ...pointAt(path, d), moving: t < 1 };
}
