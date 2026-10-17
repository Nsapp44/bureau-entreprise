"use client";

/**
 * Whiteboard - Office whiteboard display with multiple modes.
 *
 * Click anywhere on the whiteboard to cycle through 3 display modes.
 * Keyboard shortcuts: 0-2 jump to that mode, C = Conso, S = Star, T = Todo
 *
 * 0: Conso (tokens du jour par famille de modèle, défaut)
 * 1: Star (l'agent qui a le plus bossé aujourd'hui)
 * 2: Todo List
 */

import { Graphics } from "pixi.js";
import { useCallback, useEffect, type ReactNode } from "react";
import type { TodoItem, WhiteboardMode } from "@/types";
import { useGameStore } from "@/stores/gameStore";
import { ConsoMode } from "./whiteboard/ConsoMode";
import { StarMode } from "./whiteboard/StarMode";
import { useWorkTracker } from "@/hooks/useWorkTracker";
import { TodoListMode } from "./whiteboard/TodoListMode";
import {
  MODE_INFO,
  WHITEBOARD_MODE_COUNT,
} from "./whiteboard/WhiteboardModeRegistry";

// ============================================================================
// WHITEBOARD FRAME
// ============================================================================

interface WhiteboardFrameProps {
  children: ReactNode;
  onPointerDown: () => void;
  mode: WhiteboardMode;
}

function WhiteboardFrame({
  children,
  onPointerDown,
  mode,
}: WhiteboardFrameProps): ReactNode {
  const drawWhiteboard = useCallback((g: Graphics) => {
    g.clear();

    // Ombre portée
    g.roundRect(3, 4, 330, 205, 6);
    g.fill({ color: 0x000000, alpha: 0.35 });

    // Panneau graphite + liseré
    g.roundRect(0, 0, 330, 205, 6);
    g.fill(0x1a1917);
    g.stroke({ width: 1, color: 0xffffff, alpha: 0.18 });

    // Bandeau d'en-tête
    g.roundRect(1, 1, 328, 26, 5);
    g.fill(0x22201e);
    g.rect(1, 26, 328, 1);
    g.fill({ color: 0xffffff, alpha: 0.1 });

    // Accent (point voyant)
    g.circle(14, 14, 3);
    g.fill(0xff5a3c);
  }, []);

  const modeInfo = MODE_INFO[mode];

  return (
    <pixiContainer eventMode="static" onPointerDown={onPointerDown}>
      <pixiGraphics draw={drawWhiteboard} />

      {/* Header - rendered at 2x for sharpness */}
      <pixiContainer x={26} y={14} scale={0.5}>
        <pixiText
          text={modeInfo.name}
          anchor={{ x: 0, y: 0.5 }}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 24,
            fontWeight: "bold",
            fill: "#F3F1EC",
            letterSpacing: 2,
          }}
          resolution={2}
        />
      </pixiContainer>

      {/* Mode indicator dots */}
      <pixiContainer x={165} y={196}>
        {Array.from({ length: WHITEBOARD_MODE_COUNT }).map((_, i) => (
          <pixiGraphics
            key={i}
            x={(i - (WHITEBOARD_MODE_COUNT - 1) / 2) * 10}
            draw={(g: Graphics) => {
              g.clear();
              g.circle(0, 0, i === mode ? 3 : 2);
              g.fill(i === mode ? 0xff5a3c : 0x5a5651);
            }}
          />
        ))}
      </pixiContainer>

      {/* Content area */}
      <pixiContainer y={36}>{children}</pixiContainer>
    </pixiContainer>
  );
}

// ============================================================================
// MAIN WHITEBOARD COMPONENT
// ============================================================================

export interface WhiteboardProps {
  todos: TodoItem[];
}

export function Whiteboard({ todos }: WhiteboardProps): ReactNode {
  const whiteboardMode = useGameStore((s) => s.whiteboardMode);
  const cycleMode = useGameStore((s) => s.cycleWhiteboardMode);
  const setMode = useGameStore((s) => s.setWhiteboardMode);
  const workLog = useWorkTracker();

  // Keyboard hotkeys: C = Conso (0), S = Star (1), T = Todo (2), 0-2 = modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Number keys 0-2 set mode directly
      if (key >= "0" && key <= "2") {
        setMode(parseInt(key, 10) as WhiteboardMode);
        return;
      }

      // Letter hotkeys
      switch (key) {
        case "c":
          setMode(0);
          break;
        case "s":
          setMode(1);
          break;
        case "t":
          setMode(2);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMode]);

  const handleClick = useCallback(() => {
    cycleMode();
  }, [cycleMode]);

  // Render the appropriate mode component
  const renderMode = (): ReactNode => {
    switch (whiteboardMode) {
      case 0:
        return <ConsoMode />;
      case 1:
        return <StarMode log={workLog} />;
      case 2:
        return <TodoListMode todos={todos} />;
      default:
        return <ConsoMode />;
    }
  };

  return (
    <WhiteboardFrame onPointerDown={handleClick} mode={whiteboardMode}>
      {renderMode()}
    </WhiteboardFrame>
  );
}
