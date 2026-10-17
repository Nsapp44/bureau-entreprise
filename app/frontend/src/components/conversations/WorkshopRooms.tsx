"use client";

/**
 * WorkshopRooms : colonne de 3 pieces d'atelier (impression 3D, CNC, laser)
 * dessinee en pixel-art leger (rects/polygones Graphics), avec petites
 * animations (useTick). Maquette : ref/gpt_pieces_v3.png.
 */

import { useCallback, useRef, type ReactNode } from "react";
import { extend, useTick } from "@pixi/react";
import { Container, Graphics, Text } from "pixi.js";

extend({ Container, Graphics, Text });

export const ROOMS_W = 960;

// Le contenu des pieces est dessine dans un repere reduit puis agrandi par K.
const K = 1.6;
const LT = 16; // haut utile (repere contenu)
const PC = 6; // epaisseur cloison (repere contenu)
const CR = Math.round((ROOMS_W - 12) / K) - 4; // bord droit utile (repere contenu)

const WALL_R = 12; // mur exterieur droit
const WALL_L = 6; // mur gauche (avec porte)
const PART = 10; // cloisons
const LINTEL = 26; // linteau + enseigne
const DOOR_H = 108;
const ORANGE = 0xff5a3c;
const OUT = 0x0a0c0d; // contour sombre
const METAL = 0x242a2b;

/** y du centre de la porte de chacune des 3 pieces. */
export function roomsDoorYs(y: number, height: number): number[] {
  const h = height / 3;
  return [0, 1, 2].map((i) => y + i * h + LINTEL / 2 + h / 2);
}

// ---------------------------------------------------------------------------
// Helpers de dessin
// ---------------------------------------------------------------------------

function R(g: Graphics, x: number, y: number, w: number, h: number, c: number, a = 1): void {
  g.rect(x, y, w, h).fill({ color: c, alpha: a });
}

/** Disque pixel-art : rangees de rects en coordonnees entieres. */
function C(g: Graphics, x: number, y: number, r: number, c: number, a = 1): void {
  const cx = Math.round(x);
  const cy = Math.round(y);
  const ri = Math.ceil(r);
  for (let dy = -ri; dy <= ri; dy++) {
    const hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)));
    g.rect(cx - hw, cy + dy, hw * 2 + 1, 1).fill({ color: c, alpha: a });
  }
}

/** Eclaircit / assombrit une couleur 0xRRGGBB. */
function shade(c: number, f: number): number {
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
}

/** Aplat avec contour sombre 1 px, highlight en haut, ombre en bas. */
function B(g: Graphics, x: number, y: number, w: number, h: number, c: number): void {
  R(g, x - 1, y - 1, w + 2, h + 2, OUT);
  R(g, x, y, w, h, c);
  R(g, x, y, w, 1, shade(c, 1.4));
  R(g, x, y + h - 1, w, 1, shade(c, 0.65));
}

function shadow(g: Graphics, x: number, y: number, w: number): void {
  R(g, x, y, w, 3, 0x000000, 0.3);
}

/** Ombre portee elliptique au sol (douce, 2 couches). */
function groundShadow(g: Graphics, x: number, y: number, w: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  const wi = Math.round(w);
  R(g, xi - 2, yi - 1, wi + 4, 3, 0x000000, 0.16);
  R(g, xi + 1, yi - 2, wi - 2, 5, 0x000000, 0.16);
  R(g, xi + 3, yi - 1, wi - 6, 3, 0x000000, 0.2);
}

/** Vis / rivets aux 4 coins d'un carter. */
function rivets(g: Graphics, x: number, y: number, w: number, h: number): void {
  for (const [rx, ry] of [
    [x + 2, y + 2],
    [x + w - 4, y + 2],
    [x + 2, y + h - 4],
    [x + w - 4, y + h - 4],
  ]) {
    R(g, rx, ry, 2, 2, 0x7a8486);
    R(g, rx, ry, 1, 1, 0xc8d0d0);
  }
}

/** Reflet vertical sur metal (arete claire + bande diffuse). */
function sheen(g: Graphics, x: number, y: number, w: number, h: number): void {
  R(g, x + 1, y + 1, 1, h - 2, 0x4e5759);
  R(g, x + w - 2, y + 1, 1, h - 2, 0x14181a);
}

/** Plaque signaletique minuscule. */
function nameplate(g: Graphics, x: number, y: number): void {
  R(g, x, y, 8, 4, 0xb8bfbf);
  R(g, x, y, 8, 1, 0xe8eded);
  R(g, x + 1, y + 2, 6, 1, 0x3a4244);
}

/** Sol d'atelier : taches, usure, marquage jaune, copeaux/poussiere. */
function floorDetails(g: Graphics, h: number, seed: number): void {
  const fy = h - PC;
  // taches d'huile / usure
  const stains: number[][] = [
    [140, fy - 10, 22, 4],
    [330, fy - 24, 16, 3],
    [560, fy - 14, 26, 4],
    [250, fy - 40, 10, 3],
  ];
  for (let k = 0; k < stains.length; k++) {
    const [sx, sy, sw, sh] = stains[(k + seed) % stains.length];
    R(g, sx + k * 3 - sw, sy - sh, sw * 2, sh * 2, 0x000000, 0.14);
    R(g, sx + k * 3 - sw + 3, sy - sh + 1, sw * 2 - 6, sh * 2 - 2, 0x000000, 0.12);
  }
  // traces d'usure claires
  for (let k = 0; k < 6; k++) R(g, 90 + ((k * 97 + seed * 31) % 560), fy - 6 - ((k * 13) % 30), 14, 1, 0xffffff, 0.05);
  // marquage jaune au sol (passage) avec bande pointillee
  for (let x2 = 14; x2 < CR - 8; x2 += 14) R(g, x2, fy - 3, 8, 2, 0xf0c020, 0.55);
  R(g, 12, fy - 5, CR - 20, 1, 0xf0c020, 0.18);
  // poussiere / copeaux
  for (let k = 0; k < 10; k++) R(g, 60 + ((k * 61 + seed * 17) % 600), fy - 8 - ((k * 7) % 22), 2, 1, 0xd8c8a8, 0.3);
}

const WOOD = 0xc89b6a;
const WOOD_L = 0xe0b078;
const CUT = 0x5a3410;

/** Rondelle / engrenage en bois (meme piece sur CNC, laser et tables). */
function drawGear(g: Graphics, cx: number, cy: number, r: number, fill: number): void {
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    R(g, Math.round(cx + Math.cos(a) * r) - 1, Math.round(cy + Math.sin(a) * r) - 1, 3, 3, fill);
  }
  C(g, cx, cy, r, fill);
  C(g, cx, cy, Math.max(1, Math.round(r * 0.35)), CUT);
}

/** Silhouette de chien decoupee (32x14 environ, origine au corps). */
function drawDog(g: Graphics, dx: number, dy: number, dog: number): void {
  R(g, dx, dy + 2, 20, 6, dog);
  R(g, dx + 18, dy, 8, 6, dog);
  R(g, dx + 24, dy + 2, 5, 3, dog);
  R(g, dx + 19, dy - 2, 3, 3, dog);
  R(g, dx + 1, dy + 8, 3, 4, dog);
  R(g, dx + 6, dy + 8, 3, 4, dog);
  R(g, dx + 13, dy + 8, 3, 4, dog);
  R(g, dx + 17, dy + 8, 3, 4, dog);
  R(g, dx - 3, dy, 4, 3, dog);
}

const SIGN_STYLE = {
  fontFamily: "monospace",
  fontSize: 13,
  fill: 0xffb830,
  fontWeight: "bold" as const,
};
const LABEL_STYLE = {
  fontFamily: "monospace",
  fontSize: 8,
  fill: 0x111314,
  fontWeight: "bold" as const,
};
const LABEL_LIGHT = {
  fontFamily: "monospace",
  fontSize: 8,
  fill: 0xe8e8e8,
  fontWeight: "bold" as const,
};

// ---------------------------------------------------------------------------
// Coque de piece (sol, murs, linteau, porte)
// ---------------------------------------------------------------------------

