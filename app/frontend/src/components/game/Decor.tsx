"use client";

/**
 * Decor - floor props for the space freed by the 8-desk room:
 * a lounge corner (rug, sofa, coffee table, floor lamp), a filament rack
 * and an arcade cabinet with an animated screen. Static shapes are drawn
 * once; only the arcade screen and the lamp glow change over time.
 */

import { Graphics } from "pixi.js";
import { useTick } from "@pixi/react";
import { useRef, type ReactNode } from "react";
import {
  CAT_FOOD_BOWL_POSITION,
  CAT_WATER_BOWL_POSITION,
} from "@/constants/positions";

const OUTLINE = { width: 2, color: 0x0c0c0f };

/** Glass jar full of colored candies; (x, y) is its top-left corner. */
function drawCandyJar(g: Graphics, x: number, y: number): void {
  g.roundRect(x, y + 3, 13, 15, 2);
  g.fill({ color: 0xbfe9ff, alpha: 0.55 });
  g.stroke({ width: 1, color: 0x0c0c0f });
  g.rect(x + 1, y, 11, 3);
  g.fill(0xd4af37);
  const candies = [0xff4d9a, 0xffd23f, 0x43c35b, 0xff6a13, 0xb06bff, 0xff4d9a];
  candies.forEach((c, i) => {
    g.circle(x + 3.5 + (i % 3) * 3, y + 9 + Math.floor(i / 3) * 4, 1.7);
    g.fill(c);
  });
}

/** Soda can seen from the front; (x, y) is its top-left corner. */
function drawCan(g: Graphics, x: number, y: number, color: number): void {
  g.rect(x, y, 7, 11);
  g.fill(color);
  g.stroke({ width: 1, color: 0x0c0c0f });
  g.rect(x, y, 7, 2);
  g.fill(0xcbd5e1);
  g.rect(x + 1, y + 5, 5, 2);
  g.fill({ color: 0xffffff, alpha: 0.7 });
}

/** Gamepad lying on the table; (x, y) is its top-left corner. */
function drawController(g: Graphics, x: number, y: number): void {
  g.roundRect(x, y, 16, 7, 3);
  g.fill(0x2d3748);
  g.stroke({ width: 1, color: 0x0c0c0f });
  g.rect(x + 3, y + 3, 4, 1);
  g.rect(x + 4.5, y + 1.5, 1, 4);
  g.fill(0xe5e7eb);
  g.circle(x + 11, y + 2.5, 1);
  g.fill(0xef4444);
  g.circle(x + 13, y + 4.5, 1);
  g.fill(0x22c55e);
}

function drawLounge(g: Graphics): void {
  g.clear();
  // Rug
  g.roundRect(0, 30, 220, 80, 10);
  g.fill(0x3b4a5c);
  g.roundRect(6, 36, 208, 68, 8);
  g.stroke({ width: 2, color: 0x5d7088 });
  // Sofa (seen from the front, back against the top)
  g.roundRect(20, 0, 130, 26, 6);
  g.fill(0x8e949c);
  g.stroke(OUTLINE);
  g.roundRect(26, 18, 118, 22, 4);
  g.fill(0xa9aeb5);
  g.stroke(OUTLINE);
  g.moveTo(65, 20);
  g.lineTo(65, 38);
  g.moveTo(105, 20);
  g.lineTo(105, 38);
  g.stroke({ width: 1, color: 0x6c7279 });
  g.roundRect(12, 8, 16, 34, 5);
  g.roundRect(142, 8, 16, 34, 5);
  g.fill(0x7d838b);
  g.stroke(OUTLINE);
  // Cushions
  g.roundRect(34, 6, 22, 14, 4);
  g.fill(0xff6a13);
  g.roundRect(114, 6, 22, 14, 4);
  g.fill(0x38d9f5);
  // Coffee table with a laptop, a controller, a candy jar and two soda cans
  g.roundRect(45, 60, 80, 30, 4);
  g.fill(0x6b4a2f);
  g.stroke(OUTLINE);
  g.rect(70, 64, 26, 14);
  g.fill(0xc9ccd1);
  g.rect(72, 66, 22, 9);
  g.fill(0x16181d);
  drawCandyJar(g, 52, 68);
  drawCan(g, 103, 67, 0x38d9f5);
  drawCan(g, 113, 71, 0xff6a13);
  drawController(g, 74, 80);
  // Loose candies on the table
  g.circle(101, 84, 2);
  g.fill(0xff4d9a);
  g.circle(106, 86, 2);
  g.fill(0xffd23f);
  g.circle(98, 87, 2);
  g.fill(0x43c35b);
  // Bean bag on the rug
  g.ellipse(22, 94, 18, 12);
  g.fill(0x6d28d9);
  g.stroke(OUTLINE);
  g.ellipse(17, 89, 9, 5);
  g.fill({ color: 0xffffff, alpha: 0.22 });
  // Potted plant beside the sofa
  g.rect(-12, 30, 14, 11);
  g.fill(0xb45309);
  g.stroke(OUTLINE);
  g.ellipse(-5, 16, 4, 13);
  g.ellipse(-11, 21, 4, 9);
  g.ellipse(1, 21, 4, 9);
  g.fill(0x22c55e);
  // Floor lamp
  g.rect(196, 14, 3, 70);
  g.fill(0x2e333b);
  g.ellipse(197, 86, 10, 4);
  g.fill(0x2e333b);
}

