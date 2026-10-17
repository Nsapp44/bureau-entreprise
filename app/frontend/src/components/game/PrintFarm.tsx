"use client";

/**
 * PrintFarm - small workbench with animated 3D printers (Nasap3D decor).
 *
 * Each printer builds a part layer by layer: the gantry rises one layer at a
 * time, the head sweeps across the part, the front screen shows progress.
 * When a part is done the head parks for a moment, then the bed is cleared.
 */

import { Graphics } from "pixi.js";
import { useTick } from "@pixi/react";
import { useCallback, useRef, type ReactNode } from "react";

const FRAME_W = 48;
const BED_Y = 46;
const MAX_LAYERS = 30;
const HOLD_MS = 4000;
const NOOP = (): void => {};

type Shape = (layer: number) => number; // half-width of the part at a layer

const SHAPES: Record<string, Shape> = {
  vase: (i) => Math.round(5 + 4 * Math.sin((i / MAX_LAYERS) * Math.PI * 1.2)),
  tower: (i) => 9 - Math.floor(i / 8) * 2,
  rocket: (i) => (i < 4 ? 8 : i < 24 ? 5 : Math.max(1, 5 - (i - 24))),
  cube: () => 7,
  gear: (i) => (i % 4 < 2 ? 9 : 7),
  benchy: (i) => (i < 8 ? 10 - Math.floor(i / 4) : i < 18 ? 6 : i < 26 ? 3 : 1),
};

interface PrinterProps {
  x: number;
  color: number;
  shape: keyof typeof SHAPES;
  durationMs: number;
  startMs: number;
}

function drawFrame(g: Graphics): void {
  g.clear();
  // Body
  g.rect(0, 0, FRAME_W, 60);
  g.fill(0x1e2127);
  g.stroke({ width: 2, color: 0x0c0c0f });
  // Build chamber
  g.rect(4, 6, FRAME_W - 8, 44);
  g.fill(0x2a2f38);
  g.rect(4, 6, FRAME_W - 8, 2);
  g.fill({ color: 0xfff3d6, alpha: 0.9 });
  // Vertical rods
  g.rect(6, 8, 2, 40);
  g.rect(FRAME_W - 8, 8, 2, 40);
  g.fill(0x6e737c);
  // Bed
  g.rect(6, BED_Y, FRAME_W - 12, 3);
  g.fill(0x8c939e);
  // Front panel: orange brand stripe
  g.rect(26, 54, 16, 2);
  g.fill(0xff6a13);
  // Filament spool on top
  g.circle(36, -4, 6);
  g.fill(0x0c0c0f);
  g.circle(36, -4, 5);
  g.fill(0x3a3d46);
  g.circle(36, -4, 2);
  g.fill(0x16181d);
}