function drawShell(g: Graphics, h: number, floor: number, first: boolean): void {
  // sol + dalles (48 px, joints 1 px) avec petits reflets
  R(g, 0, 0, ROOMS_W, h, floor);
  for (let gx = 48; gx < ROOMS_W; gx += 48) R(g, gx, LINTEL, 1, h - LINTEL, 0x000000, 0.28);
  for (let gy = LINTEL + 32; gy < h; gy += 48) R(g, 0, gy, ROOMS_W, 1, 0x000000, 0.28);
  // mur droit epais (coincide avec le bord de la scene)
  R(g, ROOMS_W - WALL_R, 0, WALL_R, h, METAL);
  R(g, ROOMS_W - WALL_R, 0, 1, h, OUT);
  R(g, ROOMS_W - WALL_R + 1, 0, 2, h, ORANGE, 0.85);
  R(g, ROOMS_W - 5, 0, 1, h, 0x3a4244);
  R(g, ROOMS_W - 2, 0, 2, h, OUT);
  // cloison basse metallique avec cadre
  R(g, 0, h - PART, ROOMS_W, PART, METAL);
  R(g, 0, h - PART, ROOMS_W, 2, ORANGE, 0.85);
  R(g, 0, h - PART + 2, ROOMS_W, 1, 0x4a5254);
  R(g, 0, h - 2, ROOMS_W, 2, OUT);
  // voyants orange aux angles de la cloison
  R(g, 3, h - PART + 3, 4, 5, 0xffa030);
  R(g, 4, h - PART + 4, 2, 2, 0xfff0c0);
  R(g, ROOMS_W - WALL_R - 8, h - PART + 3, 4, 5, 0xffa030);
  // linteau
  R(g, 0, 0, ROOMS_W, LINTEL, METAL);
  R(g, 0, 2, ROOMS_W, 1, 0x4a5254);
  R(g, 0, LINTEL - 2, ROOMS_W, 2, ORANGE);
  R(g, 0, LINTEL, ROOMS_W, 1, OUT);
  if (first) R(g, 0, 0, ROOMS_W, 2, ORANGE); // raccord liseré du mur du fond
  R(g, 3, 8, 4, 6, 0xffa030);
  R(g, 4, 9, 2, 2, 0xfff0c0);
  // mur gauche
  R(g, 0, LINTEL, WALL_L, h - LINTEL, METAL);
  R(g, WALL_L - 1, LINTEL, 1, h - LINTEL, ORANGE, 0.6);

  // porte FERMEE : cadre jaune/noir, panneau metal, poignee
  const doorC = LINTEL / 2 + h / 2;
  const dTop = Math.round(doorC - DOOR_H / 2);
  const dBot = dTop + DOOR_H;
  const dx = 2;
  const dw = 32;
  R(g, dx - 1, dTop - 1, dw + 2, DOOR_H + 2, OUT);
  for (let k = 0; k * 6 < DOOR_H; k++) {
    const c = k % 2 === 0 ? 0xff8a1a : 0x16191a;
    R(g, dx, dTop + k * 6, 4, Math.min(6, DOOR_H - k * 6), c);
    R(g, dx + dw - 4, dTop + k * 6, 4, Math.min(6, DOOR_H - k * 6), c);
  }
  R(g, dx + 4, dTop, dw - 8, DOOR_H, 0x3a4244);
  R(g, dx + 4, dTop, dw - 8, 3, 0xf0c020);
  R(g, dx + 4, dBot - 3, dw - 8, 3, 0xf0c020);
  R(g, dx + 6, dTop + 6, dw - 12, DOOR_H - 12, 0x2b3234);
  R(g, dx + 6, dTop + 6, 1, DOOR_H - 12, 0x4e5759);
  R(g, dx + dw - 8, dTop + 6, 1, DOOR_H - 12, 0x14181a);
  // rivets
  for (const ry of [dTop + 9, dBot - 11]) {
    R(g, dx + 8, ry, 2, 2, 0x6a7476);
    R(g, dx + dw - 11, ry, 2, 2, 0x6a7476);
  }
  // poignee jaune
  R(g, dx + dw - 12, Math.round(doorC) - 8, 4, 16, OUT);
  R(g, dx + dw - 11, Math.round(doorC) - 7, 2, 14, 0xffb830);
  // bandes de securite au-dessus de la porte
  for (let k = 0; k < 8; k++) R(g, dx + k * 4, dTop - 5, 4, 3, k % 2 === 0 ? 0xff8a1a : 0x16191a);
  // voyant orange au-dessus de la porte
  R(g, dx + 4, dTop - 6, 4, 4, 0xffa030);
}

function drawSignPlate(g: Graphics, w: number): void {
  R(g, 0, 0, w, 18, 0x0f1213);
  R(g, 0, 0, w, 1, 0xffb830, 0.7);
  R(g, 0, 17, w, 1, 0xffb830, 0.7);
  R(g, 0, 0, 1, 18, 0xffb830, 0.7);
  R(g, w - 1, 0, 1, 18, 0xffb830, 0.7);
  R(g, 2, 2, 2, 2, 0xffa030);
  R(g, w - 4, 2, 2, 2, 0xffa030);
}

// ---------------------------------------------------------------------------
// Piece 1 : impression 3D
// ---------------------------------------------------------------------------

const PS = 1.4; // echelle des imprimantes (copie de game/PrintFarm.tsx)
const PY = 46;
const PF_W = 48;
const PF_BED = 46;
const PF_LAYERS = 30;
const PF_HOLD = 4000;
const SPOOLS = [0xff6a13, 0x38d9f5, 0x43c35b, 0xf3f1ec, 0xb06bff, 0xffd23f];
const PF_SHAPES: Record<string, (i: number) => number> = {
  vase: (i) => Math.round(5 + 4 * Math.sin((i / PF_LAYERS) * Math.PI * 1.2)),
  tower: (i) => 9 - Math.floor(i / 8) * 2,
  rocket: (i) => (i < 4 ? 8 : i < 24 ? 5 : Math.max(1, 5 - (i - 24))),
  benchy: (i) => (i < 8 ? 10 - Math.floor(i / 4) : i < 18 ? 6 : i < 26 ? 3 : 1),
};
const PRINT_JOBS = [
  { color: 0xff6a13, shape: "vase", dur: 42000, start: 9000 },
  { color: 0x38d9f5, shape: "rocket", dur: 36000, start: 25000 },
  { color: 0x43c35b, shape: "tower", dur: 30000, start: 2000 },
  { color: 0xb06bff, shape: "benchy", dur: 48000, start: 15000 },
];
const P_X0 = 40;
const P_STEP = 78;
const P_TOP = LT + 16;

