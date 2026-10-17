/**
 * OfficeGame - Main Game Canvas
 *
 * Main visualization component using:
 * - Centralized Zustand store
 * - XState state machines
 * - Single animation tick loop
 *
 * The component is purely for rendering - all state logic is in the store/machines.
 */

"use client";

import { Application, extend } from "@pixi/react";
import {
  Container,
  Text,
  Graphics,
  Sprite,
  Application as PixiApplication,
} from "pixi.js";
import { useMemo, useEffect, useRef, useCallback, type ReactNode } from "react";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { useShallow } from "zustand/react/shallow";
import { performSoftReset, getHmrVersion } from "@/systems/hmrCleanup";

import {
  useGameStore,
  selectAgents,
  selectBoss,
  selectTodos,
  selectDebugMode,
  selectShowPaths,
  selectShowQueueSlots,
  selectShowPhaseLabels,
  selectShowObstacles,
  selectElevatorState,
  selectContextUtilization,
  selectIsCompacting,
} from "@/stores/gameStore";
import { useAnimationSystem } from "@/systems/animationSystem";
import { wireGameRuntime, unwireGameRuntime } from "@/systems/gameRuntime";
import { useCompactionAnimation } from "@/systems/compactionAnimation";
import { useOfficeTextures } from "@/hooks/useOfficeTextures";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BACKGROUND_COLOR,
} from "@/constants/canvas";
import {
  EMPLOYEE_OF_MONTH_POSITION,
  CITY_WINDOW_POSITION,
  WALL_CLOCK_POSITION,
  WALL_OUTLET_POSITION,
  WHITEBOARD_POSITION,
  WATER_COOLER_POSITION,
  COFFEE_MACHINE_POSITION,
  PRINT_LAB_POSITION,
  LOUNGE_POSITION,
  FILAMENT_RACK_POSITIONS,
  ARCADE_POSITION,
  CAT_TREE_POSITION,
  CAT_TREE_SCALE,
  PLANT_POSITIONS,
  TRASH_CAN_OFFSET,
  DESKS_PER_ROW,
  MIN_DESK_COUNT,
} from "@/constants/positions";
import {
  AgentSprite,
  AgentArms,
  AgentHeadset,
  AgentLabel,
  Bubble as AgentBubble,
} from "./AgentSprite";
import {
  BossSprite,
  BossBubble,
  BossAttentionBadge,
  MobileBoss,
} from "./BossSprite";
import { NightTint } from "./NightTint";
import { OfficeCats } from "./OfficeCats";
import { OfficeDog } from "./OfficeDog";
import { CoffeeCounter } from "./CoffeeCounter";
import { ContextSiren } from "./ContextSiren";
import { agentMachineService } from "@/machines/agentMachineService";
import { OutingPlanner, PLANNER_TICK_MS } from "@/systems/outingPlanner";
import { useNavigationStore } from "@/stores/navigationStore";
import { LOBBY_FLOOR_ID } from "@/types/navigation";
import { ELEVATOR_POSITION, isInElevatorZone } from "@/systems/queuePositions";
import { TrashCanSprite } from "./TrashCanSprite";
import { WallClock } from "./WallClock";
import { Whiteboard } from "./Whiteboard";
import { CityWindow } from "./CityWindow";
import { EmployeeOfTheMonth } from "./EmployeeOfTheMonth";
import { Elevator, isAgentInElevator } from "./Elevator";
import { PrintFarm, type PrintJob } from "./PrintFarm";
import {
  ArcadeCabinet,
  CatBowls,
  CatTree,
  FilamentRack,
  Lounge,
} from "./Decor";
import { DebugOverlays } from "./DebugOverlays";
import {
  DeskSurfacesBase,
  DeskSurfacesTop,
  useDeskPositions,
} from "./DeskGrid";
import { ZoomControls } from "./ZoomControls";
import { LoadingScreen } from "./LoadingScreen";
import { OfficeBackground } from "./OfficeBackground";
import { formatModelLabel } from "@/utils/modelLabel";
import { providerColor, providerStyle, type LedBadge } from "@/utils/providers";
import { getAgentLook } from "@/constants/agentLooks";

