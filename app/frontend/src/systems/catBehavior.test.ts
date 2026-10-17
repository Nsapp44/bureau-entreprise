import { describe, it, expect } from "vitest";
import { NavigationGrid } from "./navigationGrid";
import { isFreeFloor } from "./dogBehavior";
import {
  CAT_FOOD_STAND,
  CAT_PLAY_CENTER,
  CAT_SLEEP_SPOTS,
  CAT_SOFA_SPOT,
  CAT_TREE_BASE,
  CAT_WATER_STAND,
} from "@/constants/positions";
import {
  CAT_NIGHT_SLEEP_FACTOR,
  CAT_PLAY_CHANCE,
  CAT_SLEEP_MAX_S,
  catPose,
  sleepScaleFor,
  createCats,
  standPoint,
  stepCats,
  type CatState,
} from "./catBehavior";
import catData from "@/constants/officeCats.json";

const grid = new NavigationGrid();

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function cats(rng = seeded(1)): CatState[] {
  const c = createCats(grid, rng);
  expect(c).not.toBeNull();
  return c!;
}

function run(c: CatState[], seconds: number, rng: () => number): void {
  for (let t = 0; t < seconds * 20; t++) stepCats(c, 50, grid, rng);
}

describe("sprites", () => {
  it("toutes les images ont des lignes de même largeur", () => {
    for (const frame of catData.frames) {
      const w = frame[0].length;
      for (const row of frame) expect(row.length).toBe(w);
    }
  });
  it("chaque caractère non transparent existe dans les deux palettes", () => {
    for (const cat of catData.cats) {
      for (const frame of catData.frames)
        for (const row of frame)
          for (const ch of row)
            if (ch !== ".") expect(cat.palette).toHaveProperty(ch);
    }
  });
});

describe("décor des chats", () => {
  it("les points de repas, de jeu et le pied de l'arbre sont sur du sol libre", () => {
    for (const p of [
      CAT_WATER_STAND,
      CAT_FOOD_STAND,
      CAT_TREE_BASE,
      CAT_PLAY_CENTER,
    ]) {
      const g = grid.worldToGrid(p.x, p.y);
      expect(isFreeFloor(grid, g.gx, g.gy)).toBe(true);
    }
  });
  it("les niches ne sont pas sur le sol marchable", () => {
    for (const p of CAT_SLEEP_SPOTS) {
      const g = grid.worldToGrid(p.x, p.y);
      expect(isFreeFloor(grid, g.gx, g.gy)).toBe(false);
    }
    expect(standPoint(grid, CAT_TREE_BASE, Math.random)).not.toBeNull();
  });
});

