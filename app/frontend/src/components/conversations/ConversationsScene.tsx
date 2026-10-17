"use client";

import { Application, extend } from "@pixi/react";
import { Container, Text, Graphics, Sprite } from "pixi.js";
import {
  TransformComponent,
  TransformWrapper,
  useControls,
} from "react-zoom-pan-pinch";
import { ZoomControls } from "../game/ZoomControls";
import { agentNameForDesk, plateText } from "./conversationsLogic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Initial zoom 1.3, but never more than what keeps the whole scene visible:
 * the canvas is height-limited in a wide window (fullscreen), where 1.3x would
 * crop the top and bottom. Re-applied when the box is resized.
 */
function AutoFitScale({
  boxRef,
  canvasW,
  canvasH,
}: {
  boxRef: RefObject<HTMLDivElement | null>;
  canvasW: number;
  canvasH: number;
}): null {
  const { centerView } = useControls();
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const apply = (): void => {
      const cw = box.clientWidth;
      const ch = box.clientHeight;
      if (!cw || !ch) return;
      const shownH = Math.min(ch, (cw * canvasH) / canvasW);
      centerView(Math.max(1, Math.min(1.3, ch / shownH)), 0);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(box);
    return () => ro.disconnect();
  }, [boxRef, canvasW, canvasH, centerView]);
  return null;
}
import { useDeskCoffeeStore } from "@/stores/deskCoffeeStore";
import { useOfficeTextures } from "@/hooks/useOfficeTextures";
import { CANVAS_HEIGHT, BACKGROUND_COLOR } from "@/constants/canvas";
import {
  CAT_FOOD_STAND,
  CAT_WATER_STAND,
  DESKS_PER_ROW,
  CONV_DESK_ORIGIN_Y_START,
  CONV_DESK_SPACING_Y,
  DESK_SEAT_OFFSET_Y,
  CONV_DESK_COLS_X,
  getConvDeskOrigin,
} from "@/constants/positions";
import { PetWalkGrid, type PetBlock, type PetWalk } from "@/systems/petSite";
import { LoadingScreen } from "../game/LoadingScreen";
import { DeskSurfacesBase, DeskSurfacesTop } from "../game/DeskGrid";
import type { AgentAnimationState } from "@/stores/gameStore";
import { providerColor, type LedBadge } from "@/utils/providers";
import { identifyProvider } from "./wallLogic";
import type { ActiveConversation } from "@/types";
import { Elevator } from "../game/Elevator";
import { OfficeCats } from "../game/OfficeCats";
import { OfficeDog } from "../game/OfficeDog";
import { CoffeeCounter } from "../game/CoffeeCounter";
import { CatBowls, CatTree } from "../game/Decor";
import { WorkshopRooms } from "./WorkshopRooms";
import { ConversationsWall } from "./ConversationsWall";
import {
  COFFEE_SPOT,
  MAX_COFFEE_WAITERS,
  ROOMS_X,
  SCENE_H,
  VIEW_W,
} from "./CoffeeWaiters";
import { ConversationWalkers } from "./ConversationWalkers";
import { useCoffeeBreaks } from "./useCoffeeBreaks";
import { useElevatorTraffic } from "./useElevatorTraffic";
import {
  SeatAlert,
  SeatArms,
  SeatBody,
  SeatSleep,
  SeatHit,
  DESK_SCALE,
  seatState,
  useConversationsBySlot,
} from "./ConversationSeat";

extend({ Container, Text, Graphics, Sprite });

/** Exactement 8 postes : 4 colonnes x 2 rangées (comme la maquette). */
const TOTAL_DESKS = 8;
const ROWS = 2;