function drawPrintersStatic(g: Graphics, h: number): void {
  const floorY = h - PC;
  floorDetails(g, h, 0);
  // etabli bas sous les imprimantes (meme style que PrintFarm) + tiroirs
  const bt = PY + 84;
  const bw = 3 * P_STEP + 67 + 8;
  shadow(g, P_X0 - 4, floorY - 2, bw);
  groundShadow(g, P_X0 - 4, floorY, bw);
  // cables au sol + bidon de resine + carton
  g.poly([P_X0 + 20, floorY - 2, P_X0 + 60, floorY + 1, P_X0 + 120, floorY - 1, P_X0 + 200, floorY + 1], false).stroke({
    width: 1,
    color: 0x0a0c0d,
  });
  B(g, P_X0 + bw + 2, floorY - 14, 10, 14, 0x3a6ea8);
  R(g, P_X0 + bw + 4, floorY - 17, 6, 3, 0x15191b);
  R(g, P_X0 + bw + 3, floorY - 9, 8, 3, 0xe8e8e8);
  B(g, P_X0 + bw + 14, floorY - 11, 14, 11, 0xa8803c);
  R(g, P_X0 + bw + 14, floorY - 7, 14, 1, 0x6a4c20);
  B(g, P_X0 - 4, bt, bw, 8, 0x2e333b);
  R(g, P_X0 - 4, bt + 5, bw, 2, 0xff6a13);
  R(g, P_X0 - 4, bt + 1, bw, 1, 0x4a525a);
  for (let i = 0; i < 4; i++) {
    const px = P_X0 + i * P_STEP;
    B(g, px, bt + 10, 67, floorY - bt - 14, 0x2b3234);
    sheen(g, px, bt + 10, 67, floorY - bt - 14);
    rivets(g, px, bt + 10, 67, floorY - bt - 14);
    nameplate(g, px + 29, bt + 11);
    // reflet du plateau + ombre portee des imprimantes sur l'etabli
    R(g, px + 2, bt - 1, 63, 1, 0x000000, 0.25);
    const dh = Math.floor((floorY - bt - 14 - 6) / 2);
    for (let d = 0; d < 2; d++) {
      R(g, px + 4, bt + 13 + d * (dh + 2), 59, dh - 1, 0x1a1e20);
      R(g, px + 24, bt + 13 + d * (dh + 2) + Math.floor(dh / 2), 19, 1, 0x8a929a);
    }
  }

  // etabli avec lampe articulee et ecran
  const bx = 360;
  const by = P_TOP + 44;
  shadow(g, bx, by + 54, 72);
  R(g, bx + 3, by + 6, 4, 44, 0x3a2a1c);
  R(g, bx + 64, by + 6, 4, 44, 0x3a2a1c);
  B(g, bx + 38, by + 7, 30, 38, 0x2b3234); // caisson tiroirs
  for (let k = 0; k < 3; k++) {
    R(g, bx + 41, by + 10 + k * 12, 24, 9, 0x1a1e20);
    R(g, bx + 49, by + 14 + k * 12, 8, 1, 0x8a929a);
  }
  B(g, bx, by, 72, 6, 0xa06a3a); // plateau
  // ecran
  B(g, bx + 8, by - 24, 24, 18, 0x15191b);
  R(g, bx + 10, by - 22, 20, 14, 0x2a6a9a);
  R(g, bx + 12, by - 20, 12, 1, 0x70c0f0);
  R(g, bx + 12, by - 17, 8, 1, 0x70c0f0);
  R(g, bx + 12, by - 14, 14, 1, 0x70c0f0);
  R(g, bx + 18, by - 6, 4, 6, 0x3a4244);
  // petits objets imprimes
  R(g, bx + 37, by - 4, 6, 4, 0xff6a13); // vase imprime (orange)
  R(g, bx + 38, by - 7, 4, 3, 0xff6a13);
  R(g, bx + 47, by - 10, 3, 10, 0x38d9f5); // fusee imprimee (cyan)
  R(g, bx + 45, by - 3, 7, 3, 0x38d9f5);
  // lampe articulee
  R(g, bx + 58, by - 2, 8, 2, 0x15191b);
  g.moveTo(bx + 62, by - 2).lineTo(bx + 60, by - 18).lineTo(bx + 68, by - 30).stroke({ width: 2, color: 0x8a929a });
  R(g, bx + 66, by - 32, 8, 5, 0x15191b);
  R(g, bx + 68, by - 28, 4, 3, 0xffe080);
  R(g, bx + 66, by - 25, 10, 4, 0xffe080, 0.12);
  R(g, bx + 64, by - 21, 14, 4, 0xffe080, 0.1);
  R(g, bx + 62, by - 17, 18, 5, 0xffe080, 0.08);

  // chaise de bureau
  const cx = 386;
  const cy = floorY - 52;
  B(g, cx + 2, cy, 14, 18, 0x2b3234); // dossier
  R(g, cx + 6, cy + 5, 6, 2, 0xff7a20);
  B(g, cx - 1, cy + 20, 20, 6, 0x2b3234); // assise
  R(g, cx + 8, cy + 26, 2, 10, 0x6a7476);
  R(g, cx - 2, cy + 36, 22, 2, 0x15191b);
  for (const wx of [-3, 8, 19]) C(g, cx + wx + 1, cy + 39, 2, 0x15191b);

  // rack de bobines (3 etageres)
  const rx = 450;
  const ry = LT + 8;
  const rw = CR - rx;
  const SHELVES = 6; // etageres basses : chacune est pleine de bobines
  const rowH = Math.floor((floorY - ry - 6) / SHELVES);
  B(g, rx, ry, rw, rowH * SHELVES + 2, 0x1c2224);
  for (let r = 0; r < SHELVES; r++) {
    const sy = ry + 3 + r * rowH;
    // bobines serrees, posees sur la planche de l'etagere
    const sr = Math.min(8, Math.floor((rowH - 8) / 2));
    const pitch = 2 * sr + 3;
    for (let s = 0; s < Math.floor((rw - 4) / pitch); s++) {
      const sx = rx + 3 + s * pitch;
      const c = SPOOLS[(s * 2 + r * 3) % SPOOLS.length];
      // bobine vue de face (comme dans PrintFarm) : bride, filament enroule, trou central
      const scx = sx + sr + 1;
      const scy = sy + rowH - 7 - sr;
      C(g, scx, scy, sr + 1, OUT);
      C(g, scx, scy, sr, shade(c, 0.7));
      C(g, scx, scy, sr - 2, c);
      C(g, scx - 1, scy - 2, Math.max(1, Math.floor(sr / 3)), shade(c, 1.3));
      C(g, scx, scy, sr > 6 ? 3 : 2, OUT);
      C(g, scx, scy, sr > 6 ? 2 : 1, 0x1a1e20);
      R(g, scx + sr - 1, scy, 3, 1, c); // bout de filament
    }
    R(g, rx + 1, sy + rowH - 6, rw - 2, 2, 0x6a7476);
  }

  // plante dans le coin
  const plx = rx - 24;
  const ply = floorY - 42;
  B(g, plx + 4, ply + 28, 12, 12, 0x8a4a2c);
  for (const [lx, lyy, lr] of [
    [10, 14, 7],
    [4, 20, 5],
    [16, 20, 5],
    [10, 6, 5],
  ]) {
    C(g, plx + lx, ply + lyy, lr, 0x2f9a4a);
    C(g, plx + lx - 1, ply + lyy - 1, lr - 2, 0x48c060);
  }
}

function drawPrinterFrame(g: Graphics): void {
  g.clear();
  g.rect(0, 0, PF_W, 60).fill(0x1e2127).stroke({ width: 2, color: 0x0c0c0f });
  g.rect(4, 6, PF_W - 8, 44).fill(0x2a2f38);
  g.rect(4, 6, PF_W - 8, 2).fill(0xfff3d6);
  g.rect(6, 8, 2, 40).fill(0x6e737c);
  g.rect(PF_W - 8, 8, 2, 40).fill(0x6e737c);
  g.rect(6, PF_BED, PF_W - 12, 3).fill(0x8c939e);
  g.rect(26, 54, 16, 2).fill(0xff6a13);
  g.rect(30, -10, 12, 12).fill(0x0c0c0f);
  g.rect(31, -9, 10, 10).fill(0x3a3d46);
  g.rect(34, -6, 4, 4).fill(0x16181d);
  // lumiere LED interne + reflets sur le plateau chauffant (aplats)
  g.rect(5, 8, PF_W - 10, 1).fill(0xd8d0b8);
  g.rect(5, 9, PF_W - 10, 3).fill(0x333945);
  g.rect(8, PF_BED - 3, PF_W - 16, 3).fill(0x2a5a6a);
  g.rect(10, PF_BED, 14, 1).fill(0xd0d6de);
  g.rect(6, PF_BED + 2, PF_W - 12, 1).fill(0x16181d);
  // vis du cadre, grille de ventilation, plaque
  for (const [vx, vy] of [[1, 1], [PF_W - 3, 1], [1, 57], [PF_W - 3, 57]]) {
    g.rect(vx, vy, 2, 2).fill(0x7a8486);
  }
  for (let k = 0; k < 4; k++) g.rect(8 + k * 3, 54, 2, 4).fill(0x14161a);
  g.rect(44, 52, 2, 2).fill(0x40ff80);
  // reflet vertical sur le carter + filament depuis la bobine
  g.rect(2, 2, 1, 56).fill(0x4a4f58);
  g.rect(36, 1, 1, 2).fill(0xff6a13);
  g.rect(36, 3, 4, 1).fill(0xff6a13);
  g.rect(40, 4, 4, 1).fill(0xff6a13);
}

// Fonctions de dessin stables (comme PrintFarm) : un `draw` recréé à chaque rendu
// re-dessinerait la pièce vide par-dessus les couches imprimées.
const drawNothing = (): void => {};
function drawPrinterGantry(g: Graphics): void {
  g.clear();
  g.rect(4, 0, PF_W - 8, 2).fill(0x9aa1ab);
}
function drawPrinterHead(g: Graphics): void {
  g.clear();
  g.rect(-5, -4, 10, 6).fill(0xff6a13).stroke({ width: 1, color: 0x0c0c0f });
  g.rect(-1, 2, 2, 2).fill(0xd9d9d9);
}

