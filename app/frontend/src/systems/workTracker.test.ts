import { describe, it, expect } from "vitest";
import {
  accumulate,
  emptyLog,
  firstName,
  formatDuration,
  localDateKey,
  parseLog,
  ranking,
  topWorker,
  type TrackedAgent,
} from "./workTracker";

const noon = new Date(2026, 9, 6, 12, 0, 0);
const nextDay = new Date(2026, 9, 7, 9, 0, 0);

const agents: TrackedAgent[] = [
  { name: "ivan", state: "working" },
  { name: "Lina", state: "thinking" },
  { name: "Omar", state: "waiting" },
  { name: null, state: "working" },
];

describe("accumulate", () => {
  it("compte seulement ceux qui travaillent ou réfléchissent, avec un prénom", () => {
    const log = accumulate(emptyLog(noon), agents, 5, noon);
    expect(log.seconds).toEqual({ Ivan: 5, Lina: 5 });
  });

  it("cumule d'un passage à l'autre", () => {
    let log = emptyLog(noon);
    log = accumulate(log, agents, 5, noon);
    log = accumulate(log, [agents[0]], 5, noon);
    expect(log.seconds.Ivan).toBe(10);
    expect(log.seconds.Lina).toBe(5);
  });

  it("renvoie le même objet quand personne ne travaille", () => {
    const log = emptyLog(noon);
    expect(accumulate(log, [agents[2]], 5, noon)).toBe(log);
  });

  it("repart de zéro quand le jour change", () => {
    const yesterday = accumulate(emptyLog(noon), agents, 60, noon);
    const log = accumulate(yesterday, [agents[0]], 5, nextDay);
    expect(log.date).toBe(localDateKey(nextDay));
    expect(log.seconds).toEqual({ Ivan: 5 });
  });
});

describe("topWorker / ranking", () => {
  it("désigne le prénom qui a le plus bossé", () => {
    const log = { date: "x", seconds: { Lina: 300, Ivan: 900, Omar: 10 } };
    expect(topWorker(log)).toEqual({ name: "Ivan", seconds: 900 });
    expect(ranking(log).map((r) => r.name)).toEqual(["Ivan", "Lina", "Omar"]);
  });
  it("renvoie null si personne n'a travaillé", () => {
    expect(topWorker(emptyLog(noon))).toBeNull();
  });
});

describe("formatage et lecture", () => {
  it("formatDuration", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(125)).toBe("2 min");
    expect(formatDuration(4020)).toBe("1 h 07");
  });
  it("firstName", () => {
    expect(firstName("  ivan ")).toBe("Ivan");
    expect(firstName("")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
  it("parseLog ignore un fichier d'un autre jour ou abîmé", () => {
    const today = JSON.stringify({
      date: localDateKey(noon),
      seconds: { Lina: 12, Bad: -3, Worse: "x" },
    });
    expect(parseLog(today, noon).seconds).toEqual({ Lina: 12 });
    expect(parseLog(today, nextDay).seconds).toEqual({});
    expect(parseLog("{pas du json", noon).seconds).toEqual({});
    expect(parseLog(null, noon).seconds).toEqual({});
  });
});