const COLS_X = CONV_DESK_COLS_X;
/** Décalage x des gamelles (sur leur tapis) et de leurs points d'arrêt (ancienne position + CAT_SHIFT_X). */
const CAT_SHIFT_X = -775;
/** Remontée des gamelles (et de leurs points d'arrêt) par rapport au bas de scène. */
const BOWL_DY = -60;
/** Arbre à chat réel (CatTree), juste à droite du canapé (un couloir libre de 1 case entre les deux). */
const TREE_X = 250;
const TREE_SCALE = 1.3;
const TREE_W = 76 * TREE_SCALE;
const TREE_H = 128 * TREE_SCALE;
/** Tapis au sol sous les deux gamelles, devant l'arbre (x, largeur ; y = bas de scène - 46, hauteur 38). */
const BOWL_RUG_X = 112;
const BOWL_RUG_W = 130;
/** Pied (bas de scène) commun des meubles du bas. */
const FRONT_FLOOR_MARGIN = 10;
/** Canapé d'angle gris foncé en L : dessiné en 140 x 104, affiché x 1,45 (203 x 151), bas à H - 138. */
const SOFA_X = 10;
const SOFA_W = 140;
const SOFA_H = 104;
const SOFA_S = 1.45;
const SOFA_DW = SOFA_W * SOFA_S;
const SOFA_DH = SOFA_H * SOFA_S;
const SOFA_BOTTOM = 138 + SOFA_DH; // décalage du haut du canapé depuis le bas de scène
/** Grand palmier en pot juste au-dessus-gauche du canapé (sans le chevaucher), largeur 88. */
const PALM_X = 0;
const PALM_W = 88;
const PALM_H = (PALM_W * 672) / 448;
const PALM_BOTTOM = SOFA_BOTTOM + PALM_H + 4; // haut du palmier ; bas = 4 px au-dessus du canapé
/** Plante en pot sous le canapé, en bas à gauche. */
const POT_X = 5;
const POT_W = 66;
const POT_TOP = 128; // haut de la plante depuis le bas de scène
/** Variantes locales (réduites) des bandes de couloir. */
const COFFEE_BLOCK_X1 = COFFEE_SPOT.x - 140;

const PAINT_COLOR = 0x646d6d;
const WALL_HEIGHT = 188;
const FLOOR_COLOR = 0x303536;
const FLOOR_JOINT = 0x272b2c;
const GROOVE_LIGHT = 0x3a4040;

/** Hauteur du mur de l'ancien bureau : l'ascenseur y est calé, on le remonte sur notre mur. */
const OLD_WALL_HEIGHT = 250;
/** Décor de l'ancien bureau, dans les bandes libres à gauche (x < 250) du canevas. */
function buildPetWalk(height: number): PetWalk {
  const deskBottom =
    CONV_DESK_ORIGIN_Y_START + (ROWS - 1) * CONV_DESK_SPACING_Y + 114;
  const sofaY = height - SOFA_BOTTOM;
  const palmY = height - PALM_BOTTOM;
  const potTop = height - POT_TOP;
  const potH = (POT_W * 622) / 470;
  const treeY = height - FRONT_FLOOR_MARGIN - TREE_H;
  const blocks: PetBlock[] = [
    // bloc des postes
    [
      COLS_X[0] - 80,
      CONV_DESK_ORIGIN_Y_START - 44,
      COLS_X[3] + 80,
      deskBottom,
    ],
    [SOFA_X - 2, sofaY, SOFA_X + SOFA_DW + 2, sofaY + SOFA_DH], // canapé d'angle
    [PALM_X, palmY, PALM_X + PALM_W, palmY + PALM_H], // palmier au-dessus du canapé
    [8, 194, 66, 272], // plante sous le mur, en haut à gauche
    [POT_X, potTop, POT_X + POT_W, potTop + potH], // plante en pot
    [0, 372, 140, 600], // coin café (plante, table ronde, tabourets)
    [TREE_X - 4, treeY - 4, TREE_X + TREE_W + 4, height],
    [COFFEE_BLOCK_X1, 190, ROOMS_X - 8, 262], // file d'attente du café (au pied du mur)
    // Pièces : animaux et agents n'y entrent jamais.
    [ROOMS_X, WALL_HEIGHT, VIEW_W, height],
  ];
  const down = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: p.x + CAT_SHIFT_X,
    y: p.y + height - CANVAS_HEIGHT + BOWL_DY,
  });
  return {
    grid: new PetWalkGrid(VIEW_W, height, 224, blocks),
    site: {
      sofaSpot: { x: SOFA_X + 93 * SOFA_S, y: sofaY + 50 * SOFA_S },
      sofaStand: { x: SOFA_X + 93 * SOFA_S, y: sofaY + SOFA_DH + 30 },
      waterStand: down(CAT_WATER_STAND),
      foodStand: down(CAT_FOOD_STAND),
      treeBase: { x: TREE_X + TREE_W + 24, y: height - 68 },
      sleepSpots: [
        { x: TREE_X + 18 * TREE_SCALE, y: treeY + 70 * TREE_SCALE },
        { x: TREE_X + 58 * TREE_SCALE, y: treeY + 104 * TREE_SCALE },
      ],
      playCenter: { x: 600, y: height - 120 },
    },
  };
}

