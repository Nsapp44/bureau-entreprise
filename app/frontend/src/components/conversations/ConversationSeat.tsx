"use client";

import { useTick } from "@pixi/react";
import { Container, Graphics } from "pixi.js";
import {
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ActiveConversation } from "@/types";
import { getAgentLook } from "@/constants/agentLooks";
import { providerColor } from "@/utils/providers";
import { formatModelLabel } from "@/utils/modelLabel";
import { AgentArms, AgentSprite } from "../game/AgentSprite";
import {
  ATTENTION_COLOR,
  NeedsYouBadge,
  drawAttentionGlow,
  useNeedsYouShake,
} from "../game/needsYouAlert";
import { alertText, plateText } from "./conversationsLogic";
import { hitLabel } from "./openConversation";
import { useDeskCoffeeStore } from "@/stores/deskCoffeeStore";

// Valeurs de la maquette (bureau-general-maquette.html), px relatifs au poste.
const CAPSULE_BORDER = 0xf3f1ec;
/** Couleur de repli (nom inconnu) : capsule de la maquette. */
const CAPSULE_COLOR = "#22304a";
/** Agrandissement des postes (bureau, chaise, personnage) autour de leur origine. */
export const DESK_SCALE = 1.0;
const ORIGIN = { x: 0, y: 0 };
const BODY_W = 48;
const BODY_H = 80;
const BORDER = 4;
/** Le Claude assis : centre du cercle du bas à y + 24 (DESK_SEAT_OFFSET_Y). */
const SEAT_Y = 24;
const ARMS_POS = { x: 0, y: SEAT_Y };

const TEXT_COLOR = 0xf3f1ec;
const MUTED = 0xb4ada4;
const IDLE_COLOR = 0x8e8a84;
const PLATE_BORDER = 0x716a61;
const PLATE_BG = 0x161514;
const MONO = "ui-monospace, Consolas, monospace";
/** Largeur moyenne d'un caractère monospace 11 px (Consolas). */
const CHAR_W = 6.05;

export type SeatState = "working" | "idle" | "needs_you";

export function seatState(c: ActiveConversation): SeatState {
  if (c.status === "needs_you") return "needs_you";
  if (c.status === "working") return "working";
  return "idle";
}

function hexNum(color: string): number {
  return parseInt(color.replace("#", ""), 16) || 0;
}

function drawGlow(g: Graphics): void {
  drawAttentionGlow(g, BODY_W - BORDER, BODY_H - BORDER);
}

interface SeatProps {
  /** Origine du poste (constants/positions). */
  x: number;
  y: number;
  conv: ActiveConversation;
  /** Personnage du poste (look de l'ancien bureau). */
  name?: string;
}