function drawLampGlow(g: Graphics): void {
  g.clear();
  g.circle(197, 14, 22);
  g.fill({ color: 0xffd27a, alpha: 0.18 });
  g.moveTo(185, 4);
  g.lineTo(209, 4);
  g.lineTo(204, 18);
  g.lineTo(190, 18);
  g.closePath();
  g.fill(0xf3e2b8);
  g.stroke({ width: 1, color: 0x0c0c0f });
}

export function Lounge(): ReactNode {
  return (
    <pixiContainer>
      <pixiGraphics draw={drawLounge} />
      <pixiGraphics draw={drawLampGlow} />
    </pixiContainer>
  );
}

const RACK_SPOOLS = [
  [0xff6a13, 0x38d9f5, 0x43c35b],
  [0xf3f1ec, 0x1b1c20, 0xb06bff],
  [0xffd23f, 0xff4d6d, 0x8e949c],
  [0x38d9f5, 0xff6a13, 0x43c35b],
];

function drawFilamentRack(g: Graphics): void {
  g.clear();
  // Uprights
  g.rect(0, 0, 4, 150);
  g.rect(80, 0, 4, 150);
  g.fill(0x8c939e);
  g.stroke({ width: 1, color: 0x0c0c0f });
  RACK_SPOOLS.forEach((row, r) => {
    const y = 34 + r * 36;
    row.forEach((c, i) => {
      const x = 16 + i * 26;
      g.circle(x, y - 12, 11);
      g.fill(0x0c0c0f);
      g.circle(x, y - 12, 10);
      g.fill(c);
      g.circle(x, y - 12, 3);
      g.fill(0x16181d);
    });
    // Shelf
    g.rect(0, y, 84, 4);
    g.fill(0x5c626b);
    g.stroke({ width: 1, color: 0x0c0c0f });
  });
  // Label
  g.rect(18, 140, 48, 8);
  g.fill(0xff6a13);
}

function drawArcade(g: Graphics): void {
  g.clear();
  // Cabinet
  g.moveTo(0, 0);
  g.lineTo(40, 0);
  g.lineTo(40, 76);
  g.lineTo(0, 76);
  g.closePath();
  g.fill(0x1f2a44);
  g.stroke(OUTLINE);
  // Marquee
  g.rect(3, 3, 34, 8);
  g.fill(0xff4d6d);
  // Screen bezel
  g.rect(4, 14, 32, 24);
  g.fill(0x0c0c0f);
  // Control panel
  g.rect(2, 42, 36, 8);
  g.fill(0x2e3b5c);
  g.circle(11, 46, 2);
  g.fill(0xffd23f);
  g.circle(25, 46, 2);
  g.circle(31, 46, 2);
  g.fill(0x38d9f5);
  // Side stripes
  g.rect(4, 56, 32, 3);
  g.fill(0xff6a13);
  g.rect(4, 62, 32, 3);
  g.fill(0x38d9f5);
}