const EMPTY_AGENTS = new Map<string, AgentAnimationState>();

export interface ConversationsSceneProps {
  /** Numéros de postes occupés (1-based). */
  occupied: Set<number>;
  /** Conversations actives (une par poste occupé). */
  conversations: ActiveConversation[];
  /** sessionId -> numéro de poste (1-based). */
  deskBySession: Map<string, number>;
  /** Ignoré : la scène a toujours 8 postes. */
  deskCount?: number;
  /** Ignoré : la scène a toujours 8 postes. */
  totalDesks?: number;
  /** Clic sur un poste occupé. */
  onOpen?: (conv: ActiveConversation) => void;
}

function rowLabel(row: number): string {
  const a = String(row * DESKS_PER_ROW + 1).padStart(2, "0");
  const b = String(row * DESKS_PER_ROW + DESKS_PER_ROW).padStart(2, "0");
  return `${a}–${b}`;
}

function PaintText({
  text,
  x,
  y,
  color,
}: {
  text: string;
  x: number;
  y: number;
  color: number;
}): ReactNode {
  return (
    <pixiText
      text={text}
      x={x}
      y={y}
      anchor={{ x: 1, y: 0 }}
      resolution={2}
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        fill: color,
        fontWeight: "bold",
        letterSpacing: 1,
        align: "right",
      }}
    />
  );
}

/**
 * Fond de l'ambiance A (maquette) : sol #303536 à dalles de 64 px (joints
 * 2 px #272B2C) et mur du fond de 188 px .
 */
function drawAmbience(g: Graphics, height: number): void {
  g.clear();
  const x0 = 0;
  const w = VIEW_W;
  g.rect(x0, WALL_HEIGHT, w, height - WALL_HEIGHT).fill(FLOOR_COLOR);
  for (let x = 62; x < w; x += 64) {
    g.rect(x, WALL_HEIGHT, 2, height - WALL_HEIGHT);
  }
  for (let y = 62; y < height; y += 64) {
    if (y + 2 > WALL_HEIGHT) g.rect(x0, y, w, 2);
  }
  g.fill(FLOOR_JOINT);
  // Mur : bandes du dégradé de la maquette, plinthe corail en bas.
  const bands: Array<[number, number, number]> = [
    [0, 128, 0x242a2b],
    [128, 132, 0x303637],
    [132, 172, 0x242a2b],
    [172, 184, 0x1d2223],
    [184, 188, 0xff5a3c],
  ];
  for (const [from, to, color] of bands) {
    g.rect(x0, from, w, to - from).fill(color);
  }
}

function drawRowFloor(g: Graphics, oy: number): void {
  g.clear();
  // Goulottes derrière la rangée, coupées à l'allée centrale (x≈526).
  for (const [gx, gw] of [
    [150, 366],
    [536, 354],
  ] as const) {
    g.rect(gx, oy - 30, gw, 6).fill(FLOOR_JOINT);
    g.rect(gx, oy - 30, gw, 2).fill(GROOVE_LIGHT);
    g.rect(gx, oy - 26, gw, 2).fill(GROOVE_LIGHT);
  }
  // Repère d'allée.
  g.rect(522, oy + 40, 8, 8).fill(FLOOR_JOINT);
  g.rect(524, oy + 42, 4, 4).fill(PAINT_COLOR);
}

