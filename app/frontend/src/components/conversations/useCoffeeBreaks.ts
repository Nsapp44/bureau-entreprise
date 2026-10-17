"use client";

import { useEffect, useRef, useState } from "react";
import { useDeskCoffeeStore } from "@/stores/deskCoffeeStore";
import type { ActiveConversation } from "@/types";
import { seatState } from "./ConversationSeat";
import { agentNameForDesk } from "./conversationsLogic";
import {
  COFFEE_WAIT_MS,
  stepTrips,
  type CoffeeTrip,
  type TripConv,
} from "./coffeeTrips";
import { coffeePath, pathLength, WALK_SPEED } from "./coffeeWalk";

export { MIN_WALK_MS, DRINK_MS } from "./coffeeTrips";
export type { CoffeeTrip, TripPhase } from "./coffeeTrips";

const walkMsFor = (slot: number, lane: number): number =>
  (pathLength(coffeePath(slot, lane)) / WALK_SPEED) * 1000;

// Module state (not persisted): survives the view being unmounted and remounted.
let moduleTrips: CoffeeTrip[] = [];
let moduleDone = new Set<string>();
let observed = false;

/**
 * Coffee trips of the waiting (idle) conversations: walk to the machine,
 * drink, walk back. One coffee per waiting period; React state only changes
 * on a phase transition.
 */
export function useCoffeeBreaks(
  bySlot: Map<number, ActiveConversation>,
  max: number,
  /** Sessions still arriving by elevator: no trip starts for them. */
  arriving?: ReadonlySet<string>,
): CoffeeTrip[] {
  const [trips, setTrips] = useState<CoffeeTrip[]>(moduleTrips);
  const arrivingRef = useRef(arriving);
  arrivingRef.current = arriving;
  const idleSinceRef = useRef<Map<string, number>>(new Map());
  const bySlotRef = useRef(bySlot);
  bySlotRef.current = bySlot;

  useEffect(() => {
    const evaluate = (): void => {
      const now = Date.now();
      // Start of the continuous waiting: first seen idle, or last activity if older.
      const since = idleSinceRef.current;
      const convs: TripConv[] = [];
      const seen = new Set<string>();
      for (const [slot, conv] of bySlotRef.current) {
        const idle = seatState(conv) === "idle";
        let idleSince: number | null = null;
        if (idle) {
          seen.add(conv.sessionId);
          if (!since.has(conv.sessionId)) {
            const last = conv.lastActivityAt
              ? Date.parse(conv.lastActivityAt)
              : NaN;
            since.set(
              conv.sessionId,
              Number.isFinite(last) ? Math.min(now, last) : now,
            );
          } else if (conv.lastActivityAt) {
            const last = Date.parse(conv.lastActivityAt);
            if (Number.isFinite(last) && last > (since.get(conv.sessionId) ?? 0)) {
              since.set(conv.sessionId, Math.min(now, last));
            }
          }
          idleSince = since.get(conv.sessionId) ?? now;
        }
        convs.push({ sessionId: conv.sessionId, slot, idle, idleSince });
      }
      for (const id of Array.from(since.keys())) if (!seen.has(id)) since.delete(id);
      if (!observed && convs.length > 0) {
        // First observation of the module: waiting periods older than the
        // threshold predate us, they already had their chance.
        observed = true;
        for (const c of convs) {
          if (c.idle && c.idleSince !== null && now - c.idleSince >= COFFEE_WAIT_MS) {
            moduleDone.add(c.sessionId);
          }
        }
      }
      const res = stepTrips(
        moduleTrips,
        moduleDone,
        convs,
        now,
        max,
        walkMsFor,
        arrivingRef.current,
      );
      moduleDone = res.done;
      moduleTrips = res.trips;
      for (const t of res.drinking) {
        useDeskCoffeeStore.getState().recordCoffee(
          agentNameForDesk(t.slot - 1),
          Date.now(),
          t.sessionId,
        );
      }
      if (res.changed) setTrips(res.trips);
    };
    evaluate();
    const id = setInterval(evaluate, 250);
    return () => clearInterval(id);
  }, [bySlot, max]);

  return trips;
}