// Register PixiJS components
extend({ Container, Text, Graphics, Sprite });

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface SubagentDotProps {
  x: number;
  y: number;
  color: string;
}

const PRINT_LAB_JOBS: PrintJob[] = [
  { color: 0x43c35b, shape: "gear", durationMs: 38000, startMs: 4000 },
  { color: 0xffd23f, shape: "benchy", durationMs: 46000, startMs: 20000 },
  { color: 0xb06bff, shape: "tower", durationMs: 40000, startMs: 31000 },
  { color: 0xf3f1ec, shape: "cube", durationMs: 30000, startMs: 12000 },
];

function SubagentDot({ x, y, color }: SubagentDotProps): ReactNode {
  const drawDot = useCallback(
    (g: Graphics) => {
      g.clear();
      g.circle(0, 0, 4);
      // Safe hex parsing with fallback
      const hex = /^#[0-9a-fA-F]{6}$/.test(color)
        ? parseInt(color.slice(1), 16)
        : 0xf59e0b;
      g.fill({ color: hex });
      g.circle(0, 0, 4);
      g.stroke({ color: 0xffffff, alpha: 0.4, width: 1 });
    },
    [color],
  );

  return <pixiGraphics draw={drawDot} x={x} y={y} />;
}

function FloorSign({
  label,
  accent,
}: {
  label: string;
  accent: string;
}): ReactNode {
  const w = 120;
  const h = 24;
  const drawSign = useCallback(
    (g: Graphics) => {
      g.clear();
      // Backing plate
      g.roundRect(-w / 2, -h / 2, w, h, 4);
      g.fill({ color: 0x1e1e1e, alpha: 0.9 });
      // Border
      g.roundRect(-w / 2, -h / 2, w, h, 4);
      const hex = /^#[0-9a-fA-F]{6}$/.test(accent)
        ? parseInt(accent.slice(1), 16)
        : 0x6366f1;
      g.stroke({ color: hex, width: 1.5, alpha: 0.7 });
    },
    [accent],
  );

  return (
    <pixiContainer x={ELEVATOR_POSITION.x} y={ELEVATOR_POSITION.y - 88}>
      <pixiGraphics draw={drawSign} />
      <pixiContainer scale={0.5}>
        <pixiText
          text={label}
          anchor={0.5}
          resolution={2}
          style={{
            fontSize: 18,
            fill: "#ffffff",
            fontFamily: "monospace",
            fontWeight: "bold",
          }}
        />
      </pixiContainer>
    </pixiContainer>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function OfficeGame(): ReactNode {
  // Track PixiJS app for cleanup
  const appRef = useRef<PixiApplication | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // HMR version for forcing remount
  const hmrVersion = getHmrVersion();

  // Load all office textures
  const { textures, loaded: spritesLoaded } = useOfficeTextures();

  // Start animation system
  useAnimationSystem();

  // Wire the animation tick's listener to the agent-machine service (ARC-017).
  // Lives here rather than in useAnimationSystem so animationSystem never
  // imports agentMachineService at runtime (breaks the machines↔systems cycle).
  useEffect(() => {
    wireGameRuntime();
    return () => unwireGameRuntime();
  }, []);

  // Sorties des agents : café après 5 min d'attente, pauses aléatoires.
  useEffect(() => {
    const planner = new OutingPlanner();
    const id = setInterval(() => {
      const now = Date.now();
      const planned = Array.from(useGameStore.getState().agents.values()).map(
        (a) => ({
          id: a.id,
          name: a.name ?? null,
          phase: a.phase,
          backendState: a.backendState,
        }),
      );
      const plan = planner.tick(now, planned, Math.random);
      for (const agentId of plan.coffee) {
        if (agentMachineService.sendOuting(agentId, "coffee"))
          planner.markOuting(agentId, now);
      }
      for (const agentId of plan.breaks) {
        if (agentMachineService.sendOuting(agentId, "break"))
          planner.markOuting(agentId, now);
      }
    }, PLANNER_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Cleanup on unmount (HMR or navigation)
  useEffect(() => {
    return () => {
      // @pixi/react Application handles Pixi app destruction.
      // Only reset game systems to avoid double-destroy of the WebGL context.
      appRef.current = null;
      performSoftReset();
    };
  }, []);

  // Subscribe to store state
  const agents = useGameStore(useShallow(selectAgents));
  const boss = useGameStore(selectBoss);
  const todos = useGameStore(selectTodos);
  const debugMode = useGameStore(selectDebugMode);
  const showPaths = useGameStore(selectShowPaths);
  const showQueueSlots = useGameStore(selectShowQueueSlots);
  const showPhaseLabels = useGameStore(selectShowPhaseLabels);
  const showObstacles = useGameStore(selectShowObstacles);
  const elevatorState = useGameStore(selectElevatorState);
  const contextUtilization = useGameStore(selectContextUtilization);
  const isCompacting = useGameStore(selectIsCompacting);

  // Floor info for elevator label
  const floorId = useNavigationStore((s) => s.floorId);
  const buildingConfig = useNavigationStore((s) => s.buildingConfig);
  const floor = useMemo(() => {
    if (floorId === LOBBY_FLOOR_ID) {
      return { name: "Lobby", icon: "\u{1F6AA}", accent: "#94a3b8" };
    }
    return buildingConfig?.floors.find((f) => f.id === floorId) ?? null;
  }, [floorId, buildingConfig]);

  // Compaction animation state
  const compactionAnimation = useCompactionAnimation();

  // Use store's elevator state (controlled by state machine)
  const isElevatorOpen = elevatorState === "open";

  // Calculate occupied desks
  const occupiedDesks = useMemo(() => {
    const desks = new Set<number>();
    for (const agent of agents.values()) {
      if (agent.desk && agent.phase === "idle") {
        desks.add(agent.desk);
      }
    }
    return desks;
  }, [agents]);

  // Calculate desk tasks for marquee display
  const deskTasks = useMemo(() => {
    const tasks = new Map<number, string>();
    for (const agent of agents.values()) {
      if (agent.desk && agent.phase === "idle") {
        const label = agent.currentTask || agent.name || "";
        if (label) tasks.set(agent.desk, label);
      }
    }
    return tasks;
  }, [agents]);

  // LED badge per occupied desk: only who serves the model ("CLAUDE" / "OPENAI");
  // the agent type is already written above the character's head.
  const providerBadge = (provider: string | null | undefined): LedBadge => ({
    text: (providerStyle(provider).name ?? "Claude").toUpperCase(),
    color: providerColor(provider),
  });
  const deskBadges = useMemo(() => {
    const badges = new Map<number, LedBadge>();
    for (const agent of agents.values()) {
      if (agent.desk && agent.phase === "idle") {
        badges.set(agent.desk, providerBadge(agent.provider));
      }
    }
    return badges;
  }, [agents]);

  // Boss LED strip: same format
  const bossBadge = useMemo(() => providerBadge(boss.provider), [boss.provider]);

  // Desk count
  const deskCount = useMemo(() => {
    return Math.max(
      MIN_DESK_COUNT,
      Math.min(
        MIN_DESK_COUNT,
        Math.ceil(agents.size / DESKS_PER_ROW) * DESKS_PER_ROW,
      ),
    );
  }, [agents.size]);

  // Desk positions for Y-sorted rendering
  const deskPositions = useDeskPositions(deskCount, occupiedDesks);

  // Keyboard shortcuts for debug
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector("[role='dialog'][aria-modal='true']")) return;
      if (e.key === "d" || e.key === "D") {
        useGameStore.getState().setDebugMode(!debugMode);
      }
      if (debugMode) {
        if (e.key === "p" || e.key === "P") {
          useGameStore.getState().toggleDebugOverlay("paths");
        }
        if (e.key === "q" || e.key === "Q") {
          useGameStore.getState().toggleDebugOverlay("queueSlots");
        }
        if (e.key === "l" || e.key === "L") {
          useGameStore.getState().toggleDebugOverlay("phaseLabels");
        }
        if (e.key === "o" || e.key === "O") {
          useGameStore.getState().toggleDebugOverlay("obstacles");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debugMode]);

  // Reset pan/zoom only on actual window resize — NOT on container reflows.
  // ResizeObserver was causing progressive canvas drift because the event log
  // and sidebar content changes triggered micro-resizes on every update.
  useEffect(() => {
    const handleResize = () => transformRef.current?.resetTransform(0);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden relative">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={1}
        maxScale={3}
        centerZoomedOut={false}
        limitToBounds={false}
        wheel={{ step: 0.1 }}
        pinch={{ step: 5 }}
        doubleClick={{ disabled: true }}
        onTransform={(ref, state) => {
          // Auto-reset pan offset when zooming back out to 1:1
          if (
            state.scale <= 1 &&
            (state.positionX !== 0 || state.positionY !== 0)
          ) {
            ref.resetTransform(0);
          }
        }}
      >
        <ZoomControls />
        <TransformComponent
          wrapperClass="w-full h-full"
          contentClass="w-full h-full"
        >
          <div className="pixi-canvas-container w-full h-full">
            <Application
              key={`pixi-app-${hmrVersion}`}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              backgroundColor={BACKGROUND_COLOR}
              autoDensity={true}
              resolution={
                typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1
              }
              onInit={(app) => {
                appRef.current = app;
              }}
            >
              {/* Loading screen - shown while sprites are loading */}
              {!spritesLoaded && <LoadingScreen />}

              {/* Office content - hidden while loading */}
              {spritesLoaded && (
                <>
                  {/* Floor and walls */}
                  <OfficeBackground floorTileTexture={textures.floorTile} />

                  {/* Wall decorations */}
                  <pixiContainer
                    x={EMPLOYEE_OF_MONTH_POSITION.x}
                    y={EMPLOYEE_OF_MONTH_POSITION.y}
                  >
                    <EmployeeOfTheMonth />
                  </pixiContainer>
                  <pixiContainer
                    x={CITY_WINDOW_POSITION.x}
                    y={CITY_WINDOW_POSITION.y}
                  >
                    <CityWindow />
                  </pixiContainer>
                  <pixiContainer
                    x={WALL_CLOCK_POSITION.x}
                    y={WALL_CLOCK_POSITION.y}
                  >
                    <WallClock />
                  </pixiContainer>
                  {/* Wall outlet below clock */}
                  {textures.wallOutlet && (
                    <pixiSprite
                      texture={textures.wallOutlet}
                      anchor={0.5}
                      x={WALL_OUTLET_POSITION.x}
                      y={WALL_OUTLET_POSITION.y}
                      scale={0.04}
                    />
                  )}
                  <pixiContainer
                    x={WHITEBOARD_POSITION.x}
                    y={WHITEBOARD_POSITION.y}
                  >
                    <Whiteboard todos={todos} />
                  </pixiContainer>
                  {textures.waterCooler && (
                    <pixiSprite
                      texture={textures.waterCooler}
                      anchor={0.5}
                      x={WATER_COOLER_POSITION.x}
                      y={WATER_COOLER_POSITION.y}
                      scale={0.198}
                    />
                  )}
                  {/* Coffee machine - to the right of water cooler */}
                  {textures.coffeeMachine && (
                    <pixiSprite
                      texture={textures.coffeeMachine}
                      anchor={0.5}
                      x={COFFEE_MACHINE_POSITION.x}
                      y={COFFEE_MACHINE_POSITION.y}
                      scale={0.1}
                    />
                  )}
                  {/* Coffee counter above the machine */}
                  <pixiContainer
                    x={COFFEE_MACHINE_POSITION.x}
                    y={COFFEE_MACHINE_POSITION.y - 50}
                  >
                    <CoffeeCounter />
                  </pixiContainer>
                  {/* Context siren, just above the coffee counter */}
                  <pixiContainer x={COFFEE_MACHINE_POSITION.x - 20} y={40}>
                    <ContextSiren />
                  </pixiContainer>

                  {/* Print lab, lounge, filament rack, arcade and plants (row 3 + side strips) */}
                  <pixiContainer
                    x={PRINT_LAB_POSITION.x}
                    y={PRINT_LAB_POSITION.y}
                  >
                    <PrintFarm jobs={PRINT_LAB_JOBS} />
                  </pixiContainer>
                  <pixiContainer x={LOUNGE_POSITION.x} y={LOUNGE_POSITION.y}>
                    <Lounge />
                  </pixiContainer>
                  {FILAMENT_RACK_POSITIONS.map((p, i) => (
                    <pixiContainer
                      key={`rack-${i}`}
                      x={p.x}
                      y={p.y}
                      scale={0.85}
                    >
                      <FilamentRack />
                    </pixiContainer>
                  ))}
                  <pixiContainer
                    x={CAT_TREE_POSITION.x}
                    y={CAT_TREE_POSITION.y}
                    scale={CAT_TREE_SCALE}
                  >
                    <CatTree />
                  </pixiContainer>
                  <CatBowls />
                  <pixiContainer x={ARCADE_POSITION.x} y={ARCADE_POSITION.y}>
                    <ArcadeCabinet />
                  </pixiContainer>
                  {textures.palm &&
                    PLANT_POSITIONS.map((p, i) => (
                      <pixiSprite
                        key={`plant-${i}`}
                        texture={textures.palm!}
                        anchor={{ x: 0.5, y: 1 }}
                        x={p.x}
                        y={p.y}
                        scale={0.17}
                      />
                    ))}

                  {/* Elevator with animated doors and agents inside */}
                  <Elevator
                    isOpen={isElevatorOpen}
                    agents={agents}
                    frameTexture={textures.elevatorFrame}
                    doorTexture={textures.elevatorDoor}
                    headsetTexture={textures.headset}
                    sunglassesTexture={textures.sunglasses}
                  />

                  {/* Floor sign above elevator */}
                  {floor && (
                    <FloorSign
                      label={`${floor.icon} ${floor.name}`}
                      accent={floor.accent}
                    />
                  )}

                  {/* Y-sorted layer: chairs and agents sorted by Y position (higher Y = in front) */}
                  <pixiContainer sortableChildren={true}>
                    {/* Rex the office dog - zIndex = feet Y (set in its tick) */}
                    <OfficeDog />

                    {/* The two office cats (black and orange) */}
                    <OfficeCats />

                    {/* Desk chairs - zIndex based on chair seat back */}
                    {deskPositions.map((desk, i) => {
                      const chairZIndex = desk.y + 20;
                      return (
                        <pixiContainer
                          key={`chair-${i}`}
                          x={desk.x}
                          y={desk.y}
                          zIndex={chairZIndex}
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
                      );
                    })}

                    {/* Agents outside elevator - zIndex based on feet Y position */}
                    {Array.from(agents.values())
                      .filter(
                        (agent) =>
                          !isAgentInElevator(
                            agent.currentPosition.x,
                            agent.currentPosition.y,
                          ),
                      )
                      .map((agent) => (
                        <pixiContainer
                          key={agent.id}
                          zIndex={agent.currentPosition.y}
                        >
                          <AgentSprite
                            id={agent.id}
                            name={agent.name}
                            color={agent.color}
                            number={agent.number}
                            position={agent.currentPosition}
                            phase={agent.phase}
                            bubble={agent.bubble.content}
                            headsetTexture={textures.headset}
                            sunglassesTexture={textures.sunglasses}
                            renderBubble={false}
                            renderLabel={false}
                            isTyping={agent.isTyping}
                            provider={agent.provider}
                          />
                        </pixiContainer>
                      ))}
                  </pixiContainer>

                  {/* Desk surfaces and keyboards (behind agent arms) */}
                  <DeskSurfacesBase
                    deskCount={deskCount}
                    occupiedDesks={occupiedDesks}
                    deskTexture={textures.desk}
                    keyboardTexture={textures.keyboard}
                  />

                  {/* Agent arms - rendered after desk/keyboard, before headsets */}
                  {Array.from(agents.values())
                    .filter((agent) => agent.phase === "idle")
                    .map((agent) => (
                      <AgentArms
                        key={`arms-${agent.id}`}
                        position={agent.currentPosition}
                        isTyping={agent.isTyping}
                      />
                    ))}

                  {/* Agent headsets - rendered after arms so they appear on top */}
                  {textures.headset &&
                    Array.from(agents.values())
                      .filter(
                        (agent) =>
                          agent.phase === "idle" &&
                          (getAgentLook(agent.name, agent.color).pixel
                            ?.headset ??
                            true),
                      )
                      .map((agent) => (
                        <AgentHeadset
                          key={`headset-${agent.id}`}
                          position={agent.currentPosition}
                          headsetTexture={textures.headset!}
                        />
                      ))}

                  {/* Monitors and decorations (in front of agent arms) */}
                  <DeskSurfacesTop
                    deskCount={deskCount}
                    occupiedDesks={occupiedDesks}
                    deskTasks={deskTasks}
                    deskBadges={deskBadges}
                    monitorTexture={textures.monitor}
                    coffeeMugTexture={textures.coffeeMug}
                    thermosTexture={textures.thermos}
                  />

                  {/* Boss */}
                  <BossSprite
                    position={boss.position}
                    state={boss.backendState}
                    bubble={boss.bubble.content}
                    inUseBy={boss.inUseBy}
                    currentTask={boss.currentTask}
                    chairTexture={textures.chair}
                    deskTexture={textures.desk}
                    keyboardTexture={textures.keyboard}
                    monitorTexture={textures.monitor}
                    phoneTexture={textures.phone}
                    headsetTexture={textures.headset}
                    sunglassesTexture={textures.sunglasses}
                    renderBubble={false}
                    isTyping={boss.isTyping}
                    isAway={compactionAnimation.phase !== "idle"}
                    ledBadge={bossBadge}
                  />

                  {/* Mobile Boss (when walking to/from trash can) */}
                  {compactionAnimation.bossPosition && (
                    <MobileBoss
                      position={compactionAnimation.bossPosition}
                      jumpOffset={compactionAnimation.jumpOffset}
                      scale={compactionAnimation.bossScale}
                      sunglassesTexture={textures.sunglasses}
                      headsetTexture={textures.headset}
                    />
                  )}

                  {/* Trash Can (Context Utilization Indicator) - right of boss desk */}
                  <TrashCanSprite
                    x={boss.position.x + TRASH_CAN_OFFSET.x}
                    y={boss.position.y + TRASH_CAN_OFFSET.y}
                    contextUtilization={
                      compactionAnimation.phase !== "idle"
                        ? compactionAnimation.animatedContextUtilization
                        : contextUtilization
                    }
                    isCompacting={isCompacting}
                    isStomping={compactionAnimation.isStomping}
                  />

                  {/* Debug overlays */}
                  {debugMode && (
                    <DebugOverlays
                      showPaths={showPaths}
                      showQueueSlots={showQueueSlots}
                      showPhaseLabels={showPhaseLabels}
                      showObstacles={showObstacles}
                    />
                  )}

                  {/* Debug mode indicator */}
                  {debugMode && (
                    <pixiText
                      text="DEBUG MODE (D=toggle, P=paths, Q=queue, L=labels, O=obstacles, T=time)"
                      x={10}
                      y={10}
                      style={{
                        fontSize: 12,
                        fill: 0x00ff00,
                        fontFamily: "monospace",
                      }}
                    />
                  )}

                  {/* Labels Layer - rendered on top of most things */}
                  {Array.from(agents.values())
                    .filter(
                      (agent) =>
                        agent.name && !isInElevatorZone(agent.currentPosition),
                    )
                    .map((agent) => (
                      <AgentLabel
                        key={`label-${agent.id}`}
                        name={agent.name!}
                        modelLabel={formatModelLabel(agent.model)}
                        position={agent.currentPosition}
                      />
                    ))}

                  {/* Character Type Overlays - crown/badge/dot per agent type */}
                  {Array.from(agents.values())
                    .filter(
                      (agent) =>
                        agent.characterType &&
                        !isInElevatorZone(agent.currentPosition),
                    )
                    .map((agent) => (
                      <pixiContainer
                        key={`chartype-${agent.id}`}
                        zIndex={agent.currentPosition.y + 20}
                      >
                        {/* Lead crown overlay */}
                        {agent.characterType === "lead" && (
                          <pixiText
                            text="👑"
                            style={{ fontSize: 14 }}
                            x={agent.currentPosition.x - 8}
                            y={agent.currentPosition.y - 52}
                          />
                        )}

                        {/* Teammate badge + nameplate overlay */}
                        {agent.characterType === "teammate" && (
                          <>
                            <pixiText
                              text="🎖️"
                              style={{ fontSize: 10 }}
                              x={agent.currentPosition.x - 6}
                              y={agent.currentPosition.y - 46}
                            />
                            {agent.name && (
                              <pixiText
                                text={agent.name}
                                style={{
                                  fontSize: 7,
                                  fill: agent.color ?? "#3b82f6",
                                  fontFamily: "monospace",
                                  fontWeight: "bold",
                                }}
                                x={agent.currentPosition.x - 18}
                                y={agent.currentPosition.y - 34}
                              />
                            )}
                          </>
                        )}

                        {/* Subagent shoulder dot */}
                        {agent.characterType === "subagent" &&
                          (() => {
                            const parentAgent = agent.parentId
                              ? Array.from(agents.values()).find(
                                  (a) => a.id === agent.parentId,
                                )
                              : null;
                            const dotColor = parentAgent?.color ?? "#f59e0b";
                            return (
                              <SubagentDot
                                key={`dot-${agent.id}`}
                                x={agent.currentPosition.x + 10}
                                y={agent.currentPosition.y - 28}
                                color={dotColor}
                              />
                            );
                          })()}
                      </pixiContainer>
                    ))}

                  {/* Night veil: the room darkens with the PC clock */}
                  <NightTint />

                  {/* Bubbles Layer - rendered on top of everything */}
                  {Array.from(agents.values())
                    .filter(
                      (agent) =>
                        agent.bubble.content &&
                        !isInElevatorZone(agent.currentPosition),
                    )
                    .map((agent) => (
                      <pixiContainer
                        key={`bubble-${agent.id}`}
                        x={agent.currentPosition.x}
                        y={agent.currentPosition.y}
                      >
                        <AgentBubble
                          content={agent.bubble.content!}
                          yOffset={-80}
                        />
                      </pixiContainer>
                    ))}
                  {boss.bubble.content && (
                    <pixiContainer x={boss.position.x} y={boss.position.y}>
                      <BossBubble content={boss.bubble.content} yOffset={-80} />
                    </pixiContainer>
                  )}
                  {/* Claude's « ! »: above furniture, labels and night veil */}
                  {boss.backendState === "needs_attention" &&
                    compactionAnimation.phase === "idle" && (
                      <pixiContainer x={boss.position.x} y={boss.position.y}>
                        <BossAttentionBadge />
                      </pixiContainer>
                    )}
                </>
              )}
            </Application>
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