describe("stepCats", () => {
  it("les deux chats démarrent endormis dans leur niche", () => {
    const c = cats();
    expect(c).toHaveLength(2);
    c.forEach((cat, i) => {
      expect(cat.mode).toBe("sleep");
      expect(catPose(cat)).toBe(2);
      expect({ x: cat.x, y: cat.y }).toEqual(CAT_SLEEP_SPOTS[i]);
    });
  });

  it("dorment tant que le minuteur n'est pas écoulé", () => {
    const c = cats();
    c.forEach((cat) => (cat.timer = 1000));
    run(c, 60, seeded(2));
    expect(c.every((cat) => cat.mode === "sleep")).toBe(true);
  });

  it("un chat réveillé avec un tirage haut va boire puis remonte dormir", () => {
    const c = cats();
    c[0].timer = 0;
    c[1].timer = 1000;
    const rng = () => CAT_PLAY_CHANCE + 0.1; // boire
    stepCats(c, 50, grid, rng);
    expect(c[0].mode).toBe("walk");
    expect(c[0].goal).toBe("drink");
    expect(c[1].mode).toBe("sleep");
    const modes = new Set<string>();
    for (let t = 0; t < 20 * 120; t++) {
      stepCats(c, 50, grid, rng);
      modes.add(c[0].mode);
      if (c[0].mode === "sleep") break;
    }
    expect(modes.has("drink")).toBe(true);
    expect(c[0].mode).toBe("sleep");
    expect({ x: c[0].x, y: c[0].y }).toEqual(CAT_SLEEP_SPOTS[0]);
  });

  it("un tirage bas réveille les deux chats pour jouer ensemble", () => {
    const c = cats();
    c[0].timer = 0;
    c[1].timer = 1000;
    stepCats(c, 50, grid, () => 0);
    expect(c.map((cat) => cat.goal)).toEqual(["play", "play"]);
    const modes = new Set<string>();
    for (let t = 0; t < 20 * 200; t++) {
      stepCats(c, 50, grid, seeded(t + 3));
      c.forEach((cat) => modes.add(cat.mode));
      if (c.every((cat) => cat.mode === "sleep")) break;
    }
    expect(modes.has("play")).toBe(true);
    expect(c.every((cat) => cat.mode === "sleep")).toBe(true);
  });

  it("ne lance pas de jeu si l'autre chat est déjà debout", () => {
    const c = cats();
    c[1].mode = "eat";
    c[1].timer = 1000;
    c[0].timer = 0;
    stepCats(c, 50, grid, () => 0);
    expect(c[0].goal).not.toBe("play");
  });

  it("sur une longue durée ils dorment environ 40 % du temps", () => {
    const c = cats(seeded(7));
    const rng = seeded(11);
    let asleep = 0;
    let total = 0;
    for (let t = 0; t < 20 * 3600; t++) {
      stepCats(c, 50, grid, rng);
      for (const cat of c) {
        total++;
        if (cat.mode === "sleep") asleep++;
      }
    }
    const share = asleep / total;
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.5);
    expect(CAT_SLEEP_MAX_S).toBeGreaterThan(0);
  });

  it("les chats debout restent sur du sol libre", () => {
    const c = cats(seeded(5));
    const rng = seeded(9);
    for (let t = 0; t < 20 * 1800; t++) {
      stepCats(c, 50, grid, rng);
      for (const cat of c) {
        if (cat.mode === "sleep") continue;
        const g = grid.worldToGrid(cat.x, cat.y);
        expect(isFreeFloor(grid, g.gx, g.gy)).toBe(true);
      }
    }
  });

  it("va voir un agent qui attend, s'assoit près de lui puis remonte dormir", () => {
    const c = cats();
    const target = { x: 400, y: 300 };
    c[0].timer = 0;
    c[1].timer = 1000;
    stepCats(c, 50, grid, () => 0, [target]);
    expect(c[0].goal).toBe("visit");
    let sat = false;
    for (let t = 0; t < 20 * 200 && !(sat && c[0].mode === "sleep"); t++) {
      stepCats(c, 50, grid, seeded(t + 5), [target]);
      c[1].timer = 1000;
      if (c[0].mode === "sit") {
        sat = true;
        expect(Math.hypot(c[0].x - target.x, c[0].y - target.y)).toBeLessThan(
          160,
        );
      }
    }
    expect(sat).toBe(true);
  });

  it("sans agent qui attend, aucun chat ne va en visite", () => {
    const c = cats();
    c[0].timer = 0;
    c[1].timer = 1000;
    stepCats(c, 50, grid, () => 0, []);
    expect(c[0].goal).toBe("play");
  });

  it("un tirage haut envoie le chat faire la sieste sur le canapé", () => {
    const c = cats();
    const follow = seeded(9);
    let first = true;
    const rng = (): number => {
      if (first) {
        first = false;
        return 0.99;
      }
      return follow();
    };
    c[0].timer = 0;
    c[1].timer = 1000;
    stepCats(c, 50, grid, rng);
    expect(c[0].goal).toBe("nap");
    for (let t = 0; t < 20 * 100 && !c[0].onSofa; t++) {
      stepCats(c, 50, grid, rng);
      c[1].timer = 1000;
    }
    expect(c[0].onSofa).toBe(true);
    expect(c[0].mode).toBe("sleep");
    expect({ x: c[0].x, y: c[0].y }).toEqual(CAT_SOFA_SPOT);
  });

  it("un chat réveillé sur le canapé redescend devant lui, pas depuis l'arbre", () => {
    const c = cats();
    c[0].onSofa = true;
    c[0].x = CAT_SOFA_SPOT.x;
    c[0].y = CAT_SOFA_SPOT.y;
    c[0].timer = 0;
    c[1].timer = 1000;
    stepCats(c, 50, grid, () => 0);
    expect(c[0].onSofa).toBe(false);
    expect(Math.abs(c[0].y - c[0].base.y)).toBeGreaterThan(100);
  });
});

describe("sleepScaleFor", () => {
  it("vaut 1 le jour et CAT_NIGHT_SLEEP_FACTOR la nuit", () => {
    expect(sleepScaleFor(0)).toBe(1);
    expect(sleepScaleFor(1)).toBe(CAT_NIGHT_SLEEP_FACTOR);
    expect(sleepScaleFor(5)).toBe(CAT_NIGHT_SLEEP_FACTOR);
  });
});

describe("chat qui fait tomber un objet", () => {
  it("un tirage dans la tranche « knock » pousse un objet puis il disparaît", () => {
    const c = cats();
    c[0].timer = 0;
    c[1].timer = 1000;
    let first = true;
    const rng = (): number => {
      if (first) {
        first = false;
        return 0.8;
      }
      return 0.5;
    };
    stepCats(c, 50, grid, rng, []);
    expect(c[0].goal).toBe("knock");
    let dropped = false;
    for (let t = 0; t < 20 * 200; t++) {
      stepCats(c, 50, grid, rng, []);
      c[1].timer = 1000;
      if (c[0].drop) dropped = true;
    }
    expect(dropped).toBe(true);
    expect(c[0].drop).toBeNull();
  });
});
