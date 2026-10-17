import { describe, it, expect } from "vitest";
import { NavigationGrid } from "./navigationGrid";
import { isFreeFloor } from "./dogBehavior";
import {
  OutingPlanner,
  breakChance,
  pickOutingTarget,
  BREAK_CHANCE_PER_TICK,
  COFFEE_WAIT_MS,
  OUTING_COOLDOWN_MS,
  YANIS_BREAK_FACTOR,
  type PlannedAgent,
} from "./outingPlanner";

const never = () => 0.999;
const always = () => 0;

function agent(over: Partial<PlannedAgent> = {}): PlannedAgent {
  return {
    id: "a1",
    name: "Florian",
    phase: "idle",
    backendState: "waiting",
    ...over,
  };
}

describe("breakChance", () => {
  it("Yanis sort plus souvent que les autres", () => {
    expect(breakChance("Yanis")).toBe(
      BREAK_CHANCE_PER_TICK * YANIS_BREAK_FACTOR,
    );
    expect(breakChance("yanis ")).toBeGreaterThan(breakChance("Florian"));
    expect(breakChance(null)).toBe(BREAK_CHANCE_PER_TICK);
  });
});

describe("OutingPlanner - café", () => {
  it("n'envoie personne boire avant 5 min d'attente", () => {
    const p = new OutingPlanner();
    expect(p.tick(0, [agent()], never).coffee).toEqual([]);
    expect(p.tick(COFFEE_WAIT_MS - 1, [agent()], never).coffee).toEqual([]);
  });

  it("envoie boire un café après 5 min d'attente", () => {
    const p = new OutingPlanner();
    p.tick(0, [agent()], never);
    expect(p.tick(COFFEE_WAIT_MS, [agent()], never).coffee).toEqual(["a1"]);
  });

  it("le compteur d'attente repart à zéro si l'agent travaille", () => {
    const p = new OutingPlanner();
    p.tick(0, [agent()], never);
    p.tick(COFFEE_WAIT_MS - 1000, [agent({ backendState: "working" })], never);
    p.tick(COFFEE_WAIT_MS, [agent()], never);
    expect(p.tick(COFFEE_WAIT_MS + 1000, [agent()], never).coffee).toEqual([]);
  });

  it("ne compte pas l'attente d'un agent qui n'est pas à son bureau", () => {
    const p = new OutingPlanner();
    p.tick(0, [agent({ phase: "arriving" })], never);
    expect(
      p.tick(COFFEE_WAIT_MS, [agent({ phase: "arriving" })], never).coffee,
    ).toEqual([]);
  });

  it("après une sortie, pas de nouvelle sortie avant le délai de repos", () => {
    const p = new OutingPlanner();
    p.tick(0, [agent()], never);
    p.markOuting("a1", COFFEE_WAIT_MS);
    const t = COFFEE_WAIT_MS + OUTING_COOLDOWN_MS - 1;
    const plan = p.tick(t, [agent()], always);
    expect(plan.breaks).toEqual([]);
    expect(plan.coffee).toEqual([]);
  });
});

describe("OutingPlanner - pause", () => {
  it("une pause aléatoire sort quand le tirage est sous la probabilité", () => {
    const p = new OutingPlanner();
    const plan = p.tick(0, [agent({ backendState: "working" })], always);
    expect(plan.breaks).toEqual(["a1"]);
    expect(plan.coffee).toEqual([]);
  });

  it("Yanis passe le tirage là où un autre agent le rate", () => {
    const roll = () => BREAK_CHANCE_PER_TICK * 2; // entre x1 et x3
    const p = new OutingPlanner();
    const plan = p.tick(
      0,
      [
        agent({ id: "f", name: "Florian", backendState: "working" }),
        agent({ id: "y", name: "Yanis", backendState: "working" }),
      ],
      roll,
    );
    expect(plan.breaks).toEqual(["y"]);
  });
});

describe("pickOutingTarget", () => {
  const grid = new NavigationGrid();
  it("trouve une case libre près de la machine à café et du coin détente", () => {
    for (const kind of ["coffee", "break"] as const) {
      const t = pickOutingTarget(grid, kind, Math.random);
      expect(t).not.toBeNull();
      const g = grid.worldToGrid(t!.x, t!.y);
      expect(isFreeFloor(grid, g.gx, g.gy)).toBe(true);
    }
  });
});
