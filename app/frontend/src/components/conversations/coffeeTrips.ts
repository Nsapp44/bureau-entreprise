/** Pure logic of the coffee trips of the general office (no React, no Pixi). */

export type TripPhase = "going" | "drinking" | "returning";

export interface CoffeeTrip {
  sessionId: string;
  /** Desk number (1-based). */
  slot: number;
  /** Stable position at the machine (0..MAX-1). */
  lane: number;
  phase: TripPhase;
  /** Start time (ms) of the current phase. */
  startedAt: number;
  /** Duration (ms) of one walk (path length / speed), fixed at trip start. */
  walkMs: number;
}

/** One conversation as seen by the trip logic. */
export interface TripConv {
  sessionId: string;
  slot: number;
  /** True when the conversation is waiting (seatState "idle"). */
  idle: boolean;
  /** Start (ms) of the current continuous waiting period, null when not idle. */
  idleSince: number | null;
}

/** Minimum duration of a walk to/from the machine. */
export const MIN_WALK_MS = 2000;
export const DEFAULT_WALK_MS = 3000;
export const DRINK_MS = 60000;
/** A waiting conversation goes for a coffee after this long without activity. */
export const COFFEE_WAIT_MS = 5 * 60 * 1000;

export interface StepResult {
  trips: CoffeeTrip[];
  done: Set<string>;
  /** Trips created by this step. */
  started: CoffeeTrip[];
  /** Trips that reached the machine (going -> drinking) in this step: one coffee each. */
  drinking: CoffeeTrip[];
  /** True when the trips list changed (phase transition, add or remove). */
  changed: boolean;
}

/**
 * Advance the trips. A conversation starts a trip only after COFFEE_WAIT_MS of
 * continuous waiting, and only once per waiting period.
 */
export function stepTrips(
  trips: CoffeeTrip[],
  done: Set<string>,
  convs: TripConv[],
  now: number,
  max: number,
  /** Walk duration (ms) of a trip for this desk and lane. */
  walkMsFor: (slot: number, lane: number) => number = () => DEFAULT_WALK_MS,
  /** Sessions that must not start a trip now (e.g. still arriving by elevator). */
  blocked?: ReadonlySet<string>,
): StepResult {
  const byId = new Map(convs.map((c) => [c.sessionId, c]));
  const nextDone = new Set<string>();
  // Keep done only for conversations that are still waiting.
  for (const id of done) if (byId.get(id)?.idle) nextDone.add(id);

  let changed = false;
  const drinking: CoffeeTrip[] = [];
  const next: CoffeeTrip[] = [];
  for (const t of trips) {
    const conv = byId.get(t.sessionId);
    if (!conv) {
      changed = true;
      continue;
    }
    let trip = { ...t, slot: conv.slot };
    // Back to work: walk back at once, mirroring the progress when going.
    if (!conv.idle && trip.phase !== "returning") {
      const elapsed =
        trip.phase === "going" ? Math.min(trip.walkMs, now - trip.startedAt) : 0;
      trip = {
        ...trip,
        phase: "returning",
        startedAt: trip.phase === "going" ? now - (trip.walkMs - elapsed) : now,
      };
      changed = true;
    }
    const age = now - trip.startedAt;
    if (trip.phase === "going" && age >= trip.walkMs) {
      trip = {
        ...trip,
        phase: "drinking",
        startedAt: trip.startedAt + trip.walkMs,
      };
      drinking.push(trip);
      changed = true;
    } else if (trip.phase === "drinking" && age >= DRINK_MS) {
      trip = { ...trip, phase: "returning", startedAt: trip.startedAt + DRINK_MS };
      changed = true;
    } else if (trip.phase === "returning" && age >= trip.walkMs) {
      changed = true;
      continue;
    }
    next.push(trip);
  }

  const started: CoffeeTrip[] = [];
  const used = new Set(next.map((t) => t.lane));
  const busy = new Set(next.map((t) => t.sessionId));
  const candidates = convs
    .filter((c) => c.idle &&
        c.idleSince !== null &&
        now - c.idleSince >= COFFEE_WAIT_MS &&
        !nextDone.has(c.sessionId) && !busy.has(c.sessionId) &&
        !blocked?.has(c.sessionId))
    .sort((a, b) => a.slot - b.slot);
  for (const c of candidates) {
    if (next.length >= max) break;
    let lane = 0;
    while (used.has(lane)) lane++;
    used.add(lane);
    const trip: CoffeeTrip = {
      sessionId: c.sessionId,
      slot: c.slot,
      lane,
      phase: "going",
      startedAt: now,
      walkMs: Math.max(MIN_WALK_MS, walkMsFor(c.slot, lane)),
    };
    next.push(trip);
    started.push(trip);
    nextDone.add(c.sessionId);
    changed = true;
  }
  return { trips: next, done: nextDone, started, drinking, changed };
}

/** Progress 0..1 of a walking trip (going: desk to machine). */
export function walkProgress(trip: CoffeeTrip, now: number): number {
  return Math.max(0, Math.min(1, (now - trip.startedAt) / trip.walkMs));
}