/** Claude assis sur sa chaise (derrière le bureau). */
function SeatBodyComponent({ x, y, conv, name }: SeatProps): ReactNode {
  const state = seatState(conv);
  const alert = state === "needs_you";
  const bodyRef = useRef<Container | null>(null);
  const glowRef = useRef<Graphics | null>(null);

  useNeedsYouShake({
    active: alert,
    targets: [bodyRef],
    glowRef,
    baseY: SEAT_Y,
  });

  return (
    <pixiContainer x={x} y={y} scale={DESK_SCALE}>
      <pixiContainer ref={bodyRef} y={SEAT_Y}>
        {alert && <pixiGraphics ref={glowRef} draw={drawGlow} y={-16} />}
        <AgentSprite
          id={conv.sessionId}
          name={name ?? null}
          color={getAgentLook(name, CAPSULE_COLOR).color}
          number={0}
          position={ORIGIN}
          phase="idle"
          bubble={null}
          renderBubble={false}
          renderLabel={true}
          provider="claude"
          modelLabel={formatModelLabel(conv.model)}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const SeatBody = memo(SeatBodyComponent);

const HAND_R = 4.5;

function drawRaisedArms(g: Graphics, wave: number): void {
  g.clear();
  // Épaules (AgentArms : y = -16 du siège), mains levées de la maquette.
  for (const side of [-1, 1] as const) {
    const up = (side === -1 ? wave : 1 - wave) * -5;
    const hx = side * 32.5;
    const hy = -21.5 + up;
    g.moveTo(side * 22, SEAT_Y - 16);
    g.lineTo(hx, hy);
    g.stroke({ width: 4, color: 0xffffff, cap: "round" });
    g.circle(hx, hy, HAND_R - 1);
    g.fill(0x1f2937);
    g.stroke({ width: 2, color: CAPSULE_BORDER });
  }
}

/** Mains : tapent (working), posées (idle) ou levées qui s'agitent (needs_you). */
function SeatArmsComponent({ x, y, conv }: SeatProps): ReactNode {
  const state = seatState(conv);
  const alert = state === "needs_you";
  const armsRef = useRef<Container | null>(null);
  const [wave, setWave] = useState(0);
  const timeRef = useRef(0);

  useNeedsYouShake({ active: alert, targets: [armsRef], baseY: 0 });

  useTick((ticker) => {
    if (!alert) return;
    timeRef.current += ticker.deltaMS;
    const next = Math.floor(timeRef.current / 150) % 2;
    if (next !== wave) setWave(next);
  });

  const draw = useCallback((g: Graphics) => drawRaisedArms(g, wave), [wave]);

  return (
    <pixiContainer x={x} y={y} scale={DESK_SCALE}>
      <pixiContainer ref={armsRef}>
        {alert ? (
          <pixiGraphics draw={draw} />
        ) : (
          <AgentArms position={ARMS_POS} isTyping={state === "working"} />
        )}
      </pixiContainer>
    </pixiContainer>
  );
}

export const SeatArms = memo(SeatArmsComponent);

/** « ! » et notification à droite de la tête (couche du dessus). */
function SeatAlertComponent({ x, y, conv }: SeatProps): ReactNode {
  const label = alertText(conv.needsReason, conv.currentTask);
  const w = Math.max(92, 24 + label.length * 6);
  const h = 18;
  const drawBox = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(0, 0, w, h).fill(ATTENTION_COLOR);
      g.rect(2, 2, w - 4, h - 4).fill(PLATE_BG);
    },
    [w],
  );
  return (
    <pixiContainer x={x} y={y} scale={DESK_SCALE}>
      <NeedsYouBadge x={57} y={-17} variant="desk" />
      <pixiContainer x={76} y={-30}>
        <pixiGraphics draw={drawBox} />
        <pixiText
          text="!"
          x={6}
          y={3}
          resolution={2}
          style={{
            fontFamily: MONO,
            fontSize: 10,
            fontWeight: "bold",
            fill: ATTENTION_COLOR,
            lineHeight: 12,
          }}
        />
        <pixiText
          text={label}
          x={6 + 2 * 6}
          y={3}
          resolution={2}
          style={{
            fontFamily: MONO,
            fontSize: 10,
            fill: TEXT_COLOR,
            lineHeight: 12,
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const SeatAlert = memo(SeatAlertComponent);

const PLATE_W = 132;
const PLATE_H = 33;

function BlinkingVoyant({ children }: { children: ReactNode }): ReactNode {
  const ref = useRef<Container | null>(null);
  const timeRef = useRef(0);
  useTick((ticker) => {
    timeRef.current = (timeRef.current + ticker.deltaMS) % 1000;
    if (ref.current) ref.current.alpha = timeRef.current < 500 ? 1 : 0.25;
  });
  return <pixiContainer ref={ref}>{children}</pixiContainer>;
}

interface PlateProps {
  x: number;
  y: number;
  num: number;
  conv: ActiveConversation | null;
}

/** Plaque sous le bureau : n° + titre, voyant + modèle + tokens (ou LIBRE). */
function DeskPlateComponent({ x, y, num, conv }: PlateProps): ReactNode {
  const n = String(num).padStart(2, "0");
  const state = conv ? seatState(conv) : null;
  const alert = state === "needs_you";
  const info = conv ? plateText(conv, 16) : null;
  const color = conv ? hexNum(providerColor("claude")) : IDLE_COLOR;
  // Cafés de CETTE conversation : chaque café = une attente de plus de 5 min.
  const coffees = useDeskCoffeeStore((s) =>
    conv ? (s.bySession[conv.sessionId] ?? 0) : 0,
  );

  const drawCoffeeBadge = useCallback((g: Graphics) => {
    g.clear();
    g.roundRect(0, 0, 34, 13, 3).fill(0x1a1a1a);
    g.roundRect(0, 0, 34, 13, 3).stroke({ width: 1.5, color: 0xff9900 });
    g.roundRect(4, 4, 6, 5, 1).fill(0xf5f5f5);
  }, []);

  const drawBox = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(0, 0, PLATE_W, PLATE_H).fill(
        alert ? ATTENTION_COLOR : PLATE_BORDER,
      );
      g.rect(2, 2, PLATE_W - 4, PLATE_H - 4).fill(PLATE_BG);
    },
    [alert],
  );

  const drawVoyant = useCallback(
    (g: Graphics) => {
      g.clear();
      if (state === "working") {
        g.circle(4.5, 4.5, 4.5).fill(color);
      } else if (state === "idle") {
        g.circle(4.5, 4.5, 3.5).stroke({ width: 2, color });
      } else if (state === null) {
        // Poste libre : pas de voyant (la maquette n'en dessine pas).
      } else {
        g.roundRect(0, 0, 12, 11, 2).fill(ATTENTION_COLOR);
      }
    },
    [state, color],
  );

  const model = (info?.model ?? "").toUpperCase();
  const voyantW = alert ? 12 : 9;
  // Place pour le modèle : 118 px de contenu − voyant − 5 − tokens − 5.
  const maxModel = info
    ? Math.max(
        3,
        Math.floor((118 - voyantW - 10 - info.tokens.length * CHAR_W) / CHAR_W),
      )
    : 0;
  const modelShown =
    model.length > maxModel ? model.slice(0, maxModel - 1) + "…" : model;

  const small = { fontFamily: MONO, fontSize: 11, lineHeight: 12 } as const;

  return (
    <pixiContainer x={x - 66} y={y + 102 + 10}>
      <pixiGraphics draw={drawBox} />
      {coffees > 0 && (
        <pixiContainer x={PLATE_W - 34} y={-14}>
          <pixiGraphics draw={drawCoffeeBadge} />
          <pixiText
            text={`x${coffees}`}
            x={13}
            y={1}
            resolution={2}
            style={{ ...small, fontWeight: "bold", fill: 0xffb347 }}
          />
        </pixiContainer>
      )}
      <pixiText
        text={n}
        x={7}
        y={4}
        resolution={2}
        style={{ ...small, fill: MUTED }}
      />
      <pixiText
        text={info ? info.title : "—"}
        x={7 + 2 * CHAR_W + 5}
        y={4}
        resolution={2}
        style={{ ...small, fill: info ? TEXT_COLOR : MUTED }}
      />
      {info ? (
        <>
          {alert ? (
            <BlinkingVoyant>
              <pixiGraphics draw={drawVoyant} x={7} y={17.5} />
              <pixiText
                text="!"
                x={7 + 6}
                y={17}
                anchor={{ x: 0.5, y: 0 }}
                resolution={2}
                style={{ ...small, fontWeight: "bold", fill: PLATE_BG }}
              />
            </BlinkingVoyant>
          ) : (
            <pixiGraphics draw={drawVoyant} x={7} y={18.5} />
          )}
          <pixiText
            text={modelShown}
            x={7 + voyantW + 5}
            y={17}
            resolution={2}
            style={{ ...small, fontWeight: "bold", fill: color }}
          />
          <pixiText
            text={info.tokens}
            x={PLATE_W - 7}
            y={17}
            anchor={{ x: 1, y: 0 }}
            resolution={2}
            style={{ ...small, fill: TEXT_COLOR }}
          />
        </>
      ) : (
        <pixiText
          text="LIBRE"
          x={7}
          y={17}
          resolution={2}
          style={{ ...small, fill: IDLE_COLOR, letterSpacing: 1 }}
        />
      )}
    </pixiContainer>
  );
}

export const DeskPlate = memo(DeskPlateComponent);

const HIT_ACCENT = 0xff5a3c;
const HIT_DARK = 0x161514;
const HIT_X = -74;
const HIT_Y = -34;
const HIT_W = 148;
const HIT_H = 168;

interface HitProps extends SeatProps {
  onOpen: (conv: ActiveConversation) => void;
}

/** Zone cliquable d'un poste occupé (maquette : `.hit`), contour + libellé au survol. */
function SeatHitComponent({ x, y, conv, onOpen }: HitProps): ReactNode {
  const [hover, setHover] = useState(false);
  const label = hitLabel(conv);
  const labelW = Math.round(label.length * 6.6 + 16);

  const drawHit = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(HIT_X, HIT_Y, HIT_W, HIT_H).fill({
        color: 0xffffff,
        alpha: 0.001,
      });
      if (hover) {
        g.rect(HIT_X, HIT_Y, HIT_W, HIT_H).stroke({
          width: 2,
          color: HIT_ACCENT,
          alignment: 0,
        });
      }
    },
    [hover],
  );
  const drawLabel = useCallback(
    (g: Graphics) => {
      g.clear();
      g.rect(-labelW / 2, 0, labelW, 18).fill(HIT_ACCENT);
    },
    [labelW],
  );

  return (
    <pixiContainer x={x} y={y} scale={DESK_SCALE}>
      <pixiGraphics
        draw={drawHit}
        eventMode="static"
        cursor="pointer"
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onPointerTap={() => onOpen(conv)}
      />
      {hover && (
        <pixiContainer x={0} y={HIT_Y - 22}>
          <pixiGraphics draw={drawLabel} />
          <pixiText
            text={label}
            anchor={{ x: 0.5, y: 0 }}
            x={0}
            y={3}
            resolution={2}
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: "bold",
              fill: HIT_DARK,
              lineHeight: 12,
            }}
          />
        </pixiContainer>
      )}
    </pixiContainer>
  );
}