function PrinterUnit({ i }: { i: number }): ReactNode {
  const job = PRINT_JOBS[i];
  const shapeFn = PF_SHAPES[job.shape];
  const elapsed = useRef(job.start);
  const last = useRef(-1);
  const partRef = useRef<Graphics | null>(null);
  const gantryRef = useRef<Container | null>(null);
  const headRef = useRef<Graphics | null>(null);

  useTick((ticker) => {
    elapsed.current = (elapsed.current + ticker.deltaMS) % (job.dur + PF_HOLD);
    const t = elapsed.current;
    const printing = t < job.dur;
    const layers = printing ? Math.floor((t / job.dur) * PF_LAYERS) : PF_LAYERS;
    const pg = partRef.current;
    if (layers !== last.current && pg) {
      last.current = layers;
      pg.clear();
      for (let l = 0; l < layers; l++) {
        const half = shapeFn(l);
        pg.rect(PF_W / 2 - half, PF_BED - 1 - l, half * 2, 1).fill(l % 2 ? job.color : shade(job.color, 0.8));
      }
      pg.rect(6, 52, 16, 6).fill(0x10262f);
      pg.rect(7, 54, Math.round((14 * layers) / PF_LAYERS), 2).fill(0x38d9f5);
    }
    const gantry = gantryRef.current;
    const head = headRef.current;
    if (!gantry || !head) return;
    gantry.y = PF_BED - 7 - layers;
    head.x = printing ? PF_W / 2 + Math.round(Math.sin(t / 140) * shapeFn(Math.max(0, layers - 1))) : 10;
  });

  return (
    <pixiContainer x={P_X0 + i * P_STEP} y={PY} scale={PS}>
      <pixiGraphics draw={drawPrinterFrame} />
      <pixiGraphics ref={partRef} draw={drawNothing} />
      <pixiContainer ref={gantryRef}>
        <pixiGraphics draw={drawPrinterGantry} />
        <pixiGraphics ref={headRef} y={2} draw={drawPrinterHead} />
      </pixiContainer>
    </pixiContainer>
  );
}

function PrintRoomAnim(): ReactNode {
  return (
    <pixiContainer>
      {[0, 1, 2, 3].map((i) => (
        <PrinterUnit key={i} i={i} />
      ))}
    </pixiContainer>
  );
}

// ---------------------------------------------------------------------------
// Piece 2 : CNC
// ---------------------------------------------------------------------------

const MX = 120; // origine machine CNC
const MW = 200;
const PLATE = { x: 14, y: 22, w: 172, h: 44 };
const CGX = MX + PLATE.x + 92; // engrenage en cours de fraisage
const CGR = 14;

function cncY(h: number): number {
  return Math.round((LT + h - PC) / 2 - 36);
}

function drawCncStatic(g: Graphics, h: number): void {
  const cy = cncY(h);
  const floorY = h - PC;
  floorDetails(g, h, 1);
  groundShadow(g, MX + 2, cy + 92, MW - 4);
  groundShadow(g, 74, cy + 86, 30);
  groundShadow(g, 362, cy + 96, 80);

  // planches debout a gauche
  for (let k = 0; k < 3; k++) {
    B(g, 42 + k * 6, cy + 14 + k * 2, 5, 62 - k * 2, k % 2 ? 0xd2a874 : 0xb98a55);
  }

  // panneau jaune CNC (casque)
  B(g, 44, floorY - 44, 24, 30, 0xf0c020);
  R(g, 46, floorY - 42, 20, 2, OUT);
  C(g, 56, floorY - 32, 6, OUT);
  R(g, 50, floorY - 32, 12, 4, OUT);
  R(g, 51, floorY - 36, 10, 2, 0xf0c020);

  // aspirateur bleu
  shadow(g, 74, cy + 82, 30);
  B(g, 76, cy + 36, 26, 44, 0x2c6fa8);
  R(g, 76, cy + 52, 26, 2, 0x15191b);
  R(g, 78, cy + 38, 2, 40, 0x3a7ab0);
  B(g, 74, cy + 28, 30, 9, 0x2b3234);
  B(g, 84, cy + 20, 10, 8, 0x15191b);
  C(g, 80, cy + 84, 3, 0x15191b);
  C(g, 98, cy + 84, 3, 0x15191b);
  // tuyau annele orange/beige
  const pts: number[] = [89, cy + 20, 89, cy + 6, 100, cy - 2, MX + 14, cy - 2, MX + 20, cy + 10];
  g.poly(pts, false).stroke({ width: 6, color: 0x15191b });
  g.poly(pts, false).stroke({ width: 4, color: 0xc89060 });
  for (let k = 0; k < 9; k++) {
    R(g, 92 + k * 3, cy - 4 + (k > 6 ? 1 : 0), 1, 5, 0xe8d0a8);
  }
  R(g, 89 - 2, cy + 8, 5, 1, 0xe8d0a8);
  R(g, 89 - 2, cy + 12, 5, 1, 0xe8d0a8);

  // fraiseuse a portique : pieds, lit, plaque de bois
  shadow(g, MX + 4, cy + 90, MW - 8);
  R(g, MX + 6, cy + 76, 8, 14, 0x15191b);
  R(g, MX + MW - 14, cy + 76, 8, 14, 0x15191b);
  B(g, MX, cy + 14, MW, 68, 0x23292b);
  B(g, MX + 6, cy + 18, MW - 12, 58, 0x14181a);
  B(g, MX + PLATE.x, cy + PLATE.y, PLATE.w, PLATE.h, 0xc89b6a);
  // pieces decoupees dans la plaque : panneau a croisillon, engrenage (en cours), rondelle
  const px0 = MX + PLATE.x;
  const py0 = cy + PLATE.y;
  R(g, px0 + 9, py0 + 7, 34, 28, CUT);
  R(g, px0 + 10, py0 + 8, 32, 26, WOOD_L);
  R(g, px0 + 25, py0 + 10, 2, 22, CUT);
  R(g, px0 + 12, py0 + 20, 28, 2, CUT);
  for (const [qx, qy] of [[12, 10], [37, 10], [12, 28], [37, 28]]) R(g, px0 + qx, py0 + qy, 3, 3, CUT);
  C(g, px0 + 150, py0 + 22, 10, CUT);
  C(g, px0 + 150, py0 + 22, 9, WOOD_L);
  C(g, px0 + 150, py0 + 22, 3, CUT);
  // veinage du bois + noeuds
  for (let k = 0; k < 7; k++) {
    R(g, px0 + 2 + ((k * 23) % 40), py0 + 4 + k * 6, 40 + ((k * 29) % 60), 1, 0xb48850);
    R(g, px0 + 8 + ((k * 37) % 120), py0 + 6 + k * 6, 22, 1, 0xd4a872);
  }
  C(g, px0 + 80, py0 + 10, 2, 0x9a6a38);
  C(g, px0 + 118, py0 + 34, 2, 0x9a6a38);
  // pinces de maintien de la plaque
  for (const qx of [2, PLATE.w - 6]) {
    R(g, px0 + qx, py0 + 2, 4, 4, 0x8a929a);
    R(g, px0 + qx, py0 + PLATE.h - 6, 4, 4, 0x8a929a);
  }
  // rails lineaires du lit (axe Y) + reflet
  R(g, MX + 8, cy + 19, MW - 16, 2, 0x8a929a);
  R(g, MX + 8, cy + 19, MW - 16, 1, 0xd0d6d6);
  R(g, MX + 8, cy + 72, MW - 16, 2, 0x8a929a);
  R(g, MX + 8, cy + 73, MW - 16, 1, 0x555e60);
  // copeaux (sur la plaque et au sol)
  for (const [qx, qy] of [[48, 6], [60, 38], [120, 36], [132, 10], [168, 38], [4, 36], [72, 4], [100, 40], [26, 40], [146, 4]]) {
    R(g, px0 + qx, py0 + qy, 2, 1, 0xf0d8a8);
  }
  for (const [qx, qy] of [[-6, 98], [10, 100], [34, 97], [78, 99], [120, 98], [168, 100], [200, 97], [216, 99]]) {
    R(g, MX + qx, cy + qy, 2, 1, 0xf0d8a8);
    R(g, MX + qx + 3, cy + qy + 1, 1, 1, 0xd8b888);
  }
  // montants du portique + voyants
  B(g, MX - 3, cy + 8, 8, 70, 0x2b3234);
  B(g, MX + MW - 5, cy + 8, 8, 70, 0x2b3234);
  sheen(g, MX - 3, cy + 8, 8, 70);
  sheen(g, MX + MW - 5, cy + 8, 8, 70);
  rivets(g, MX - 3, cy + 8, 8, 70);
  rivets(g, MX + MW - 5, cy + 8, 8, 70);
  // carter du lit : reflet + plaque + vis + grille ventilation
  R(g, MX + 1, cy + 15, MW - 2, 1, 0x4a5254);
  nameplate(g, MX + 12, cy + 76);
  for (let k = 0; k < 5; k++) R(g, MX + MW - 40 + k * 4, cy + 77, 2, 3, 0x0a0c0d);
  // chaine porte-cable a droite
  for (let k = 0; k < 7; k++) {
    R(g, MX + MW + 4, cy + 12 + k * 4, 4, 3, k % 2 ? 0x3a4244 : 0x4e5759);
  }
  g.poly([MX + MW + 6, cy + 40, MX + MW + 10, cy + 48, MX + MW + 6, cy + 60], false).stroke({ width: 1, color: 0x15191b });
  R(g, MX + MW / 2 - 17, cy + 78, 34, 2, 0x40a0ff);

  // mur d'outils (fraises)
  const tx = 362;
  B(g, tx, LT + 8, 76, 42, 0x1f2526);
  for (let r = 0; r < 2; r++) {
    for (let k = 0; k < 7; k++) {
      const fx = tx + 6 + k * 10;
      const fy = LT + 12 + r * 19;
      R(g, fx, fy, 2, 14, 0xc0c8c8);
      R(g, fx - 1, fy, 4, 4, 0xff9a30);
      R(g, fx - 1, fy + 10, 4, 3, 0x8a929a);
    }
    R(g, tx + 2, LT + 28 + r * 19, 72, 1, 0x4a5254);
  }

  // etabli avec etau bleu et tiroirs
  const bx = 362;
  const by = cy + 44;
  shadow(g, bx, by + 50, 80);
  for (let k = 0; k < 2; k++) {
    const ux = bx + 2 + k * 38;
    B(g, ux, by + 7, 34, 42, 0x2b3234);
    for (let d = 0; d < 3; d++) {
      R(g, ux + 3, by + 10 + d * 13, 28, 10, 0x1a1e20);
      R(g, ux + 12, by + 14 + d * 13, 10, 1, 0x8a929a);
    }
  }
  B(g, bx - 2, by, 80, 7, 0xc08a4a);
  R(g, bx, by + 2, 76, 1, 0xa0703c); // veinage
  R(g, bx + 8, by + 4, 40, 1, 0xd49c60);
  // outils accroches au bord + chiffon
  R(g, bx + 4, by + 8, 1, 5, 0x8a929a);
  R(g, bx + 2, by + 13, 5, 3, 0xff6a30);
  B(g, bx + 48, by - 4, 5, 4, 0xc0c0b0); // chiffon
  B(g, bx + 52, by - 11, 20, 11, 0x2a7ad0); // etau bleu
  R(g, bx + 56, by - 14, 12, 3, 0x8a929a);
  R(g, bx + 70, by - 9, 6, 2, 0x8a929a);
  drawGear(g, bx + 10, by - 6, 6, WOOD_L); // engrenage fini (meme piece que la machine)
  R(g, bx + 24, by - 9, 22, 9, CUT); // panneau a croisillon
  R(g, bx + 25, by - 8, 20, 7, WOOD_L);
  R(g, bx + 34, by - 8, 2, 7, CUT);
  R(g, bx + 25, by - 5, 20, 1, CUT);

  // etageres de planches et bacs a droite
  const sx = 470;
  const sy = LT + 8;
  const sw = CR - sx;
  const rowH = Math.floor((floorY - sy - 6) / 4);
  B(g, sx, sy, sw, rowH * 4 + 2, 0x1c2224);
  // rangee 1 : plaques bois clair + petit bac bleu
  R(g, sx + 3, sy + 4, sw - 6, 4, 0xe0b078);
  R(g, sx + 3, sy + 9, sw - 6, 4, 0xc89b6a);
  B(g, sx + 3, sy + rowH - 6, 12, 2, 0x4a92cc);
  // rangee 2 : planches foncees
  const r2 = sy + rowH;
  R(g, sx + 3, r2 + 4, sw - 6, 5, 0xa8703c);
  R(g, sx + 3, r2 + 10, sw - 6, 5, 0x8a5a2c);
  // rangee 3 : bacs verts / gris
  const r3 = sy + rowH * 2;
  B(g, sx + 4, r3 + 6, 16, 12, 0x4a6a58);
  B(g, sx + 22, r3 + 8, 12, 10, 0x2b3234);
  B(g, sx + 36, r3 + 8, 12, 10, 0x2f4a40);
  // rangee 4 : planches + bacs
  const r4 = sy + rowH * 3;
  R(g, sx + 3, r4 + 3, 18, 8, 0xb98a55);
  B(g, sx + 24, r4 + 5, 12, 10, 0x2b3234);
  B(g, sx + 38, r4 + 5, 10, 10, 0x2f4a40);
  for (let r = 1; r <= 4; r++) R(g, sx + 1, sy + r * rowH - 2, sw - 2, 2, 0x6a7476);
}

