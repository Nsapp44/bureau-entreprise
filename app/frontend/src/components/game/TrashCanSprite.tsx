/**
 * TrashCanSprite Component
 *
 * Renders a procedurally drawn mesh wire trash can that visually represents
 * context window utilization. Shows crumpled paper filling up as context increases.
 */

"use client";

import { memo, useMemo, useCallback } from "react";
import { Graphics, TextStyle } from "pixi.js";

// ============================================================================
// TYPES
// ============================================================================

export interface TrashCanSpriteProps {
  x: number;
  y: number;
  contextUtilization: number; // 0.0 to 1.0
  isCompacting?: boolean; // True when compaction animation is active
  isStomping?: boolean; // True when boss is stomping on trash can (squish effect)
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Trash can dimensions
const CAN_WIDTH = 44;
const CAN_HEIGHT = 52;
const CAN_TOP_WIDTH = 50;
const RIM_HEIGHT = 4;

// Colors
const BODY_COLOR = 0x2e333b;
const BODY_LIGHT = 0x4a515c;
const BODY_DARK = 0x1f232a;
const INTERIOR_COLOR = 0x15171b;
const OUTLINE_COLOR = 0x0c0c0f;
const RIM_COLOR = 0x9aa1ab;
const ACCENT_COLOR = 0xff6a13;
const PAPER_COLORS = [0xf5f5f0, 0xebe8e0, 0xfafaf5, 0xe8e5dd, 0xf0ede5];
const PAPER_SHADOW = 0xd0cdc5;

// Colors for percentage text based on fill level
const FILL_COLORS: Record<number, number> = {
  0: 0x22c55e, // Green - empty/low
  1: 0x84cc16, // Lime - 25%
  2: 0xeab308, // Yellow - 50%
  3: 0xf97316, // Orange - 75%
  4: 0xef4444, // Red - full
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFrameIndex(utilization: number): number {
  if (utilization <= 0.1) return 0;
  if (utilization <= 0.3) return 1;
  if (utilization <= 0.55) return 2;
  if (utilization <= 0.8) return 3;
  return 4;
}

// Seeded random for consistent paper positions
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function drawTrashCan(g: Graphics, utilization: number): void {
  g.clear();

  const halfWidth = CAN_WIDTH / 2;
  const halfTopWidth = CAN_TOP_WIDTH / 2;
  const topY = -CAN_HEIGHT / 2;
  const bottomY = CAN_HEIGHT / 2;
  const bodyTop = topY + RIM_HEIGHT;
  const widthAt = (y: number): number =>
    halfTopWidth - ((halfTopWidth - halfWidth) * (y - bodyTop)) / (bottomY - bodyTop);

  // Interior (seen through the front window)
  g.poly([-halfTopWidth, bodyTop, halfTopWidth, bodyTop, halfWidth, bottomY, -halfWidth, bottomY]);
  g.fill(INTERIOR_COLOR);

  // Crumpled paper inside, drawn before the body so the frame covers the edges
  const fillLevel = Math.min(Math.max(utilization, 0), 1.0);
  const rand = seededRandom(42);
  const numPapers = Math.floor(3 + fillLevel * 12);

  if (utilization > 0.05) {
    const fillHeight = (CAN_HEIGHT - RIM_HEIGHT - 8) * fillLevel;
    const fillTop = bottomY - fillHeight;
    for (let i = 0; i < numPapers; i++) {
      const paperY = fillTop + rand() * fillHeight * 0.9;
      const widthAtY =
        halfWidth +
        ((halfTopWidth - halfWidth) * (bottomY - paperY)) / CAN_HEIGHT;
      const paperX = (rand() - 0.5) * widthAtY * 1.6;
      const paperSize = 4 + rand() * 6;
      const colorIdx = Math.floor(rand() * PAPER_COLORS.length);
      drawCrumpledPaper(g, paperX, paperY, paperSize, PAPER_COLORS[colorIdx], rand);
    }
  }

  // Brushed-metal body: side panels + top and bottom bands around a window
  const winTop = bodyTop + 7;
  const winBottom = bottomY - 6;
  const side = 6;
  g.poly([
    -widthAt(bodyTop), bodyTop, -widthAt(bodyTop) + side, bodyTop,
    -halfWidth + side, bottomY, -halfWidth, bottomY,
  ]);
  g.fill(BODY_LIGHT);
  g.poly([
    widthAt(bodyTop) - side, bodyTop, widthAt(bodyTop), bodyTop,
    halfWidth, bottomY, halfWidth - side, bottomY,
  ]);
  g.fill(BODY_DARK);
  g.poly([
    -widthAt(bodyTop), bodyTop, widthAt(bodyTop), bodyTop,
    widthAt(winTop), winTop, -widthAt(winTop), winTop,
  ]);
  g.fill(BODY_COLOR);
  g.poly([
    -widthAt(winBottom), winBottom, widthAt(winBottom), winBottom,
    halfWidth, bottomY, -halfWidth, bottomY,
  ]);
  g.fill(BODY_COLOR);

  // Nasap3D orange band under the rim
  g.poly([
    -widthAt(bodyTop + 2), bodyTop + 2, widthAt(bodyTop + 2), bodyTop + 2,
    widthAt(bodyTop + 4), bodyTop + 4, -widthAt(bodyTop + 4), bodyTop + 4,
  ]);
  g.fill(ACCENT_COLOR);

  // Tinted glass with a highlight streak
  g.poly([
    -widthAt(winTop) + side, winTop, widthAt(winTop) - side, winTop,
    widthAt(winBottom) - side, winBottom, -widthAt(winBottom) + side, winBottom,
  ]);
  g.fill({ color: 0x9fd8ff, alpha: 0.12 });
  g.moveTo(-widthAt(winTop) + side + 4, winTop + 2);
  g.lineTo(-widthAt(winTop) + side + 2, winBottom - 2);
  g.stroke({ width: 2, color: 0xffffff, alpha: 0.25 });

  // Outline + feet
  g.poly([-halfTopWidth, bodyTop, halfTopWidth, bodyTop, halfWidth, bottomY, -halfWidth, bottomY]);
  g.stroke({ width: 2, color: OUTLINE_COLOR });
  g.rect(-halfWidth + 2, bottomY, 6, 3);
  g.rect(halfWidth - 8, bottomY, 6, 3);
  g.fill(OUTLINE_COLOR);

  // Steel rim with dark opening
  g.ellipse(0, topY + RIM_HEIGHT / 2, halfTopWidth, RIM_HEIGHT);
  g.fill(RIM_COLOR);
  g.stroke({ width: 1.5, color: OUTLINE_COLOR });
  g.ellipse(0, topY + RIM_HEIGHT / 2, halfTopWidth - 4, RIM_HEIGHT - 2);
  g.fill(INTERIOR_COLOR);

  // Overflowing papers on top of the rim
  if (utilization > 0.85) {
    const overflowCount = Math.floor((utilization - 0.85) * 20);
    for (let i = 0; i < overflowCount; i++) {
      const paperX = (rand() - 0.5) * halfTopWidth * 1.5;
      const paperY = topY - rand() * 15;
      const paperSize = 5 + rand() * 5;
      const colorIdx = Math.floor(rand() * PAPER_COLORS.length);
      drawCrumpledPaper(g, paperX, paperY, paperSize, PAPER_COLORS[colorIdx], rand);
    }
  }
}

function drawCrumpledPaper(
  g: Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  rand: () => number,
): void {
  // Draw an irregular crumpled paper shape
  const points = 6;
  const vertices: { x: number; y: number }[] = [];

  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = size * (0.6 + rand() * 0.4);
    vertices.push({
      x: x + Math.cos(angle) * r,
      y: y + Math.sin(angle) * r * 0.7, // Slightly flattened
    });
  }

  // Draw shadow
  g.moveTo(vertices[0].x + 1, vertices[0].y + 1);
  for (let i = 1; i < vertices.length; i++) {
    g.lineTo(vertices[i].x + 1, vertices[i].y + 1);
  }
  g.closePath();
  g.fill({ color: PAPER_SHADOW, alpha: 0.5 });

  // Draw paper
  g.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i++) {
    g.lineTo(vertices[i].x, vertices[i].y);
  }
  g.closePath();
  g.fill(color);