/** Tapis foncé sous les gamelles posées au sol. */
function drawBowlRug(g: Graphics, height: number): void {
  g.clear();
  const y = height - 99;
  g.roundRect(BOWL_RUG_X, y, BOWL_RUG_W, 38, 8).fill(0x1f2425);
  g.roundRect(BOWL_RUG_X + 3, y + 3, BOWL_RUG_W - 6, 32, 6).stroke({
    width: 1,
    color: 0x4a5458,
  });
}

const LINE = { width: 2, color: 0x0c0c0f };

/** Coin café : table ronde en bois, 2 tasses (vapeur), 2 tabourets. */
function drawBreakZone(g: Graphics): void {
  g.clear();
  // Ombre au sol
  g.ellipse(46, 440, 34, 13).fill({ color: 0x000000, alpha: 0.28 });
  // Tabourets (pieds, assise, coussin)
  for (const sx of [20, 72]) {
    g.rect(sx - 8, 458, 3, 9).fill(0x4a2e18);
    g.rect(sx + 5, 458, 3, 9).fill(0x4a2e18);
    g.ellipse(sx, 456, 11, 6).fill(0x6b4426).stroke(LINE);
    g.ellipse(sx, 454, 8, 4).fill(0xc0552e);
  }
  // Pied central et plateau (tranche puis dessus)
  g.rect(43, 430, 6, 14).fill(0x4a2e18);
  g.ellipse(46, 428, 30, 22).fill(0x5a3a20).stroke(LINE);
  g.ellipse(46, 422, 30, 22).fill(0x8e6038).stroke(LINE);
  g.ellipse(46, 422, 24, 17).stroke({ width: 1, color: 0xa87444 });
  g.rect(30, 421, 14, 1).fill(0x7a4f2c);
  g.rect(50, 427, 12, 1).fill(0x7a4f2c);
  // Tasse 1 (blanche) et tasse 2 (orange), soucoupe + café + vapeur
  for (const [cx, cy, col] of [
    [36, 418, 0xf5f5f5],
    [58, 425, 0xe8892b],
  ] as const) {
    g.ellipse(cx, cy + 3, 8, 3).fill(0xdfe3e8);
    g.circle(cx, cy, 5).fill(col).stroke({ width: 1, color: 0x0c0c0f });
    g.ellipse(cx, cy - 1, 3.5, 2).fill(0x3a2314);
    g.rect(cx + 5, cy - 1, 3, 3).fill(col);
    g.rect(cx - 1, cy - 11, 1, 4).fill({ color: 0xffffff, alpha: 0.45 });
    g.rect(cx + 2, cy - 9, 1, 3).fill({ color: 0xffffff, alpha: 0.35 });
  }
}

/** Canapé d'angle gris foncé en L (dossier en haut, assise à gauche) + 2 coussins. 140 x 104. */
function drawGreySofa(g: Graphics): void {
  g.clear();
  const DARK = 0x3a4046;
  const MID = 0x4a5158;
  const LIGHT = 0x596068;
  // Dossier (haut) et bras / chaise longue (gauche)
  g.roundRect(0, 0, SOFA_W, 30, 6).fill(DARK).stroke(LINE);
  g.roundRect(0, 0, 46, SOFA_H, 6).fill(DARK).stroke(LINE);
  // Assises
  g.roundRect(46, 26, SOFA_W - 50, 50, 5).fill(MID).stroke(LINE);
  g.roundRect(6, 30, 34, SOFA_H - 36, 5).fill(MID).stroke(LINE);
  g.roundRect(48, 28, SOFA_W - 54, 8, 3).fill(LIGHT);
  g.moveTo(88, 38);
  g.lineTo(88, 74);
  g.moveTo(10, 66);
  g.lineTo(36, 66);
  g.stroke({ width: 1, color: 0x2c3136 });
  // Coussins : brun à droite, gris clair en haut à gauche
  g.roundRect(106, 8, 26, 20, 4).fill(0x7a5a42).stroke(LINE);
  g.roundRect(8, 6, 22, 16, 4).fill(0x6a7178).stroke(LINE);
}

