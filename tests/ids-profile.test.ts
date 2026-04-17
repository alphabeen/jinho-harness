import { describe, expect, it } from "vitest";
import {
  PROJECT_CONTEXT_CANDIDATES,
  buildIdsModeNotice,
  buildLoadedMessage,
  buildModeSummary,
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

  it("builds loaded message for both IDS and generic mode", () => {
    expect(buildLoadedMessage(true)).toContain("(IDS mode) loaded");
    expect(buildLoadedMessage(true)).toContain("/mode");
    expect(buildLoadedMessage(false)).toContain("oh-my-jinho loaded");
    expect(buildLoadedMessage(false)).toContain("/mode");
  });

  it("builds mode summary with fallback placeholders", () => {
    const summary = buildModeSummary({
      idsMode: false,
      cwd: "",
      contextPath: null,
      phase: "idle",
      lastTopic: null,
      lastArtifactPath: null,
    });
    expect(summary).toContain("IDS mode: inactive");
    expect(summary).toContain("Workspace: (unknown)");
    expect(summary).toContain("Context file: (none)");
    expect(summary).toContain("Last topic: (none)");
  });

  it("builds mode summary with explicit values", () => {
    const summary = buildModeSummary({
      idsMode: true,
      cwd: "C:/Users/wjdwl/ids_core",
      contextPath: "C:/Users/wjdwl/ids_core/IDS.md",
      phase: "planning",
      lastTopic: "IDS 전용 플랜",
      lastArtifactPath: "docs/engineering-discipline/plans/a.md",
    });
    expect(summary).toContain("IDS mode: active");
    expect(summary).toContain("Context file: C:/Users/wjdwl/ids_core/IDS.md");
    expect(summary).toContain("Phase: planning");
  });
});