// --- trace de coupe : contour d'engrenage (8 dents) en pixels entiers -------
const CNC_CYCLE = 10000;
const CUT_GY_OFF = PLATE.y + 22; // centre de l'engrenage (relatif a cy)

function buildGearPath(): number[][] {
  const pts: number[][] = [];
  for (let k = 0; k < 8; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 4;
    for (const [da, rr] of [
      [-0.3, CGR - 4],
      [-0.18, CGR],
      [0.18, CGR],
      [0.3, CGR - 4],
    ]) {
      pts.push([Math.round(Math.cos(a + da) * rr), Math.round(Math.sin(a + da) * rr)]);
    }
  }
  pts.push(pts[0]);
  const out: number[][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s < n; s++) {
      const px = Math.round(x0 + ((x1 - x0) * s) / n);
      const py = Math.round(y0 + ((y1 - y0) * s) / n);
      const last = out[out.length - 1];
      if (!last || last[0] !== px || last[1] !== py) out.push([px, py]);
    }
  }
  out.push(out[0]);
  return out;
}
const GEAR_PATH = buildGearPath();

// Fonctions de dessin STABLES (module-level) : un draw inline serait rejoue au
// re-rendu et effacerait le dessin impératif fait dans useTick.
function drawCncBeam(g: Graphics): void {
  g.clear();
  R(g, 0, -1, MW + 4, 8, OUT);
  R(g, 0, 0, MW + 4, 5, 0x8a929a);
  R(g, 0, 0, MW + 4, 1, 0xd0d6d6);
  R(g, 0, 4, MW + 4, 1, 0x555e60);
  R(g, MW - 16, 1, 10, 3, 0xff9a30);
  for (const rx of [6, 50, 100, 150, MW - 6]) R(g, rx, 2, 2, 2, 0x3a4244); // vis
  // bande LED blanc chaud sous le portique
  R(g, 3, 5, MW - 2, 1, 0xfff4d0);
  R(g, 3, 6, MW - 2, 1, 0xe8c878);
}
function drawCncSpindle(g: Graphics): void {
  g.clear();
  R(g, -1, -3, 14, 12, OUT);
  R(g, 0, -2, 12, 10, 0x3a4244);
  R(g, 0, -2, 12, 1, 0x6a7476);
  R(g, 1, -1, 1, 8, 0x4e5759); // arete claire carter
  R(g, 9, 1, 2, 2, 0x40ff80); // voyant
  R(g, 1, 6, 10, 1, 0x15191b); // ventilation
  R(g, 3, 7, 6, 2, 0x8a929a); // porte-pince
  R(g, 4, 8, 4, 4, 0xe8e8e8);
  R(g, 4, 8, 1, 4, 0xffffff);
  R(g, 5, 12, 2, 4, 0xffb830);
  R(g, 5, 14, 2, 1, 0xc08010); // cannelure fraise
}
function drawCncTip(g: Graphics): void {
  g.clear();
  C(g, 0, 0, 2, 0xffd060);
  R(g, 0, 0, 1, 1, 0xffffff);
}

interface Chip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  c: number;
}

