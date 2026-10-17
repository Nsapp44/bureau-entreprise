/**
 * AgentSprite Component
 *
 * Renders a single agent character as a colored capsule with optional bubble.
 * Supports headset and sunglasses accessories.
 */

"use client";

import {
  memo,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useTick } from "@pixi/react";
import { Graphics, TextStyle, Texture } from "pixi.js";
import type { Position, BubbleContent } from "@/types";
import type { AgentPhase } from "@/stores/gameStore";
import { useAttentionStore } from "@/stores/attentionStore";
import { usePreferencesStore } from "@/stores/preferencesStore";
import { isInElevatorZone } from "@/systems/queuePositions";
import { ICON_MAP } from "./shared/iconMap";
import { drawBubble, drawIconBadge } from "./shared/drawBubble";
import { drawRightArm, drawLeftArm } from "./shared/drawArm";
import { truncateBubbleText } from "@/utils/bubbleText";
import { getAgentLook, type PixelLook } from "@/constants/agentLooks";
import { providerColorNumber } from "@/utils/providers";

// ============================================================================
// TYPES
// ============================================================================

export interface AgentSpriteProps {
  id: string;
  name: string | null;
  color: string;
  number: number;
  position: Position;
  phase: AgentPhase;
  bubble: BubbleContent | null;
  headsetTexture?: Texture | null;
  sunglassesTexture?: Texture | null;
  renderBubble?: boolean; // Whether to render bubble (default true)
  renderLabel?: boolean; // Whether to render name label (default true)
  isTyping?: boolean; // Whether agent is typing (animates arms)
  provider?: string | null; // Model provider: colours the chest badge
  modelLabel?: string | null; // Short model label shown above the name
}

// ============================================================================
// CONSTANTS
// ============================================================================

const AGENT_WIDTH = 48; // 1.5 blocks × 32px (matches boss)
const AGENT_HEIGHT = 80; // 2.5 blocks × 32px (matches boss)
const STROKE_WIDTH = 4;

// ============================================================================
// DRAWING FUNCTIONS
// ============================================================================

function drawAgent(g: Graphics, color: string): void {
  g.clear();

  // Convert hex color string to number
  const colorNum = parseInt(color.replace("#", ""), 16) || 0xff6b6b;

  // Agent body (colored capsule with white border)
  // Position is at CENTER OF BOTTOM CIRCLE, so capsule extends from -54 to +22
  // Inset by half stroke width so total size matches AGENT_WIDTH × AGENT_HEIGHT
  const innerWidth = AGENT_WIDTH - STROKE_WIDTH;
  const innerHeight = AGENT_HEIGHT - STROKE_WIDTH;
  const agentRadius = innerWidth / 2; // 22px - radius of top/bottom circles
  g.roundRect(
    -innerWidth / 2,
    -innerHeight + agentRadius, // Bottom circle center at y=0
    innerWidth,
    innerHeight,
    agentRadius,
  );
  g.fill(colorNum);
  g.stroke({ width: STROKE_WIDTH, color: 0xffffff });
}

/** Employee badge pinned on the chest, in the colour of the model provider. */
function drawEmployeeBadge(g: Graphics, colorNum: number): void {
  g.clear();
  g.roundRect(-18, -24, 13, 10, 2);
  g.fill(colorNum);
  g.stroke({ width: 1, color: 0x1a1917 });
  // photo + text line of the card
  g.rect(-16, -22, 4, 4);
  g.fill(0xffffff);
  g.rect(-10, -22, 3, 1);
  g.rect(-10, -19, 3, 1);
  g.fill(0xffffff);
}

function hexToNum(color: string): number {
  return parseInt(color.replace("#", ""), 16) || 0;
}

/** Crisp pixel rects of a look (no anti-aliasing: axis-aligned integer rects). */
/** Two small pixel eyes, used when an agent has no dedicated look. */
function drawDefaultEyes(g: Graphics): void {
  g.clear();
  g.rect(-11, -43, 5, 5);
  g.rect(6, -43, 5, 5);
  g.fill(0x1a1917);
  g.rect(-10, -42, 2, 2);
  g.rect(7, -42, 2, 2);
  g.fill(0xffffff);
}

