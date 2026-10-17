import { describe, expect, it } from "vitest";
import {
  hitLabel,
  openErrorToast,
} from "@/components/conversations/openConversation";
import type { ActiveConversation } from "@/types";

describe("openErrorToast", () => {
  it("returns null on success", () => {
    expect(openErrorToast(200)).toBeNull();
  });
  it("maps each error code to a French message", () => {
    expect(openErrorToast(404)).toMatch(/introuvable/);
    expect(openErrorToast(409)).toMatch(/archivée/);
    expect(openErrorToast(501)).toMatch(/Windows/);
    expect(openErrorToast(500)).toMatch(/Impossible/);
    expect(openErrorToast(0)).toMatch(/Impossible/);
  });
});

describe("hitLabel", () => {
  const base = { sessionId: "s", status: "working" } as ActiveConversation;
  it("mentions Claude when there is an app session", () => {
    expect(hitLabel({ ...base, appSessionId: "local_1" })).toMatch(/Claude/);
  });
  it("always mentions Claude, even without app session", () => {
    expect(hitLabel(base)).toMatch(/Claude/);
  });
});