function CncAnim({ h }: { h: number }): ReactNode {
  const beam = useRef<Graphics | null>(null);
  const spindle = useRef<Graphics | null>(null);
  const tip = useRef<Graphics | null>(null);
  const cutRef = useRef<Graphics | null>(null);
  const fxRef = useRef<Graphics | null>(null);
  const lastKey = useRef(-1);
  const chips = useRef<Chip[]>([]);
  const lastT = useRef(0);
  const cy = cncY(h);
  const gy = cy + CUT_GY_OFF;

  useTick(() => {
    const now = performance.now();
    const dt = Math.min(64, lastT.current ? now - lastT.current : 16);
    lastT.current = now;
    const t = now % CNC_CYCLE;
    const q = t / CNC_CYCLE;
    // phases : descente 0-.08, coupe .08-.78, remontee .78-.86, piece .86-.93, trou .93-1
    const cutting = q >= 0.08 && q < 0.78;
    const prog = q < 0.08 ? 0 : q >= 0.78 ? 1 : (q - 0.08) / 0.7;
    const idx = Math.min(GEAR_PATH.length - 1, Math.floor(prog * (GEAR_PATH.length - 1)));
    const lift = q < 0.08 ? 6 * (1 - q / 0.08) : q >= 0.78 ? Math.min(6, ((q - 0.78) / 0.08) * 6) : 0;
    const stage = q < 0.78 ? 0 : q < 0.93 ? 1 : 2;
    const [ox, oy] = GEAR_PATH[idx];
    const tipX = CGX + ox;
    const tipY = gy + oy;

    // trace de coupe (redessinee seulement quand elle change)
    const key = stage * 1000 + (stage === 0 ? idx : 0);
    const c = cutRef.current;
    if (c && key !== lastKey.current) {
      lastKey.current = key;
      c.clear();
      if (stage === 1) {
        C(c, CGX, gy, CGR - 2, WOOD_L);
        for (let k = 0; k < 8; k++) {
          const a = -Math.PI / 2 + (k * Math.PI) / 4;
          R(c, Math.round(CGX + Math.cos(a) * (CGR - 2)) - 2, Math.round(gy + Math.sin(a) * (CGR - 2)) - 2, 5, 5, WOOD_L);
        }
        C(c, CGX, gy, 3, CUT);
      }
      const n = stage === 0 ? idx : GEAR_PATH.length - 1;
      for (let i = 0; i < n; i++) {
        const [px, py] = GEAR_PATH[i];
        R(c, CGX + px - 1, gy + py - 1, 2, 2, stage === 2 ? 0x3a1c06 : CUT);
      }
      if (stage === 2) {
        C(c, CGX, gy, CGR - 3, 0x3a1c06); // trou : piece retiree
        C(c, CGX, gy, CGR - 5, CUT);
      }
    }

    // copeaux : emission pendant la coupe, balistique simple
    const list = chips.current;
    if (cutting && list.length < 36) {
      for (let k = 0; k < 2; k++) {
        list.push({
          x: tipX,
          y: tipY,
          vx: (Math.random() - 0.5) * 0.12,
          vy: -0.04 - Math.random() * 0.1,
          life: 350 + Math.random() * 300,
          c: Math.random() < 0.5 ? 0xf0d8a8 : 0xd8b888,
        });
      }
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      p.vy += 0.0004 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0 || p.y > cy + 70) list.splice(i, 1);
    }

    // lumiere : zone eclairee par la LED, halo de fraise, voyants
    const fx = fxRef.current;
    const by = tipY - 16;
    if (fx) {
      fx.clear();
      const px0 = MX + PLATE.x;
      const py0 = cy + PLATE.y;
      const y0 = Math.max(py0, by + 7);
      const y1 = Math.min(py0 + PLATE.h, by + 19);
      if (y1 > y0) {
        R(fx, px0, y0, PLATE.w, Math.min(5, y1 - y0), 0xfff4d0, 0.14);
        if (y1 - y0 > 5) R(fx, px0, y0 + 5, PLATE.w, y1 - y0 - 5, 0xfff4d0, 0.07);
      }
      if (cutting) {
        const fl = 0.75 + 0.25 * Math.sin(now / 70);
        C(fx, tipX, tipY, 9, 0xffa030, 0.1 * fl);
        C(fx, tipX, tipY, 6, 0xffb840, 0.16 * fl);
        C(fx, tipX, tipY, 3, 0xffd060, 0.3 * fl);
      }
      for (const p of list) R(fx, Math.round(p.x), Math.round(p.y), 2, 1, p.c);
      // voyants des montants : vert fixe-clignotant, orange alterne
      const on = Math.floor(now / 500) % 2 === 0;
      const lamp = (x: number, y: number, col: number, lit: boolean) => {
        R(fx, x - 1, y - 1, 4, 4, OUT);
        R(fx, x, y, 2, 2, lit ? col : 0x3a3020);
      };
      lamp(MX, cy + 24, 0x40ff80, cutting || on);
      lamp(MX, cy + 30, 0xffa030, !on && cutting);
      lamp(MX + MW - 2, cy + 24, 0xffa030, cutting ? on : false);
      lamp(MX + MW - 2, cy + 30, 0x40ff80, !cutting || !on);
    }

    if (beam.current) beam.current.y = by;
    if (spindle.current) {
      spindle.current.x = tipX - 6;
      spindle.current.y = by - lift;
    }
    if (tip.current) {
      tip.current.x = tipX;
      tip.current.y = tipY - lift;
      tip.current.alpha = cutting ? 0.5 + 0.5 * Math.abs(Math.sin(now / 60)) : 0;
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={cutRef} draw={drawNothing} />
      <pixiGraphics ref={fxRef} draw={drawNothing} />
      <pixiGraphics ref={beam} x={MX - 2} y={cy + PLATE.y} draw={drawCncBeam} />
      <pixiGraphics ref={spindle} x={MX + PLATE.x} y={cy + PLATE.y} draw={drawCncSpindle} />
      <pixiGraphics ref={tip} draw={drawCncTip} />
    </pixiContainer>
  );
}

// ---------------------------------------------------------------------------
// Piece 3 : laser CO2 xTool
// ---------------------------------------------------------------------------

const LX = 116;
const LW = 190;
const HOOD = { x: 6, y: 10, w: 178, h: 28 };

function laserY(h: number): number {
  return Math.round((LT + h - PC) / 2 - 18);
}

function drawLaserStatic(g: Graphics, h: number): void {
  const ly = laserY(h);
  const floorY = h - PC;
  floorDetails(g, h, 2);
  groundShadow(g, LX + 2, ly + 67, LW - 4);
  groundShadow(g, 40, floorY - 8, 56);

  // conduit gris d'extraction : monte puis part vers la droite
  const duct = [LX + LW - 28, ly, LX + LW - 28, 52, LX + LW - 18, 42, LX + LW + 36, 42];
  g.poly(duct, false).stroke({ width: 12, color: OUT });
  g.poly(duct, false).stroke({ width: 10, color: 0x7a8286 });
  g.poly(duct, false).stroke({ width: 3, color: 0xc8cfcf });
  for (let y = 54; y < ly - 2; y += 6) R(g, LX + LW - 33, y, 11, 1, 0x3a4244);
  for (let x = LX + LW - 10; x < LX + LW + 34; x += 6) R(g, x, 37, 1, 10, 0x3a4244);
  B(g, LX + LW + 36, 33, 18, 18, 0x2b3234);
  R(g, LX + LW + 40, 37, 10, 10, 0x15191b);

  // extincteur rouge
  B(g, 46, LT + 18, 12, 30, 0xd02a22);
  B(g, 48, LT + 12, 8, 6, 0x15191b);
  R(g, 49, LT + 28, 6, 10, 0xf0f0f0);
  R(g, 50, LT + 31, 4, 1, 0xd02a22);
  R(g, 50, LT + 34, 4, 1, 0xd02a22);
  R(g, 58, LT + 14, 3, 2, 0x15191b);

  // compresseur AIR
  const ay = floorY - 46;
  shadow(g, 40, ay + 36, 56);
  C(g, 46, ay + 36, 3, OUT);
  C(g, 90, ay + 36, 3, OUT);
  B(g, 40, ay + 12, 52, 22, 0x2b3234);
  R(g, 42, ay + 14, 48, 2, 0x555e60);
  B(g, 46, ay, 16, 12, 0x3a4244);
  B(g, 64, ay + 4, 12, 8, 0x2b3234);
  R(g, 86, ay + 8, 6, 4, 0xff7a20);

  // machine xTool
  shadow(g, LX, ly + 66, LW);
  B(g, LX, ly, LW, 64, 0x23292b);
  R(g, LX + 2, ly + 2, LW - 4, 2, 0x4a5254);
  sheen(g, LX, ly, LW, 64);
  rivets(g, LX, ly, LW, 64);
  // tube laser CO2 sur le dessus + optique/miroir
  R(g, LX + 14, ly + 5, 92, 4, OUT);
  R(g, LX + 15, ly + 6, 90, 2, 0x6aa0b8);
  R(g, LX + 15, ly + 6, 90, 1, 0xa8d0e0);
  R(g, LX + 12, ly + 4, 3, 6, 0x8a929a);
  R(g, LX + 106, ly + 4, 3, 6, 0x8a929a);
  R(g, LX + 109, ly + 6, 4, 2, 0xe03a3a);
  // fumee legere de l'extraction
  R(g, LX + LW + 38, 26, 12, 4, 0xc8cfcf, 0.12);
  R(g, LX + LW + 44, 19, 8, 3, 0xc8cfcf, 0.09);
  R(g, LX + LW + 37, 12, 6, 3, 0xc8cfcf, 0.07);
  R(g, LX + HOOD.x - 2, ly + HOOD.y - 2, HOOD.w + 4, HOOD.h + 4, OUT);
  R(g, LX + HOOD.x, ly + HOOD.y, HOOD.w, HOOD.h, 0x1a1008);
  R(g, LX + HOOD.x + 2, ly + HOOD.y + 2, HOOD.w - 4, HOOD.h - 4, 0xd87828);
  R(g, LX + HOOD.x + 2, ly + HOOD.y + 2, HOOD.w - 4, 3, 0xf0b068);
  R(g, LX + HOOD.x + 2, ly + HOOD.y + HOOD.h - 5, HOOD.w - 4, 3, 0x8a4414);
  // plaque de bois vierge sous le capot (les decoupes sont animees dans LaserAnim)
  const hx = LX + HOOD.x;
  const hy = ly + HOOD.y;
  R(g, hx + 6, hy + 5, HOOD.w - 12, 18, 0xd8a060);
  R(g, hx + 6, hy + 5, HOOD.w - 12, 1, 0xf0c890);
  for (let k = 0; k < 3; k++) R(g, hx + 10 + k * 7, hy + 8 + k * 6, HOOD.w - 40, 1, 0xc89850);
  // rails du portique laser + vis
  R(g, hx + 2, hy + 3, HOOD.w - 4, 1, 0x8a929a);
  R(g, hx + 2, hy + HOOD.h - 4, HOOD.w - 4, 1, 0x555e60);
  // reflet du capot translucide (diagonales)
  for (let k = 0; k < 10; k++) {
    R(g, hx + 30 - k * 2, hy + 4 + k * 2, 4, 2, 0xf0c890);
    R(g, hx + 44 - k * 2, hy + 4 + k * 2, 2, 2, 0xf0c890);
  }
  // etiquette xTool + panneau bas
  R(g, LX + 6, ly + 42, LW - 12, 18, 0x15191b);
  R(g, LX + 6, ly + 42, LW - 12, 1, 0x3a4244);
  R(g, LX + LW / 2 - 20, ly + 43, 40, 11, 0x0a0c0d);
  R(g, LX + LW - 18, ly + 4, 5, 4, 0xe03a3a);
  R(g, LX + LW - 10, ly + 4, 3, 4, 0x40ff80);
  nameplate(g, LX + 10, ly + 46);
  for (let k = 0; k < 6; k++) R(g, LX + 24 + k * 3, ly + 56, 2, 4, 0x0a0c0d); // grille ventilateur
  R(g, LX + LW - 24, ly + 56, 4, 4, 0x40a0ff); // voyant
  R(g, LX + 10, ly + 56, 4, 6, OUT);
  R(g, LX + LW - 14, ly + 62, 6, 4, OUT);

  // etageres de panneaux et bacs
  const sx = LX + LW + 64;
  const sy = LT + 28;
  B(g, sx, sy, 70, 66, 0x1c2224);
  R(g, sx + 2, sy + 22, 66, 2, 0x6a7476);
  R(g, sx + 2, sy + 44, 66, 2, 0x6a7476);
  B(g, sx + 4, sy + 4, 22, 14, 0x7fa0b0); // bac transparent
  R(g, sx + 6, sy + 6, 18, 3, 0xa8c8d8);
  R(g, sx + 32, sy + 6, 32, 5, 0xc89b6a); // panneaux bois
  R(g, sx + 32, sy + 12, 32, 5, 0xa8703c);
  R(g, sx + 4, sy + 27, 28, 5, 0xe0b078);
  R(g, sx + 4, sy + 33, 28, 5, 0xc89b6a);
  R(g, sx + 38, sy + 27, 26, 5, 0xb98a55);
  R(g, sx + 38, sy + 33, 26, 5, 0x8a5a2c);
  B(g, sx + 4, sy + 49, 16, 12, 0x2f6a46);
  B(g, sx + 24, sy + 51, 16, 10, 0x2b3234);
  B(g, sx + 44, sy + 51, 18, 10, 0x2f4a40);

  // panneau triangle jaune LASER
  const tx = CR - 44;
  g.poly([tx, LT + 8, tx + 22, LT + 46, tx - 22, LT + 46]).fill(OUT);
  g.poly([tx, LT + 12, tx + 18, LT + 43, tx - 18, LT + 43]).fill(0xf0c020);
  C(g, tx, LT + 33, 3, OUT);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    R(g, Math.round(tx + Math.cos(a) * 6), Math.round(LT + 33 + Math.sin(a) * 6), 2, 2, OUT);
  }
  B(g, tx - 20, LT + 48, 40, 14, 0xf0c020);

  // grande table avec pieces decoupees
  const TB = LX + LW + 28;
  const ty = floorY - 64;
  shadow(g, TB - 2, floorY - 8, 196);
  R(g, TB + 2, ty + 18, 4, 40, 0x3a2a1c);
  R(g, TB + 186, ty + 18, 4, 40, 0x3a2a1c);
  R(g, TB + 4, ty + 40, 184, 2, 0x3a2a1c);
  groundShadow(g, TB, floorY - 2, 200);
  B(g, TB, ty, 200, 20, 0xc89b6a);
  for (let k = 0; k < 3; k++) R(g, TB + 2 + k * 9, ty + 4 + k * 5, 150, 1, 0xb48850);
  // chutes + chiffon + bidon sur la table / dessous
  B(g, TB + 100, floorY - 14, 10, 14, 0xd0a020);
  R(g, TB + 101, floorY - 8, 8, 3, 0x15191b);
  B(g, TB + 120, floorY - 8, 12, 8, 0xb8b0a0);
  // engrenage (meme piece que sur la CNC et dans le laser)
  C(g, TB + 22, ty + 9, 9, CUT);
  drawGear(g, TB + 22, ty + 9, 7, WOOD_L);
  // motif carre
  B(g, TB + 64, ty + 3, 28, 14, 0xe0b078);
  R(g, TB + 66, ty + 5, 24, 10, 0xc89b6a);
  R(g, TB + 77, ty + 3, 2, 14, 0x7a5a38);
  R(g, TB + 64, ty + 9, 28, 2, 0x7a5a38);
  // silhouette de chien
  const dx = TB + 130;
  const dy = ty + 4;
  R(g, dx - 1, dy - 1, 32, 14, 0x7a5a38);
  drawDog(g, dx, dy, WOOD_L);
  // chute : plaque percee des formes decoupees
  B(g, TB + 170, ty + 2, 26, 16, 0xa8703c);
  C(g, TB + 179, ty + 10, 4, CUT);
  R(g, TB + 186, ty + 7, 7, 7, CUT);
  // petit caisson de tiroirs
  B(g, TB + 204, ty + 14, 16, 44, 0x2b3234);
  R(g, TB + 206, ty + 18, 12, 14, 0x1a1e20);
  R(g, TB + 206, ty + 35, 12, 14, 0x1a1e20);
  R(g, TB + 209, ty + 24, 6, 1, 0x8a929a);
  R(g, TB + 209, ty + 41, 6, 1, 0x8a929a);
}

