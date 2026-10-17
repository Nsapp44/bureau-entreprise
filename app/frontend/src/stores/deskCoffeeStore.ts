"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Compteur de cafés du bureau général (vue conversations) : +1 chaque fois
 * qu'une conversation en attente part à la machine. Indépendant de
 * `coffeeStore` (bureaux de session). Gardé en localStorage.
 */
interface DeskCoffeeState {
  coffeeCount: number;
  /** Cafés par conversation (clé = sessionId) : une conversation qui attend est anormale. */
  bySession: Record<string, number>;
  lastCoffeeAt: number | null;
  lastCoffeeBy: string | null;
  recordCoffee: (
    agentName: string | null,
    now?: number,
    sessionId?: string,
  ) => void;
  resetCoffee: () => void;
}

export const useDeskCoffeeStore = create<DeskCoffeeState>()(
  persist(
    (set) => ({
      coffeeCount: 0,
      bySession: {},
      lastCoffeeAt: null,
      lastCoffeeBy: null,
      recordCoffee: (agentName, now = Date.now(), sessionId) =>
        set((s) => ({
          coffeeCount: s.coffeeCount + 1,
          bySession: sessionId
            ? { ...s.bySession, [sessionId]: (s.bySession[sessionId] ?? 0) + 1 }
            : s.bySession,
          lastCoffeeAt: now,
          lastCoffeeBy: agentName,
        })),
      resetCoffee: () =>
        set({
          coffeeCount: 0,
          bySession: {},
          lastCoffeeAt: null,
          lastCoffeeBy: null,
        }),
    }),
    { name: "bureau-desk-coffee-count" },
  ),
);