function drawPixelRects(g: Graphics, look: PixelLook): void {
  g.clear();
  for (const [x, y, w, h, c] of look.rects) {
    g.rect(x, y, w, h);
    g.fill(hexToNum(c));
  }
}

const ORBIT_RX = 34;
const ORBIT_RY = 14;
const ORBIT_CY = -20;
const ELECTRON = 6;
const ORBIT_SPEED = (Math.PI * 2) / 90; // rad per frame-unit: ~1 turn / 1.5 s

/**
 * Electron ring drawn behind the body. The electron is moved imperatively in
 * the ticker (no React re-render per frame).
 */
function AgentOrbit({ color }: { color: string }): ReactNode {
  const electronRef = useRef<Graphics | null>(null);
  const angleRef = useRef(0);

  const drawRing = useCallback(
    (g: Graphics) => {
      g.clear();
      g.ellipse(0, ORBIT_CY, ORBIT_RX, ORBIT_RY);
      g.stroke({ width: 2, color: hexToNum(color), alpha: 0.8 });
    },
    [color],
  );
  const drawElectron = useCallback((g: Graphics) => {
    g.clear();
    g.rect(-ELECTRON / 2, -ELECTRON / 2, ELECTRON, ELECTRON);
    g.fill(0xffffff);
  }, []);

  useTick((ticker) => {
    const e = electronRef.current;
    if (!e) return;
    angleRef.current += ticker.deltaTime * ORBIT_SPEED;
    e.x = Math.round(Math.cos(angleRef.current) * ORBIT_RX);
    e.y = Math.round(ORBIT_CY + Math.sin(angleRef.current) * ORBIT_RY);
  });

  return (
    <>
      <pixiGraphics draw={drawRing} />
      <pixiGraphics
        ref={electronRef}
        draw={drawElectron}
        x={ORBIT_RX}
        y={ORBIT_CY}
      />
    </>
  );
}

// ============================================================================
// BUBBLE COMPONENT
// ============================================================================

interface BubbleProps {
  content: BubbleContent;
  yOffset: number;
}

