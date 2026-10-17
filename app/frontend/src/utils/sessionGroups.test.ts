import { describe, expect, it } from "vitest";
import type { Session } from "@/hooks/useSessions";
import {
  folderLabel,
  getProjectKey,
  groupSessionsByProject,
  isLive,
} from "./sessionGroups";

const NOW = new Date("2026-10-06T12:00:00Z").getTime();
const ago = (min: number): string => new Date(NOW - min * 60_000).toISOString();

function make(over: Partial<Session>): Session {
  return {
    id: "x",
    status: "completed",
    updatedAt: "2026-10-01T10:00:00Z",
    eventCount: 0,
    ...over,
  } as Session;
}

describe("isLive", () => {
  it("est en direct sous 10 min d'activité, en pause au-delà", () => {
    expect(isLive(make({ lastActivityAt: ago(3) }), NOW)).toBe(true);
    expect(isLive(make({ lastActivityAt: ago(11) }), NOW)).toBe(false);
  });
  it("ignore le statut started/ended du backend", () => {
    expect(
      isLive(make({ status: "active", lastActivityAt: ago(60) }), NOW),
    ).toBe(false);
    expect(
      isLive(make({ status: "completed", lastActivityAt: ago(1) }), NOW),
    ).toBe(true);
  });
  it("retombe sur updatedAt sans lastActivityAt", () => {
    expect(isLive(make({ updatedAt: ago(2) }), NOW)).toBe(true);
  });
});

describe("getProjectKey", () => {
  it("préfère le dossier connu de l'appli", () => {
    expect(
      getProjectKey(make({ folderName: "bo-test", projectName: "Titre" })),
    ).toBe("bo-test");
  });
  it("retombe sur le dernier segment du chemin, Windows ou Unix", () => {
    expect(getProjectKey(make({ projectRoot: "C:\\bo-test" }))).toBe("bo-test");
    expect(getProjectKey(make({ projectRoot: "/home/me/app/" }))).toBe("app");
  });
  it("puis sur projectName, en retirant le préfixe de lecteur", () => {
    expect(getProjectKey(make({ projectName: "C--bo-test" }))).toBe("bo-test");
  });
  it("renvoie « Non groupé » sans projet", () => {
    expect(getProjectKey(make({}))).toBe("Non groupé");
  });
});

describe("groupSessionsByProject", () => {
  it("regroupe par dossier et met le dossier en direct en premier", () => {
    const groups = groupSessionsByProject(
      [
        make({ id: "a1", folderName: "a", lastActivityAt: ago(300) }),
        make({ id: "b1", folderName: "b", lastActivityAt: ago(2) }),
        make({ id: "a2", folderName: "a", lastActivityAt: ago(600) }),
      ],
      NOW,
    );
    expect([...groups.keys()]).toEqual(["b", "a"]);
    expect(groups.get("a")!.map((s) => s.id)).toEqual(["a1", "a2"]);
  });
  it("met la session en direct avant les plus récentes dans un dossier", () => {
    const groups = groupSessionsByProject(
      [
        make({ id: "old", folderName: "a", lastActivityAt: ago(30) }),
        make({ id: "live", folderName: "a", lastActivityAt: ago(1) }),
      ],
      NOW,
    );
    expect(groups.get("a")!.map((s) => s.id)).toEqual(["live", "old"]);
  });
  it("range sous un même dossier des sessions de projectName différents", () => {
    const groups = groupSessionsByProject(
      [
        make({ id: "1", folderName: "bo-test", projectName: "Montage" }),
        make({ id: "2", folderName: "bo-test", projectName: "C--bo-test" }),
      ],
      NOW,
    );
    expect([...groups.keys()]).toEqual(["bo-test"]);
  });
});

describe("folderLabel", () => {
  it("retire le préfixe de lecteur encodé", () => {
    expect(folderLabel("C--bo-test")).toBe("bo-test");
    expect(folderLabel("bo-test")).toBe("bo-test");
  });
});

describe("conversations sans groupe", () => {
  it("vont dans « Non groupé »", () => {
    expect(getProjectKey(make({}))).toBe("Non groupé");
    const g = groupSessionsByProject(
      [make({ id: "a" }), make({ id: "b" })],
      NOW,
    );
    expect([...g.keys()]).toEqual(["Non groupé"]);
    expect(g.get("Non groupé")).toHaveLength(2);
  });
});
