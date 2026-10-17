"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Compteur de cafés : un café = un agent qui a attendu plus de 5 min
 * (alerte de surveillance). Gardé en localStorage.
 */
interface CoffeeState {
  coffeeCount: number;
  lastCoffeeAt: number | null;
  lastCoffeeBy: string | null;
  recordCoffee: (agentName: string | null, now?: number) => void;
  resetCoffee: () => void;
}

export const useCoffeeStore = create<CoffeeState>()(
  persist(
    (set) => ({
      coffeeCount: 0,
      lastCoffeeAt: null,
      lastCoffeeBy: null,
      recordCoffee: (agentName, now = Date.now()) =>
        set((s) => ({
          coffeeCount: s.coffeeCount + 1,
          lastCoffeeAt: now,
          lastCoffeeBy: agentName,
        })),
      resetCoffee: () =>
        set({ coffeeCount: 0, lastCoffeeAt: null, lastCoffeeBy: null }),
    }),
    { name: "bureau-coffee-count" },
  ),
);
