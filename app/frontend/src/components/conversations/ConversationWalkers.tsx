"use client";

import type { Container } from "pixi.js";
import { useRef, type ReactNode } from "react";
import { useTick } from "@pixi/react";
import { getAgentLook } from "@/constants/agentLooks";
import { formatModelLabel } from "@/utils/modelLabel";
import { AgentSprite } from "../game/AgentSprite";
import { agentNameForDesk } from "./conversationsLogic";
import { DESK_SCALE } from "./ConversationSeat";
import type { CoffeeTrip } from "./coffeeTrips";
import {
  trafficPosition,
  tripPosition,
  type TrafficWalker,
  type WalkPos,
} from "./coffeeWalk";

const ORIGIN = { x: 0, y: 0 };
const CAPSULE_COLOR = "#22304a";

interface WalkerItem {
  key: string;
  sessionId: string;
  slot: number;
  pos: (now: number) => WalkPos;
  visible: (now: number) => boolean;
}

/**
 * Characters walking in the office (coffee trips, elevator): drawn like the
 * seated ones (name above the head), positions updated every frame.
 */
export function ConversationWalkers({
  trips,
  traffic,
  models,
}: {
  trips: CoffeeTrip[];
  traffic: TrafficWalker[];
  /** Model id per sessionId (label above the name). */
  models?: Record<string, string | null | undefined>;
}): ReactNode {
  const refs = useRef<Map<string, Container>>(new Map());
  const items: WalkerItem[] = [
    ...trips.map((t) => ({
      key: `trip-${t.sessionId}`,
      sessionId: t.sessionId,
      slot: t.slot,
      pos: (now: number) => tripPosition(t, now),
      visible: () => true,
    })),
    ...traffic.map((w) => ({
      key: `${w.kind}-${w.sessionId}`,
      sessionId: w.sessionId,
      slot: w.slot,
      pos: (now: number) => trafficPosition(w, now),
      visible: (now: number) =>
        w.kind === "arrive" || now - w.startedAt < w.durationMs,
    })),
  ];
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useTick(() => {
    const now = Date.now();
    for (const it of itemsRef.current) {
      const c = refs.current.get(it.key);
      if (!c) continue;
      const p = it.pos(now);
      c.x = p.x;
      c.y = p.y;
      c.zIndex = p.y + 24;
      c.visible = it.visible(now);
      const inner = c.children[0];
      if (inner) inner.y = p.moving ? -Math.abs(Math.sin(now / 110)) * 3 : 0;
    }
  });

  const now = Date.now();
  return (
    <>
      {items.map((it) => {
        const p = it.pos(now);
        const name = agentNameForDesk(it.slot - 1);
        return (
          <pixiContainer
            key={it.key}
            ref={(c: Container | null) => {
              if (c) refs.current.set(it.key, c);
              else refs.current.delete(it.key);
            }}
            x={p.x}
            y={p.y}
            zIndex={p.y + 24}
            visible={it.visible(now)}
          >
            <pixiContainer scale={DESK_SCALE}>
              <AgentSprite
                id={it.sessionId}
                name={name}
                color={getAgentLook(name, CAPSULE_COLOR).color}
                number={0}
                position={ORIGIN}
                phase="idle"
                bubble={null}
                renderBubble={false}
                renderLabel={true}
                provider="claude"
                modelLabel={formatModelLabel(models?.[it.sessionId])}
              />
            </pixiContainer>
          </pixiContainer>
        );
      })}
    </>
  );
}
