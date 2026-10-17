"use client";

import type { Graphics } from "pixi.js";
import { useCallback, type ReactNode } from "react";
import { useCoffeeStore } from "@/stores/coffeeStore";

/** Store exposant `coffeeCount` (salle session par défaut, ou bureau général). */
export type CoffeeCountStore = <T>(
  selector: (s: { coffeeCount: number }) => T,
) => T;

/**
 * CoffeeCounter - petit afficheur au-dessus de la machine à café.
 *
 * Un café = un agent qui a attendu plus de 5 min. En principe le compteur
 * reste à 0 : tout café affiché est une alerte de surveillance.
 */
export function CoffeeCounter({
  store = useCoffeeStore,
}: {
  store?: CoffeeCountStore;
}): ReactNode {
  const count = store((s) => s.coffeeCount);
  const alert = count > 0;

  const draw = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(-26, -11, 52, 22, 4);
      g.fill(0x1a1a1a);
      g.stroke({ width: 1.5, color: alert ? 0xff9900 : 0x4a5568 });
      // Tasse
      g.roundRect(-20, -4, 9, 8, 1);
      g.fill(0xf5f5f5);
      g.roundRect(-11.5, -2, 3, 4, 1.5);
      g.stroke({ width: 1, color: 0xf5f5f5 });
    },
    [alert],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      <pixiText
        text={`x ${count}`}
        x={6}
        y={0}
        anchor={0.5}
        style={{
          fontFamily: "monospace",
          fontSize: 12,
          fontWeight: "bold",
          fill: alert ? 0xffb347 : 0x33ff33,
        }}
        resolution={2}
      />
    </pixiContainer>
  );
}