export const SeatHit = memo(SeatHitComponent);

/** Index des conversations par numéro de poste (1-based). */
export function useConversationsBySlot(
  conversations: ActiveConversation[],
  deskBySession: Map<string, number>,
): Map<number, ActiveConversation> {
  return useMemo(() => {
    const m = new Map<number, ActiveConversation>();
    for (const c of conversations) {
      const n = deskBySession.get(c.sessionId);
      if (n !== undefined) m.set(n, c);
    }
    return m;
  }, [conversations, deskBySession]);
}

/** « Zzz » flottant au-dessus d'une conversation au repos assise à son poste. */
function SeatSleepComponent({ x, y }: { x: number; y: number }): ReactNode {
  const ref = useRef<Container | null>(null);
  const timeRef = useRef(0);
  useTick((ticker) => {
    timeRef.current = (timeRef.current + ticker.deltaMS) % 2400;
    const t = timeRef.current / 2400;
    if (ref.current) {
      ref.current.y = -t * 10;
      ref.current.alpha = t < 0.8 ? 1 : (1 - t) * 5;
    }
  });
  return (
    <pixiContainer x={x + 30 * DESK_SCALE} y={y - 6 * DESK_SCALE}>
      <pixiContainer ref={ref}>
        <pixiText
          text="Zzz"
          resolution={2}
          style={{
            fontFamily: MONO,
            fontSize: 12,
            fontWeight: "bold",
            fill: MUTED,
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

export const SeatSleep = memo(SeatSleepComponent);