/** A tiny space-invader that marches across the arcade screen. */
function drawInvader(g: Graphics): void {
  g.clear();
  const px = [
    "0100010",
    "0011100",
    "0111110",
    "1101011",
    "1111111",
    "0100010",
  ];
  px.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === "1") g.rect(x * 2, y * 2, 2, 2);
    }),
  );
  g.fill(0x43c35b);
}

export function ArcadeCabinet(): ReactNode {
  const invader = useRef<Graphics | null>(null);
  const time = useRef(0);
  useTick((ticker) => {
    time.current += ticker.deltaMS;
    const g = invader.current;
    if (!g) return;
    const t = (time.current / 2400) % 2;
    g.x = 6 + (t < 1 ? t : 2 - t) * 14;
    g.y = 18 + (Math.floor(time.current / 400) % 2) * 2;
  });
  return (
    <pixiContainer>
      <pixiGraphics draw={drawArcade} />
      <pixiGraphics ref={invader} draw={drawInvader} />
    </pixiContainer>
  );
}

export function FilamentRack(): ReactNode {
  return <pixiGraphics draw={drawFilamentRack} />;
}

// ---------------------------------------------------------------------------
// Cat corner: tree with two niches (the cats sleep there) and two bowls
// ---------------------------------------------------------------------------

const TREE_WOOD = 0x8a5a33;
const TREE_WOOD_DARK = 0x6b4426;
const TREE_GREEN = 0x4f9d4e;
const TREE_GREEN_DARK = 0x3a7a3a;

function drawNiche(g: Graphics, x: number, y: number): void {
  // Box (28 high, floor at y + 28 where the cat's feet rest)
  g.roundRect(x, y, 30, 28, 3);
  g.fill(TREE_WOOD);
  g.stroke(OUTLINE);
  g.roundRect(x + 3, y + 3, 24, 25, 2);
  g.fill(0x3a2a1e);
  // Green platform / floor of the niche
  g.roundRect(x - 1, y + 28, 32, 6, 2);
  g.fill(TREE_GREEN);
  g.stroke(OUTLINE);
}

/** 76 x 128 before CAT_TREE_SCALE, origin = top-left. Feet spots: (18, 70) and (58, 104). */
function drawCatTree(g: Graphics): void {
  g.clear();
  // Trunk
  g.rect(30, 12, 16, 106);
  g.fill(TREE_WOOD);
  g.stroke(OUTLINE);
  g.rect(34, 12, 4, 106);
  g.fill(TREE_WOOD_DARK);
  // Base platform
  g.roundRect(0, 118, 76, 10, 3);
  g.fill(TREE_GREEN);
  g.stroke(OUTLINE);
  g.rect(4, 124, 68, 2);
  g.fill(TREE_GREEN_DARK);
  // Top platform
  g.roundRect(8, 4, 60, 8, 3);
  g.fill(TREE_GREEN);
  g.stroke(OUTLINE);
  // Niches (left one is higher, right one lower)
  drawNiche(g, 2, 42);
  drawNiche(g, 44, 76);
}

export function CatTree(): ReactNode {
  return <pixiGraphics draw={drawCatTree} />;
}

function drawBowl(g: Graphics, cx: number, cy: number, fill: number): void {
  g.ellipse(cx, cy + 4, 18, 8);
  g.fill(0xc8ccd2);
  g.stroke(OUTLINE);
  g.ellipse(cx, cy + 1, 14, 5);
  g.fill(fill);
}

function drawCatBowls(g: Graphics): void {
  g.clear();
  drawBowl(g, CAT_WATER_BOWL_POSITION.x, CAT_WATER_BOWL_POSITION.y, 0x5fb7ea);
  drawBowl(g, CAT_FOOD_BOWL_POSITION.x, CAT_FOOD_BOWL_POSITION.y, 0xa8672f);
  // A few kibbles heaped in the food bowl
  for (const [dx, dy] of [
    [-6, -2],
    [0, -4],
    [6, -2],
    [-1, 0],
  ]) {
    g.circle(CAT_FOOD_BOWL_POSITION.x + dx, CAT_FOOD_BOWL_POSITION.y + dy, 3);
    g.fill(0xc98a4b);
  }
}

/** Drawn in world coordinates: mount in an un-translated container. */
export function CatBowls(): ReactNode {
  return <pixiGraphics draw={drawCatBowls} />;
}
