import { basename } from "path";

export const PROJECT_CONTEXT_CANDIDATES = [
  "IDS.md",
  "OMJ.md",
  "PROJECT_CONTEXT.md",
  "AGENT_CONTEXT.md",
] as const;

export function isIdsContextPath(path: string | null): boolean {
  if (!path) return false;
  return basename(path).toLowerCase() === "ids.md";
}

export function isLikelyIdsWorkspace(cwd: string): boolean {
  const normalized = cwd.replace(/\\/g, "/").toLowerCase();
  return normalized.endsWith("/ids_core") || normalized.includes("/ids_") || normalized.includes("/ids-");
}

export function isIdsMode(path: string | null, cwd: string): boolean {
  return isIdsContextPath(path) || isLikelyIdsWorkspace(cwd);
}

export function buildIdsModeNotice(idsMode: boolean): string {
  if (idsMode) {
    return "IDS mode active: IDS.md + DDD/Phase rules are prioritized.";
  }
  return "IDS mode inactive: add IDS.md to enable IDS-first guidance automatically.";
}

export function buildLoadedMessage(idsMode: boolean): string {
  return idsMode
    ? "oh-my-jinho (IDS mode) loaded: /clarify, /plan, /ultraplan, /resume, /reset-phase, /mode"
    : "oh-my-jinho loaded: /clarify, /plan, /ultraplan, /resume, /reset-phase, /mode";
}

export function buildModeSummary(args: {
  idsMode: boolean;
  cwd: string;
  contextPath: string | null;
  phase: string;
  lastTopic: string | null;
  lastArtifactPath: string | null;
}): string {
  const contextLabel = args.contextPath ?? "(none)";
  const lastTopic = args.lastTopic ?? "(none)";
  const lastArtifact = args.lastArtifactPath ?? "(none)";

  return [
    `IDS mode: ${args.idsMode ? "active" : "inactive"}`,
    `Workspace: ${args.cwd || "(unknown)"}`,
    `Context file: ${contextLabel}`,
    `Phase: ${args.phase}`,
    `Last topic: ${lastTopic}`,
    `Last artifact: ${lastArtifact}`,
  ].join("\n");
}
