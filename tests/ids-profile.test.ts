import { describe, expect, it } from "vitest";
import {
  PROJECT_CONTEXT_CANDIDATES,
  buildIdsModeNotice,
  isIdsContextPath,
  isIdsMode,
  isLikelyIdsWorkspace,
} from "../ids-profile.js";

describe("ids-profile", () => {
  it("puts IDS.md first in context candidate priority", () => {
    expect(PROJECT_CONTEXT_CANDIDATES[0]).toBe("IDS.md");
  });

  it("detects IDS context path", () => {
    expect(isIdsContextPath("C:/work/ids_core/IDS.md")).toBe(true);
    expect(isIdsContextPath("C:/work/ids_core/OMJ.md")).toBe(false);
    expect(isIdsContextPath(null)).toBe(false);
  });

  it("detects likely IDS workspace", () => {
    expect(isLikelyIdsWorkspace("C:/Users/me/ids_core")).toBe(true);
    expect(isLikelyIdsWorkspace("/home/me/ids-platform")).toBe(true);
    expect(isLikelyIdsWorkspace("/home/me/oh-my-jinho")).toBe(false);
  });

  it("computes IDS mode from either context path or workspace", () => {
    expect(isIdsMode("C:/x/IDS.md", "/tmp/other")).toBe(true);
    expect(isIdsMode(null, "/home/me/ids_core")).toBe(true);
    expect(isIdsMode(null, "/home/me/other")).toBe(false);
  });

  it("builds startup notice for both mode states", () => {
    expect(buildIdsModeNotice(true)).toContain("IDS mode active");
    expect(buildIdsModeNotice(false)).toContain("IDS mode inactive");
  });
});