// Contour du chien (coordonnees locales de drawDog), sommets dans le sens horaire.
const DOG_OUTLINE: [number, number][] = [
  [-3, 0], [1, 0], [1, 2], [18, 2], [18, 0], [19, 0], [19, -2], [22, -2], [22, 0], [26, 0],
  [26, 2], [29, 2], [29, 5], [26, 5], [26, 6], [20, 6], [20, 12], [17, 12], [17, 8], [16, 8],
  [16, 12], [13, 12], [13, 8], [9, 8], [9, 12], [6, 12], [6, 8], [4, 8], [4, 12], [1, 12],
  [1, 8], [0, 8], [0, 3], [-3, 3], [-3, 0],
];
// Points du trace, 1 px d'ecart, boucle fermee (dernier point = premier).
const DOG_PATH: [number, number][] = (() => {
  const pts: [number, number][] = [[DOG_OUTLINE[0][0], DOG_OUTLINE[0][1]]];
  for (let i = 1; i < DOG_OUTLINE.length; i++) {
    const [x0, y0] = DOG_OUTLINE[i - 1];
    const [x1, y1] = DOG_OUTLINE[i];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    const sx = Math.sign(x1 - x0);
    const sy = Math.sign(y1 - y0);
    for (let k = 1; k <= n; k++) pts.push([x0 + sx * k, y0 + sy * k]);
  }
  return pts;
})();

// Cycle laser (ms) : plaque vierge, decoupe, retour + mise en valeur, retrait.
const L_BLANK = 1000;
const L_MOVE = 600; // tete : repos -> debut du trace
const L_CUT = 5400;
const L_SHOW = 2000;
const L_BACK = 800; // tete : fin -> repos (dans L_SHOW)
const L_TAKE = 600;
const L_CYCLE = L_BLANK + L_MOVE + L_CUT + L_SHOW + L_TAKE;

function drawLaserGantry(g: Graphics): void {
  g.clear();
  R(g, 0, 0, HOOD.w - 8, 1, 0x8a929a);
  R(g, 0, 1, HOOD.w - 8, 1, 0x555e60);
}

