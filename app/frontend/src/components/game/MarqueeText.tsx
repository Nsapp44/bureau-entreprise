/**
 * MarqueeText Component
 *
 * Text banner for task descriptions on desks. Text longer than the panel
 * scrolls back and forth (with a pause at each end).
 */

"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Container, Graphics, Text } from "pixi.js";
import { useTick } from "@pixi/react";

/** Scroll speed (container units per second) and pause at each end. */
const SCROLL_SPEED = 30;
const PAUSE_S = 1.5;

// ============================================================================
// TYPES
// ============================================================================

export interface MarqueeTextProps {
  text: string;
  width: number;
  color?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MarqueeText({
  text,
  width,
  color = "#00ff88",
}: MarqueeTextProps): ReactNode {
  const [maskGraphics, setMaskGraphics] = useState<Graphics | null>(null);
  const textContainerRef = useRef<Container | null>(null);

  // Normalize text to single line; when it does not fit the panel it scrolls
  // back and forth (Courier bold 18px ≈ 11 units per char in the 2x container).
  const normalizedText = text.replace(/\s+/g, " ").trim();
  const textRef = useRef<Text | null>(null);
  const viewW = (width - 8) * 2 - 8;
  const textW = normalizedText.length * 11;
  const overflow = textW > viewW;
  const panelHeight = 14;

  useTick(() => {
    const t = textRef.current;
    if (!t || !overflow) return;
    const range = textW - viewW;
    const scrollS = range / SCROLL_SPEED;
    const period = 2 * (PAUSE_S + scrollS);
    const p = (performance.now() / 1000) % period;
    let k = 0; // 0 = start, 1 = end
    if (p < PAUSE_S) k = 0;
    else if (p < PAUSE_S + scrollS) k = (p - PAUSE_S) / scrollS;
    else if (p < 2 * PAUSE_S + scrollS) k = 1;
    else k = 1 - (p - 2 * PAUSE_S - scrollS) / scrollS;
    t.x = -viewW / 2 - k * range;
  });

  // Draw background panel
  const drawPanel = useCallback(
    (g: Graphics) => {
      g.clear();
      // Dark semi-transparent background
      g.roundRect(-width / 2, -panelHeight / 2, width, panelHeight, 3);
      g.fill({ color: 0x1a1a1a, alpha: 0.9 });
      g.stroke({ width: 1, color: 0x444444 });
    },
    [width],
  );

  // Draw mask for text clipping
  const drawMask = useCallback(
    (g: Graphics) => {
      g.clear();
      g.roundRect(
        -width / 2 + 4,
        -panelHeight / 2 + 1,
        width - 8,
        panelHeight - 2,
        2,
      );
      g.fill(0xffffff);
    },
    [width],
  );

  // Apply mask when both mask graphics and container are ready
  useEffect(() => {
    if (maskGraphics && textContainerRef.current) {
      textContainerRef.current.mask = maskGraphics;
    }
    return () => {
      if (textContainerRef.current) {
        textContainerRef.current.mask = null;
      }
    };
  }, [maskGraphics]);

  // Callback ref to capture the mask graphics
  const maskRefCallback = useCallback((ref: Graphics | null) => {
    setMaskGraphics(ref);
  }, []);

  // Callback ref for text container. Reapply the mask here too, so clipping
  // survives the container instance being recreated while maskGraphics is stable
  // (the [maskGraphics]-only effect above wouldn't re-run in that case).
  const textContainerRefCallback = useCallback(
    (ref: Container | null) => {
      textContainerRef.current = ref;
      if (ref && maskGraphics) {
        ref.mask = maskGraphics;
      }
    },
    [maskGraphics],
  );

  return (
    <pixiContainer>
      <pixiGraphics draw={drawPanel} />
      {/* Mask graphics - invisible but used for clipping */}
      <pixiGraphics draw={drawMask} ref={maskRefCallback} />
      {/* Text container with mask applied - render at 2x and scale down for sharpness */}
      <pixiContainer ref={textContainerRefCallback} scale={0.5}>
        <pixiText
          ref={textRef}
          text={normalizedText}
          x={overflow ? -viewW / 2 : 0}
          y={0}
          anchor={{ x: overflow ? 0 : 0.5, y: 0.5 }}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 18,
            fill: color,
            fontWeight: "bold",
          }}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}