  // Add crumple lines
  if (size > 5) {
    g.moveTo(x - size * 0.3, y - size * 0.2);
    g.lineTo(x + size * 0.2, y + size * 0.1);
    g.stroke({ width: 0.5, color: PAPER_SHADOW, alpha: 0.4 });
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

function TrashCanSpriteComponent({
  x,
  y,
  contextUtilization,
  isCompacting = false,
  isStomping = false,
}: TrashCanSpriteProps) {
  const frameIndex = useMemo(
    () => getFrameIndex(contextUtilization),
    [contextUtilization],
  );

  const percentage = Math.round(contextUtilization * 100);
  const textColor = FILL_COLORS[frameIndex] ?? 0x888888;

  // Squish when stomping, normal otherwise
  const squishScale = useMemo(() => {
    if (isStomping) {
      return { x: 1.15, y: 0.85 };
    }
    return { x: 1, y: 1 };
  }, [isStomping]);

  // Compute shake values directly from props (deterministic based on contextUtilization)
  const { shakeOffset, shakeRotation } = useMemo(() => {
    if (isStomping) {
      // Create deterministic "random" based on contextUtilization
      const seed = contextUtilization * 12345;
      return {
        shakeOffset: (seed % 400) / 100 - 2, // Range: -2 to 2
        shakeRotation: ((seed * 7) % 100) / 1000 - 0.05, // Range: -0.05 to 0.05
      };
    }
    return { shakeOffset: 0, shakeRotation: 0 };
  }, [isStomping, contextUtilization]);

  // Memoize the draw callback to prevent unnecessary redraws
  const drawCallback = useCallback(
    (g: Graphics) => drawTrashCan(g, contextUtilization),
    [contextUtilization],
  );

  // Render text at 2x resolution for crisp display, then scale down
  const textStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: "monospace",
        fontSize: 22, // 2x for crisp rendering
        fontWeight: "bold",
        fill: textColor,
        align: "center",
      }),
    [textColor],
  );

  const labelStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: "monospace",
        fontSize: 16, // 2x for crisp rendering
        fill: 0x666666,
        align: "center",
      }),
    [],
  );

  // Compaction label style (shows during animation)
  const compactingStyle = useMemo(
    () =>
      new TextStyle({
        fontFamily: "monospace",
        fontSize: 18, // 2x for crisp rendering
        fontWeight: "bold",
        fill: 0xff6b6b, // Red/coral color for attention
        align: "center",
      }),
    [],
  );

  return (
    <pixiContainer
      x={x + shakeOffset}
      y={y}
      rotation={shakeRotation}
      scale={squishScale}
    >
      {/* Procedurally drawn mesh wire trash can */}
      <pixiGraphics draw={drawCallback} />

      {/* Context percentage label - rendered at 2x and scaled to 0.5 for crisp text */}
      <pixiText
        text={`${percentage}%`}
        anchor={0.5}
        y={38}
        scale={0.5}
        style={textStyle}
      />
      <pixiText
        text={isCompacting ? "compacting..." : "context"}
        anchor={0.5}
        y={46}
        scale={0.5}
        style={isCompacting ? compactingStyle : labelStyle}
      />
    </pixiContainer>
  );
}

export const TrashCanSprite = memo(TrashCanSpriteComponent);