function Printer3D({ x, color, shape, durationMs, startMs }: PrinterProps): ReactNode {
  const elapsedRef = useRef(startMs);
  const layersRef = useRef(-1);
  const partRef = useRef<Graphics | null>(null);
  const gantryRef = useRef<Graphics | null>(null);
  const headRef = useRef<Graphics | null>(null);
  const shapeFn = SHAPES[shape];

  const drawGantry = useCallback((g: Graphics) => {
    g.clear();
    g.rect(4, 0, FRAME_W - 8, 2);
    g.fill(0x9aa1ab);
  }, []);

  const drawHead = useCallback((g: Graphics) => {
    g.clear();
    g.rect(-5, -4, 10, 6);
    g.fill(0xff6a13);
    g.stroke({ width: 1, color: 0x0c0c0f });
    g.rect(-1, 2, 2, 2);
    g.fill(0xd9d9d9);
  }, []);

  const drawPart = useCallback(
    (g: Graphics, layers: number) => {
      g.clear();
      for (let i = 0; i < layers; i++) {
        const half = shapeFn(i);
        g.rect(FRAME_W / 2 - half, BED_Y - 1 - i, half * 2, 1);
        g.fill(i % 2 ? color : shade(color));
      }
      // Front screen with progress bar
      g.rect(6, 52, 16, 6);
      g.fill(0x10262f);
      g.rect(7, 54, Math.round((14 * layers) / MAX_LAYERS), 2);
      g.fill(0x38d9f5);
    },
    [color, shapeFn],
  );

  useTick((ticker) => {
    elapsedRef.current = (elapsedRef.current + ticker.deltaMS) % (durationMs + HOLD_MS);
    const t = elapsedRef.current;
    const printing = t < durationMs;
    const layers = printing ? Math.floor((t / durationMs) * MAX_LAYERS) : MAX_LAYERS;

    if (layers !== layersRef.current && partRef.current) {
      layersRef.current = layers;
      drawPart(partRef.current, layers);
    }
    const gantry = gantryRef.current;
    const head = headRef.current;
    if (!gantry || !head) return;
    gantry.y = BED_Y - 7 - layers;
    if (printing) {
      const half = shapeFn(Math.max(0, layers - 1));
      head.x = FRAME_W / 2 + Math.round(Math.sin(t / 140) * half);
    } else {
      head.x = 10; // parked while the part waits to be removed
    }
  });

  return (
    <pixiContainer x={x}>
      <pixiGraphics draw={drawFrame} />
      <pixiGraphics ref={partRef} draw={NOOP} />
      <pixiContainer ref={gantryRef}>
        <pixiGraphics draw={drawGantry} />
        <pixiGraphics ref={headRef} draw={drawHead} y={2} />
      </pixiContainer>
    </pixiContainer>
  );
}

function shade(color: number): number {
  const r = ((color >> 16) & 0xff) * 0.8;
  const g = ((color >> 8) & 0xff) * 0.8;
  const b = (color & 0xff) * 0.8;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

const SPOOLS = [0xff6a13, 0x38d9f5, 0x43c35b, 0xf3f1ec, 0xb06bff, 0xffd23f];

function drawBench(g: Graphics, w: number): void {
  g.clear();
  // Legs
  g.rect(4, 66, 5, 36);
  g.rect(w - 9, 66, 5, 36);
  g.fill(0x8c939e);
  g.rect(2, 100, 9, 3);
  g.rect(w - 11, 100, 9, 3);
  g.fill(0x5c626b);
  // Shelf with filament spools
  g.rect(9, 86, w - 18, 4);
  g.fill(0x23272e);
  const count = Math.floor((w - 24) / 24);
  for (let i = 0; i < count; i++) {
    const c = SPOOLS[i % SPOOLS.length];
    g.circle(24 + i * 24, 80, 6);
    g.fill(0x0c0c0f);
    g.circle(24 + i * 24, 80, 5);
    g.fill(c);
    g.circle(24 + i * 24, 80, 2);
    g.fill(0x16181d);
  }
  // Top
  g.rect(0, 60, w, 7);
  g.fill(0x2e333b);
  g.stroke({ width: 2, color: 0x0c0c0f });
  g.rect(0, 64, w, 2);
  g.fill(0xff6a13);
}

export interface PrintJob {
  color: number;
  shape: keyof typeof SHAPES;
  durationMs: number;
  startMs: number;
}

const DEFAULT_JOBS: PrintJob[] = [
  { color: 0xff6a13, shape: "vase", durationMs: 42000, startMs: 9000 },
  { color: 0x38d9f5, shape: "rocket", durationMs: 36000, startMs: 25000 },
];

/** Bench width for a number of printers (60 px per printer). */
export function benchWidth(printers: number): number {
  return printers * 60;
}

export function PrintFarm({ jobs = DEFAULT_JOBS }: { jobs?: PrintJob[] }): ReactNode {
  const w = benchWidth(jobs.length);
  const draw = useCallback((g: Graphics) => drawBench(g, w), [w]);
  return (
    <pixiContainer>
      <pixiGraphics draw={draw} />
      {jobs.map((j, i) => (
        <Printer3D key={i} x={6 + i * 60} color={j.color} shape={j.shape} durationMs={j.durationMs} startMs={j.startMs} />
      ))}
    </pixiContainer>
  );
}
