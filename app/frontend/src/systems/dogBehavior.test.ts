import { describe, it, expect } from "vitest";
import {
  NavigationGrid,
  GRID_WIDTH,
  GRID_HEIGHT,
} from "./navigationGrid";
import {
  createDog,
  isFreeFloor,
  pickDestination,
  stepDog,
  DOG_REST_MAX_S,
  DOG_SPEED,
} from "./dogBehavior";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const grid = new NavigationGrid();
const W = GRID_WIDTH;
const H = GRID_HEIGHT;

function runningDog(seed: number) {
  const rng = seeded(seed);
  const start = pickDestination(grid, W, H, rng)!;
  const dog = createDog(start);
  stepDog(dog, 16, grid, W, H, [], rng); // restLeft 0 -> demarre un trajet
  return { dog, rng };
}

describe("dogBehavior", () => {
  it("choisit toujours une destination sur une case libre", () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const d = pickDestination(grid, W, H, rng)!;
      const g = grid.worldToGrid(d.x, d.y);
      expect(isFreeFloor(grid, g.gx, g.gy)).toBe(true);
    }
  });

  it("progresse vers la cible et ne quitte jamais les cases praticables", () => {
    const { dog, rng } = runningDog(7);
    expect(dog.mode).toBe("run");
    const target = dog.path[dog.path.length - 1];
    const d0 = Math.hypot(target.x - dog.x, target.y - dog.y);
    let moved = false;
    for (let i = 0; i < 2000 && dog.mode === "run"; i++) {
      const px = dog.x;
      const py = dog.y;
      stepDog(dog, 16, grid, W, H, [], rng);
      if (Math.hypot(dog.x - px, dog.y - py) > 0) moved = true;
      const g = grid.worldToGrid(dog.x, dog.y);
      expect(grid.isWalkable(g.gx, g.gy)).toBe(true);
    }
    expect(moved || d0 === 0).toBe(true);
    expect(dog.mode).toBe("rest");
    expect(Math.hypot(dog.x - target.x, dog.y - target.y)).toBeLessThan(1);
  });

  it("avance a ~DOG_SPEED px/s", () => {
    const { dog, rng } = runningDog(3);
    const x0 = dog.x;
    const y0 = dog.y;
    stepDog(dog, 50, grid, W, H, [], rng);
    const moved = Math.hypot(dog.x - x0, dog.y - y0);
    expect(moved).toBeLessThanOrEqual(DOG_SPEED * 0.05 + 0.001);
  });

  it("fait une pause de 1 a 4 s en frame 0 puis repart", () => {
    const { dog, rng } = runningDog(11);
    for (let i = 0; i < 5000 && dog.mode === "run"; i++) {
      stepDog(dog, 16, grid, W, H, [], rng);
    }
    expect(dog.mode).toBe("rest");
    expect(dog.frame).toBe(0);
    expect(dog.restLeft).toBeGreaterThanOrEqual(1);
    expect(dog.restLeft).toBeLessThanOrEqual(DOG_REST_MAX_S);
    const x = dog.x;
    const y = dog.y;
    stepDog(dog, 16, grid, W, H, [], rng);
    expect(dog.x).toBe(x);
    expect(dog.y).toBe(y);
    for (let i = 0; i < 400 && dog.mode === "rest"; i++) {
      stepDog(dog, 16, grid, W, H, [], rng);
    }
    expect(dog.mode).toBe("run");
  });

  it("s'oriente selon le sens de deplacement", () => {
    const dog = createDog({ x: 400, y: 400 });
    dog.mode = "run";
    dog.path = [{ x: 300, y: 400 }];
    stepDog(dog, 16, grid, W, H);
    expect(dog.facing).toBe(-1);
    dog.mode = "run";
    dog.path = [{ x: 500, y: 400 }];
    stepDog(dog, 16, grid, W, H);
    expect(dog.facing).toBe(1);
  });

  it("alterne les deux frames en courant", () => {
    const dog = createDog({ x: 400, y: 400 });
    dog.mode = "run";
    dog.path = [{ x: 1200, y: 400 }];
    const frames = new Set<number>();
    for (let i = 0; i < 30; i++) {
      stepDog(dog, 16, grid, W, H);
      frames.add(dog.frame);
    }
    expect(frames.size).toBe(2);
  });
});