/** Petit meuble sous la cafetière, collé au mur du fond. */
function drawCoffeeStand(g: Graphics): void {
  g.clear();
  const x = COFFEE_SPOT.x - 36;
  g.rect(x, 164, 72, 24).fill(0x3a4040).stroke(LINE);
  g.rect(x, 164, 72, 4).fill(0x646d6d);
  g.rect(x + 4, 172, 30, 14).stroke({ width: 1, color: 0x272b2c });
  g.rect(x + 38, 172, 30, 14).stroke({ width: 1, color: 0x272b2c });
}

function RowFloor({ oy }: { oy: number }): ReactNode {
  const draw = useCallback((g: Graphics) => drawRowFloor(g, oy), [oy]);
  return <pixiGraphics draw={draw} />;
}

export function ConversationsScene({
  occupied,
  conversations,
  deskBySession,
  onOpen,
}: ConversationsSceneProps): ReactNode {
  const { textures, loaded } = useOfficeTextures();

  const height = SCENE_H;
  const viewW = VIEW_W;
  const boxRef = useRef<HTMLDivElement | null>(null);

  const deskPositions = useMemo(
    () => Array.from({ length: TOTAL_DESKS }, (_, i) => getConvDeskOrigin(i + 1)),
    [],
  );

  const petWalk = useMemo(() => buildPetWalk(height), [height]);

  const rowIndexes = useMemo(() => Array.from({ length: ROWS }, (_, r) => r), []);

  const drawBackdrop = useCallback(
    (g: Graphics) => drawAmbience(g, height),
    [height],
  );
  const drawRug = useCallback(
    (g: Graphics) => drawBowlRug(g, height),
    [height],
  );
  const allBySlot = useConversationsBySlot(conversations, deskBySession);
  // Postes au-delà de 8 : ignorés (pas de place dans la scène).
  const bySlot = useMemo(() => {
    const m = new Map<number, ActiveConversation>();
    for (const [slot, conv] of allBySlot) if (slot <= TOTAL_DESKS) m.set(slot, conv);
    return m;
  }, [allBySlot]);
  // Desk banner: scrolling conversation title + "CLAUDE" (all goes through Claude).
  const { deskTasks, deskBadges } = useMemo(() => {
    const tasks = new Map<number, string>();
    const badges = new Map<number, LedBadge>();
    for (const [slot, conv] of bySlot) {
      tasks.set(slot, plateText(conv, 80).title);
      const openai = identifyProvider(conv.model ?? "") === "openai";
      badges.set(slot, {
        text: openai ? "OPENAI" : "CLAUDE",
        color: providerColor(openai ? "openai" : "anthropic"),
      });
    }
    return { deskTasks: tasks, deskBadges: badges };
  }, [bySlot]);

  // Café à pied après 5 min d'attente (4 au plus) ; ascenseur pour les arrivées / départs.
  const { walkers: traffic, doorOpen } = useElevatorTraffic(bySlot);
  const arriving = useMemo(
    () =>
      new Set(
        traffic.filter((w) => w.kind === "arrive").map((w) => w.sessionId),
      ),
    [traffic],
  );
  const trips = useCoffeeBreaks(bySlot, MAX_COFFEE_WAITERS, arriving);
  const modelBySession = useMemo(() => {
    const m: Record<string, string | null | undefined> = {};
    for (const conv of bySlot.values()) m[conv.sessionId] = conv.model;
    return m;
  }, [bySlot]);
  // Postes dont le personnage est absent (en route ou au café).
  const atCoffee = useMemo(() => {
    const s = new Set<number>(trips.map((t) => t.slot));
    for (const w of traffic) if (w.kind === "arrive") s.add(w.slot);
    return s;
  }, [trips, traffic]);

  return (
    <div
      ref={boxRef}
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#0e0d0c" }}
    >
      <TransformWrapper
        initialScale={1.3}
        minScale={1}
        maxScale={4}
        centerOnInit={true}
        centerZoomedOut={true}
        limitToBounds={true}
        wheel={{ step: 0.1 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
      >
        <ZoomControls />
        <AutoFitScale boxRef={boxRef} canvasW={viewW} canvasH={height} />
        <TransformComponent
          wrapperClass="w-full h-full"
          contentClass="w-full h-full flex items-center justify-center [&_canvas]:!w-auto [&_canvas]:!h-auto [&_canvas]:!max-w-full [&_canvas]:!max-h-full [&_canvas]:block"
        >
          <Application
            key={`app-${viewW}`}
            width={viewW}
            height={height}
            backgroundColor={BACKGROUND_COLOR}
            autoDensity={true}
            resolution={
              typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
            }
          >
            {!loaded && <LoadingScreen />}
            {loaded && (
              <pixiContainer x={0}>
                <pixiGraphics draw={drawBackdrop} />
                <ConversationsWall
                  conversations={conversations}
                  totalDesks={TOTAL_DESKS}
                  rightShift={VIEW_W - 1280}
                />

                {/* Sol : goulottes, repères, pointillés des rangées vides. */}
                {rowIndexes.map((r) => {
                  const oy = CONV_DESK_ORIGIN_Y_START + r * CONV_DESK_SPACING_Y;
                  return (
                    <pixiContainer key={`row-${r}`}>
                      <RowFloor oy={oy} />
                      <PaintText
                        text={rowLabel(r)}
                        x={ROOMS_X - 24}
                        y={oy + 58}
                        color={PAINT_COLOR}
                      />
                    </pixiContainer>
                  );
                })}

                {/* Canapé d'angle gris seul (variante locale), puis le palmier à son coin haut-gauche. */}
                <pixiContainer x={SOFA_X} y={height - SOFA_BOTTOM} scale={SOFA_S}>
                  <pixiGraphics draw={drawGreySofa} />
                </pixiContainer>
                {textures.palm && (
                  <pixiSprite
                    texture={textures.palm}
                    anchor={{ x: 0, y: 0 }}
                    x={PALM_X}
                    y={height - PALM_BOTTOM}
                    width={PALM_W}
                    height={PALM_H}
                  />
                )}
                {/* Coin gauche : plante du haut (mur), plante du coin café, plante en pot sous le canapé. */}
                {textures.plant &&
                  (
                    [
                      [100, 150, 44],
                      [10, 196, 56],
                      [6, 372, 56],
                      [POT_X, height - POT_TOP, POT_W],
                    ] as const
                  ).map(([px, py, pw]) => (
                    <pixiSprite
                      key={`cplant-${px}-${py}`}
                      texture={textures.plant!}
                      anchor={{ x: 0, y: 0 }}
                      x={px}
                      y={py}
                      width={pw}
                      height={(pw * textures.plant!.height) / textures.plant!.width}
                    />
                  ))}
                <pixiContainer x={-9} y={-156} scale={1.6}>
                  <pixiGraphics draw={drawBreakZone} />
                </pixiContainer>

                {/* Décor de l'ancien bureau (mêmes composants), sans fenêtre. */}
                <pixiContainer x={-10} y={WALL_HEIGHT - OLD_WALL_HEIGHT}>
                  <Elevator
                    isOpen={doorOpen}
                    agents={EMPTY_AGENTS}
                    frameTexture={textures.elevatorFrame}
                    doorTexture={textures.elevatorDoor}
                    headsetTexture={textures.headset}
                    sunglassesTexture={textures.sunglasses}
                  />
                </pixiContainer>
                <pixiGraphics draw={drawCoffeeStand} />
                {textures.coffeeMachine && (
                  <pixiSprite
                    texture={textures.coffeeMachine}
                    anchor={0.5}
                    x={COFFEE_SPOT.x}
                    y={COFFEE_SPOT.y}
                    scale={0.1}
                  />
                )}
                <pixiContainer x={COFFEE_SPOT.x} y={COFFEE_SPOT.y - 50}>
                  <CoffeeCounter store={useDeskCoffeeStore} />
                </pixiContainer>
                <pixiContainer
                  x={TREE_X}
                  y={height - FRONT_FLOOR_MARGIN - TREE_H}
                  scale={TREE_SCALE}
                >
                  <CatTree />
                </pixiContainer>
                <pixiGraphics draw={drawRug} />
                <pixiContainer x={CAT_SHIFT_X} y={height - CANVAS_HEIGHT + BOWL_DY}>
                  <CatBowls />
                </pixiContainer>
                {/* Colonne des 3 pièces d'atelier, collée au bord droit de la scène. */}
                <WorkshopRooms
                  x={ROOMS_X}
                  y={WALL_HEIGHT}
                  height={height - WALL_HEIGHT}
                />

                {/* Chaises, triées en Y (même logique que OfficeGame). */}
                <pixiContainer sortableChildren={true}>
                  <OfficeDog walk={petWalk} />
                  <OfficeCats walk={petWalk} />
                  <ConversationWalkers
                    trips={trips}
                    traffic={traffic}
                    models={modelBySession}
                  />
                  {deskPositions.map((desk, i) => (
                    <pixiContainer
                      key={`chair-${i}`}
                      x={desk.x}
                      y={desk.y}
                      zIndex={desk.y + 20}
                      scale={DESK_SCALE}
                    >
                      {textures.chair && (
                        <pixiSprite
                          texture={textures.chair}
                          anchor={0.5}
                          x={0}
                          y={30}
                          scale={0.1386}
                        />
                      )}
                    </pixiContainer>
                  ))}
                  {/* Claude assis, devant la chaise (y du siège = poste + 24). */}
                  {deskPositions.map((desk, i) => {
                    const conv = bySlot.get(i + 1);
                    return conv && !atCoffee.has(i + 1) ? (
                      <pixiContainer
                        key={`seat-${i}`}
                        zIndex={desk.y + DESK_SEAT_OFFSET_Y}
                      >
                        <SeatBody
                          x={desk.x}
                          y={desk.y}
                          conv={conv}
                          name={agentNameForDesk(i)}
                        />
                      </pixiContainer>
                    ) : null;
                  })}
                </pixiContainer>

                <DeskSurfacesBase
                  deskCount={TOTAL_DESKS}
                  occupiedDesks={occupied}
                  deskTexture={textures.desk}
                  keyboardTexture={textures.keyboard}
                  deskScale={DESK_SCALE}
                  originFn={getConvDeskOrigin}
                />

                {/* Mains : après le bureau et le clavier. */}
                {deskPositions.map((desk, i) => {
                  const conv = bySlot.get(i + 1);
                  return conv && !atCoffee.has(i + 1) ? (
                    <SeatArms
                      key={`arms-${i}`}
                      x={desk.x}
                      y={desk.y}
                      conv={conv}
                    />
                  ) : null;
                })}

                <DeskSurfacesTop
                  deskCount={TOTAL_DESKS}
                  occupiedDesks={occupied}
                  deskTasks={deskTasks}
                  deskBadges={deskBadges}
                  monitorTexture={textures.monitor}
                  coffeeMugTexture={textures.coffeeMug}
                  thermosTexture={textures.thermos}
                  deskScale={DESK_SCALE}
                  originFn={getConvDeskOrigin}
                />

                {/* Au repos mais assises (café plein) : elles dorment. */}
                {deskPositions.map((desk, i) => {
                  const conv = bySlot.get(i + 1);
                  return conv &&
                    seatState(conv) === "idle" &&
                    !atCoffee.has(i + 1) ? (
                    <SeatSleep key={`zzz-${i}`} x={desk.x} y={desk.y} />
                  ) : null;
                })}

                {/* Alertes « a besoin de toi » au-dessus de tout. */}
                {deskPositions.map((desk, i) => {
                  const conv = bySlot.get(i + 1);
                  return conv && seatState(conv) === "needs_you" ? (
                    <SeatAlert
                      key={`alert-${i}`}
                      x={desk.x}
                      y={desk.y}
                      conv={conv}
                    />
                  ) : null;
                })}

                {/* Zones cliquables (postes occupés seulement), tout au-dessus. */}
                {onOpen &&
                  deskPositions.map((desk, i) => {
                    const conv = bySlot.get(i + 1);
                    return conv ? (
                      <SeatHit
                        key={`hit-${i}`}
                        x={desk.x}
                        y={desk.y}
                        conv={conv}
                        onOpen={onOpen}
                      />
                    ) : null;
                  })}
              </pixiContainer>
            )}
          </Application>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
