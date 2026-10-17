"use client";

import { useEffect, useRef, useState } from "react";
import { useOverviewStore } from "@/stores/overviewStore";
import type { ActiveConversation } from "@/types";
import { makeTrafficWalker, type TrafficWalker } from "./coffeeWalk";

/** Door stays open this long after a departing walker reaches the elevator. */
const DOOR_CLOSE_MS = 900;

function doorOpenFor(w: TrafficWalker, now: number): boolean {
  const age = now - w.startedAt;
  if (w.kind === "arrive") return age < 2200;
  return age > w.durationMs - 1500 && age < w.durationMs + DOOR_CLOSE_MS;
}

/**
 * Elevator traffic: a conversation appearing after the first load walks out of
 * the elevator to its desk; one that disappears walks back to the elevator
 * (ghost copy of its last known state). The first load moves nothing.
 */
export function useElevatorTraffic(bySlot: Map<number, ActiveConversation>): {
  walkers: TrafficWalker[];
  doorOpen: boolean;
} {
  const [walkers, setWalkers] = useState<TrafficWalker[]>([]);
  const [doorOpen, setDoorOpen] = useState(false);
  const walkersRef = useRef<TrafficWalker[]>([]);
  const knownRef = useRef<Map<
    string,
    { conv: ActiveConversation; slot: number }
  > | null>(null);

  // First state_update received (null until then): it is the baseline.
  const lastUpdated = useOverviewStore((s) => s.lastUpdated);

  useEffect(() => {
    if (lastUpdated === null) {
      knownRef.current = null;
      return;
    }
    const cur = new Map<string, { conv: ActiveConversation; slot: number }>();
    for (const [slot, conv] of bySlot) cur.set(conv.sessionId, { conv, slot });
    const prev = knownRef.current;
    if (!prev) {
      // First load (even empty): whatever is there sits at its desk.
      knownRef.current = cur;
      return;
    }
    knownRef.current = cur;
    const now = Date.now();
    let list = walkersRef.current;
    let changed = false;
    for (const [id, v] of cur) {
      if (prev.has(id)) continue;
      list = list.filter((w) => w.sessionId !== id);
      list.push(makeTrafficWalker(id, v.slot, "arrive", now));
      changed = true;
    }
    for (const [id, v] of prev) {
      if (cur.has(id)) continue;
      list = list.filter((w) => w.sessionId !== id);
      list.push(makeTrafficWalker(id, v.slot, "leave", now));
      changed = true;
    }
    if (changed) {
      walkersRef.current = list;
      setWalkers(list);
    }
  }, [bySlot, lastUpdated]);

  useEffect(() => {
    if (walkers.length === 0) {
      setDoorOpen(false);
      return;
    }
    const tick = (): void => {
      const now = Date.now();
      const alive = walkersRef.current.filter(
        (w) =>
          now - w.startedAt <
          w.durationMs + (w.kind === "leave" ? DOOR_CLOSE_MS : 0),
      );
      if (alive.length !== walkersRef.current.length) {
        walkersRef.current = alive;
        setWalkers(alive);
      }
      setDoorOpen(alive.some((w) => doorOpenFor(w, now)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [walkers]);

  return { walkers, doorOpen };
}