function drawLaserHead(g: Graphics): void {
  g.clear();
  R(g, -3, -5, 7, 4, OUT);
  R(g, -2, -4, 5, 2, 0x4a5254);
  R(g, -2, -4, 5, 1, 0xa8b0b4);
  R(g, 0, -1, 1, 1, 0xe03a3a);
}

function drawLaserBeam(g: Graphics): void {
  g.clear();
  R(g, 0, -1, 1, 1, 0xff4a28);
}

function drawLaserSpark(g: Graphics): void {
  g.clear();
  R(g, -2, -2, 5, 5, 0xff8a28, 0.3);
  R(g, -1, -1, 3, 3, 0xff6a20);
  R(g, 0, 0, 1, 1, 0xfff2c0);
}

function drawLaserGlow(g: Graphics): void {
  g.clear();
  drawDog(g, -1, 0, 0xffa030);
  drawDog(g, 1, 0, 0xffa030);
  drawDog(g, 0, -1, 0xffa030);
  drawDog(g, 0, 1, 0xffa030);
}

function drawLaserPiece(g: Graphics): void {
  g.clear();
  drawDog(g, 0, 0, 0xf6cc84);
  R(g, 1, 2, 18, 1, 0xfce6b0);
}

function LaserAnim({ h }: { h: number }): ReactNode {
  const trace = useRef<Graphics | null>(null);
  const glow = useRef<Graphics | null>(null);
  const piece = useRef<Graphics | null>(null);
  const fx = useRef<Graphics | null>(null);
  const gantry = useRef<Graphics | null>(null);
  const head = useRef<Graphics | null>(null);
  const beam = useRef<Graphics | null>(null);
  const spark = useRef<Graphics | null>(null);
  const lastN = useRef(-1);
  const ly = laserY(h);
  const hx = LX + HOOD.x;
  const hy = ly + HOOD.y;
  const dx = hx + 76;
  const dy = hy + 9;
  const restX = hx + 12;
  const restY = hy + 9;

  useTick(() => {
    const now = performance.now();
    const t = now % L_CYCLE;
    const last = DOG_PATH.length - 1;
    const startX = dx + DOG_PATH[0][0];
    const startY = dy + DOG_PATH[0][1];

    let n = 0; // points de trace reveles
    let hX = restX;
    let hY = restY;
    let cutting = false;
    let showPiece = false;
    let take = 0;
    const tCut0 = L_BLANK + L_MOVE;
    const tShow0 = tCut0 + L_CUT;
    const tTake0 = tShow0 + L_SHOW;
    if (t < L_BLANK) {
      // plaque vierge
    } else if (t < tCut0) {
      const p = (t - L_BLANK) / L_MOVE;
      hX = Math.round(restX + (startX - restX) * p);
      hY = Math.round(restY + (startY - restY) * p);
    } else if (t < tShow0) {
      const idx = Math.min(last, Math.floor(((t - tCut0) / L_CUT) * (last + 1)));
      n = idx + 1;
      hX = dx + DOG_PATH[idx][0];
      hY = dy + DOG_PATH[idx][1];
      cutting = true;
    } else {
      n = last + 1;
      showPiece = true;
      const p = Math.min(1, (t - tShow0) / L_BACK);
      hX = Math.round(startX + (restX - startX) * p);
      hY = Math.round(startY + (restY - startY) * p);
      if (t >= tTake0) take = (t - tTake0) / L_TAKE;
    }

    const tr = trace.current;
    if (tr && n !== lastN.current) {
      lastN.current = n;
      tr.clear();
      for (let i = 0; i < n; i++) R(tr, dx + DOG_PATH[i][0], dy + DOG_PATH[i][1], 1, 1, CUT);
    }
    if (tr) tr.alpha = 1 - take;
    if (piece.current) {
      piece.current.visible = showPiece;
      piece.current.alpha = 1 - take;
      piece.current.y = dy - Math.round(take * 4);
    }
    if (glow.current) {
      glow.current.visible = showPiece;
      glow.current.alpha = (0.35 + 0.25 * Math.sin(now / 250)) * (1 - take);
      glow.current.y = dy - Math.round(take * 4);
    }

    // fumee discrete (deterministe) pendant la coupe
    const f = fx.current;
    if (f) {
      f.clear();
      if (cutting) {
        for (let i = 0; i < 4; i++) {
          const ph = (now / 1600 + i / 4) % 1;
          const py = hY - 2 - Math.round(ph * 7);
          if (py > hy + 3) R(f, hX + Math.round(Math.sin(i * 2.1) * 2), py, 2, 2, 0xd8d8d0, 0.28 * (1 - ph));
        }
      }
    }

    if (gantry.current) gantry.current.y = hY - 1;
    if (head.current) {
      head.current.x = hX;
      head.current.y = hY;
    }
    if (beam.current) {
      beam.current.x = hX;
      beam.current.y = hY;
      beam.current.visible = cutting;
    }
    if (spark.current) {
      spark.current.x = hX;
      spark.current.y = hY;
      spark.current.visible = cutting;
      spark.current.alpha = 0.75 + 0.25 * Math.sin(now / 60);
    }
  });

  return (
    <pixiContainer>
      <pixiGraphics ref={glow} x={dx} y={dy} visible={false} draw={drawLaserGlow} />
      <pixiGraphics ref={piece} x={dx} y={dy} visible={false} draw={drawLaserPiece} />
      <pixiGraphics ref={trace} draw={drawNothing} />
      <pixiGraphics ref={fx} draw={drawNothing} />
      <pixiGraphics ref={gantry} x={hx + 4} y={restY - 1} draw={drawLaserGantry} />
      <pixiGraphics ref={beam} x={restX} y={restY} visible={false} draw={drawLaserBeam} />
      <pixiGraphics ref={head} x={restX} y={restY} draw={drawLaserHead} />
      <pixiGraphics ref={spark} x={restX} y={restY} visible={false} draw={drawLaserSpark} />
    </pixiContainer>
  );
}

// ---------------------------------------------------------------------------
// Assemblage
// ---------------------------------------------------------------------------

const FLOORS = [0x2f3536, 0x35332d, 0x2c3239];
const TITLES = [
  "IMPRESSION 3D",
  "ESPACE CNC / DECOUPE",
  "ESPACE DECOUPE LASER CO2 (xTool)",
];

export function WorkshopRooms({
  x,
  y,
  height,
}: {
  x: number;
  y: number;
  height: number;
}): ReactNode {
  const h = height / 3;
  const hc = h / K; // hauteur dans le repere contenu
  const shell = useCallback(
    (i: number) => (g: Graphics) => {
      g.clear();
      drawShell(g, h, FLOORS[i], i === 0);
    },
    [h],
  );
  const content = useCallback(
    (i: number) => (g: Graphics) => {
      g.clear();
      if (i === 0) drawPrintersStatic(g, hc);
      else if (i === 1) drawCncStatic(g, hc);
      else drawLaserStatic(g, hc);
    },
    [hc],
  );

  return (
    <pixiContainer x={x} y={y}>
      {[0, 1, 2].map((i) => {
        const plateW = Math.min(TITLES[i].length * 8 + 22, ROOMS_W - WALL_R - 60);
        const aY = hc - PC - 46;
        return (
          <pixiContainer key={i} y={i * h}>
            <pixiGraphics draw={shell(i)} />
            <pixiContainer scale={K}>
              <pixiGraphics draw={content(i)} />
              {i === 0 && <PrintRoomAnim />}
              {i === 1 && <CncAnim h={hc} />}
              {i === 2 && <LaserAnim h={hc} />}
              {i === 1 && (
                <pixiText text="CNC" x={49} y={hc - PC - 24} style={LABEL_STYLE} resolution={2} />
              )}
              {i === 2 && (
                <>
                  <pixiText text="AIR" x={57} y={aY + 17} style={LABEL_LIGHT} resolution={2} />
                  <pixiText text="LASER" x={CR - 62} y={LT + 51} style={LABEL_STYLE} resolution={2} />
                  <pixiText
                    text="xTool"
                    x={LX + LW / 2 - 16}
                    y={laserY(hc) + 44}
                    style={LABEL_LIGHT}
                    resolution={2}
                  />
                </>
              )}
            </pixiContainer>
            <pixiGraphics
              x={44}
              y={4}
              draw={(g: Graphics) => {
                g.clear();
                drawSignPlate(g, plateW);
              }}
            />
            <pixiText text={TITLES[i]} x={54} y={5} style={SIGN_STYLE} resolution={2} />
          </pixiContainer>
        );
      })}
    </pixiContainer>
  );
}