function Bubble({ content, yOffset }: BubbleProps): ReactNode {
  const { type = "thought", icon } = content;
  const text = truncateBubbleText(content.text);

  // Convert icon name to emoji if needed
  const iconEmoji = icon ? (ICON_MAP[icon] ?? icon) : undefined;

  // Icon badge constants
  const badgeRadius = 16; // Radius of the circular badge

  // Calculate bubble dimensions (at display scale) - icon is outside bubble now
  const charWidth = 7.5;
  const paddingH = 30;
  const maxW = 220;
  const rawWidth = text.length * charWidth + paddingH;
  const bWidth = Math.min(maxW, Math.max(80, rawWidth));
  const capacity = (bWidth - paddingH) / charWidth;
  const lines = Math.max(1, Math.ceil(text.length / capacity));
  const bHeight = 35 + lines * 14;

  // Text style at 2x for sharp rendering
  const textStyle = useMemo<Partial<TextStyle>>(
    () => ({
      fontFamily:
        '"Courier New", Courier, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", monospace',
      fontSize: 20,
      fill: "#000000",
      fontWeight: "bold",
      wordWrap: true,
      wordWrapWidth: (bWidth - 30) * 2,
      breakWords: true,
      align: "left",
      lineHeight: 28,
      stroke: { width: 0, color: 0x000000 },
    }),
    [bWidth],
  );

  // Icon style - larger emoji
  const iconStyle = useMemo<Partial<TextStyle>>(
    () => ({
      fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
      fontSize: 40, // Large emoji for badge
      fill: "#000000",
    }),
    [],
  );

  return (
    <pixiContainer y={yOffset} x={45}>
      <pixiGraphics draw={(g) => drawBubble(g, bWidth, bHeight, type)} />
      {/* Icon badge on top-left corner of bubble */}
      {iconEmoji && (
        <pixiContainer x={-bWidth / 2 - 6} y={-bHeight + 6}>
          <pixiGraphics draw={(g) => drawIconBadge(g, badgeRadius)} />
          <pixiContainer scale={0.5} x={0} y={1}>
            <pixiText
              text={iconEmoji}
              anchor={0.5}
              style={iconStyle}
              resolution={2}
            />
          </pixiContainer>
        </pixiContainer>
      )}
      {/* Text rendered at 2x and scaled down for sharpness */}
      <pixiContainer x={-bWidth / 2 + 15} y={-bHeight / 2} scale={0.5}>
        <pixiText
          text={text}
          anchor={{ x: 0, y: 0.5 }}
          style={textStyle}
          resolution={2}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function AgentSpriteComponent({
  id,
  name,
  color,
  number: _number,
  position,
  phase: _phase,
  bubble,
  headsetTexture: _headsetTexture,
  renderBubble = true,
  renderLabel = true,
  isTyping: _isTyping = false,
  provider,
  modelLabel,
}: AgentSpriteProps): ReactNode {
  const drawBadge = useMemo(() => {
    const colorNum = providerColorNumber(provider);
    return (g: Graphics) => drawEmployeeBadge(g, colorNum);
  }, [provider]);
  const clickToFocusEnabled = usePreferencesStore((s) => s.clickToFocusEnabled);
  const openFocusPopup = useAttentionStore((s) => s.openFocusPopup);

  // Memoize draw callback
  const drawCallback = useMemo(
    () => (g: Graphics) => drawAgent(g, color),
    [color],
  );

  // Pixel-art look (null for unknown names -> original capsule)
  const pixelLook = useMemo(() => getAgentLook(name, color).pixel, [name, color]);
  const drawPixels = useMemo(
    () => (pixelLook ? (g: Graphics) => drawPixelRects(g, pixelLook) : null),
    [pixelLook],
  );

  // Click handler for focus popup
  const handlePointerTap = useCallback(() => {
    if (!clickToFocusEnabled) return;
    const canvas = document.querySelector(".pixi-canvas-container canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / 1280; // CANVAS_WIDTH = 1280
    const screenX = rect.left + position.x * scale;
    const screenY = rect.top + position.y * scale;
    openFocusPopup(id, screenX, screenY);
  }, [clickToFocusEnabled, id, position.x, position.y, openFocusPopup]);

  // Bubble offset for capsule rendering
  const bubbleOffset = -93;

  return (
    <pixiContainer
      x={position.x}
      y={position.y}
      onPointerTap={handlePointerTap}
      interactive={clickToFocusEnabled}
    >
      {/* Electron orbit (behind the body) */}
      {pixelLook?.orbit && <AgentOrbit color={pixelLook.orbit} />}

      {/* Agent capsule body */}
      <pixiGraphics draw={drawCallback} />

      {/* Simple eyes for agents without a pixel look (no more aviators) */}
      {!pixelLook && <pixiGraphics draw={drawDefaultEyes} />}

      {/* Pixel-art look rects (hat, antenna, staff...) */}
      {drawPixels && <pixiGraphics draw={drawPixels} />}

      {/* Employee badge: provider colour (only once the provider is known) */}
      {provider && provider !== "unknown" && (
        <pixiGraphics draw={drawBadge} />
      )}

      {/* Agent name if present - hide when in elevator or when renderLabel is false */}
      {renderLabel && name && !isInElevatorZone(position) && (
        <pixiContainer y={-70} scale={0.5}>
          {modelLabel && (
            <pixiText
              text={modelLabel}
              anchor={0.5}
              y={-24}
              style={{
                fontFamily: "monospace",
                fontSize: 18,
                fill: 0xff5a3c,
                fontWeight: "bold",
                stroke: { width: 4, color: 0x000000 },
              }}
              resolution={2}
            />
          )}
          <pixiText
            text={name}
            anchor={0.5}
            style={{
              fontFamily: "monospace",
              fontSize: 24,
              fill: 0xffffff,
              fontWeight: "bold",
              stroke: { width: 4, color: 0x000000 },
            }}
            resolution={2}
          />
        </pixiContainer>
      )}

      {/* Bubble - hide when in elevator or when renderBubble is false */}
      {renderBubble && bubble && !isInElevatorZone(position) && (
        <Bubble content={bubble} yOffset={bubbleOffset} />
      )}
    </pixiContainer>
  );
}

// ============================================================================
// AGENT ARMS COMPONENT (rendered separately after desk surfaces)
// ============================================================================

export interface AgentArmsProps {
  position: Position;
  isTyping: boolean;
}

function AgentArmsComponent({ position, isTyping }: AgentArmsProps): ReactNode {
  // Animation state for typing
  const [typingTime, setTypingTime] = useState(0);

  // Animate typing - oscillate hands up/down
  useTick((ticker) => {
    if (isTyping) {
      setTypingTime((t) => t + ticker.deltaTime * 0.15);
    } else if (typingTime !== 0) {
      setTypingTime(0);
    }
  });

  // Calculate arm animation offsets (subtle, out of phase for natural look)
  const rightArmOffset = isTyping ? Math.sin(typingTime * 8) * 2 : 0;
  const leftArmOffset = isTyping
    ? Math.sin(typingTime * 8 + Math.PI * 0.7) * 2
    : 0;

  // Agent arm params: body half-width 22px, shoulder at y=-16, keyboard at y=16
  const agentArmParams = useMemo(
    () => ({
      bodyHalfWidth: (AGENT_WIDTH - STROKE_WIDTH) / 2,
      startY: -16,
      endY: 16,
      handColor: 0x1f2937,
    }),
    [],
  );

  // Arm draw callbacks
  const drawRightArmCallback = useCallback(
    (g: Graphics) =>
      drawRightArm(g, { ...agentArmParams, animOffset: rightArmOffset }),
    [agentArmParams, rightArmOffset],
  );

  const drawLeftArmCallback = useCallback(
    (g: Graphics) =>
      drawLeftArm(g, { ...agentArmParams, animOffset: leftArmOffset }),
    [agentArmParams, leftArmOffset],
  );

  return (
    <pixiContainer x={position.x} y={position.y}>
      <pixiGraphics draw={drawRightArmCallback} />
      <pixiGraphics draw={drawLeftArmCallback} />
    </pixiContainer>
  );
}

export const AgentArms = memo(AgentArmsComponent);

// ============================================================================
// AGENT HEADSET COMPONENT (rendered after arms for correct z-order)
// ============================================================================

export interface AgentHeadsetProps {
  position: Position;
  headsetTexture: Texture;
}

function AgentHeadsetComponent({
  position,
  headsetTexture,
}: AgentHeadsetProps): ReactNode {
  return (
    <pixiSprite
      texture={headsetTexture}
      anchor={0.5}
      x={position.x}
      y={position.y - 38}
      scale={{ x: 0.66825, y: 0.675 }}
    />
  );
}

export const AgentHeadset = memo(AgentHeadsetComponent);

// ============================================================================
// AGENT LABEL COMPONENT (rendered separately for z-ordering)
// ============================================================================

export interface AgentLabelProps {
  name: string;
  /** Short model label (e.g. "Haiku 4.5"), shown in accent orange above the name. */
  modelLabel?: string | null;
  position: Position;
}

function AgentLabelComponent({
  name,
  modelLabel,
  position,
}: AgentLabelProps): ReactNode {
  return (
    <pixiContainer x={position.x} y={position.y - 70} scale={0.5}>
      {modelLabel && (
        <pixiText
          text={modelLabel}
          anchor={0.5}
          y={-24}
          style={{
            fontFamily: "monospace",
            fontSize: 18,
            fill: 0xff5a3c,
            fontWeight: "bold",
            stroke: { width: 4, color: 0x000000 },
          }}
          resolution={2}
        />
      )}
      <pixiText
        text={name}
        anchor={0.5}
        style={{
          fontFamily: "monospace",
          fontSize: 24,
          fill: 0xffffff,
          fontWeight: "bold",
          stroke: { width: 4, color: 0x000000 },
        }}
        resolution={2}
      />
    </pixiContainer>
  );
}

export const AgentLabel = memo(AgentLabelComponent);

export const AgentSprite = memo(AgentSpriteComponent);

// Export Bubble component for use in top-level bubbles layer
export { Bubble };
