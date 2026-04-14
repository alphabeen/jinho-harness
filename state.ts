import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export type WorkflowPhase =
  | "idle"
  | "clarifying"
  | "planning"
  | "ultraplanning";

export interface ExtensionState {
  phase: WorkflowPhase;
  activeGoalDocument: string | null;
  lastCommand: "clarify" | "plan" | "ultraplan" | null;
  lastTopic: string | null;
  lastArtifactPath: string | null;
  lastUpdatedAt: string | null;
  interrupted: boolean;
  interruptedReason: string | null;
  interruptedAt: string | null;
  resumeSummary: string | null;
}

export const SESSION_STATE_ENTRY_TYPE = "omj-workflow-state";

export const DEFAULT_STATE: ExtensionState = {
  phase: "idle",
  activeGoalDocument: null,
  lastCommand: null,
  lastTopic: null,
  lastArtifactPath: null,
  lastUpdatedAt: null,
  interrupted: false,
  interruptedReason: null,
  interruptedAt: null,
  resumeSummary: null,
};

export function normalizeState(parsed: Partial<ExtensionState> | null | undefined): ExtensionState {
  return {
    phase: parsed?.phase ?? "idle",
    activeGoalDocument: parsed?.activeGoalDocument ?? null,
    lastCommand: parsed?.lastCommand ?? null,
    lastTopic: parsed?.lastTopic ?? null,
    lastArtifactPath: parsed?.lastArtifactPath ?? null,
    lastUpdatedAt: parsed?.lastUpdatedAt ?? null,
    interrupted: parsed?.interrupted ?? false,
    interruptedReason: parsed?.interruptedReason ?? null,
    interruptedAt: parsed?.interruptedAt ?? null,
    resumeSummary: parsed?.resumeSummary ?? null,
  };
}

export function mergeState(
  current: ExtensionState,
  partial: Partial<ExtensionState>,
): ExtensionState {
  return normalizeState({ ...current, ...partial });
}

export function restoreStateFromBranch(ctx: ExtensionContext): ExtensionState {
  let state = { ...DEFAULT_STATE };

  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type !== "custom" || entry.customType !== SESSION_STATE_ENTRY_TYPE) continue;
    state = normalizeState(entry.data as Partial<ExtensionState> | undefined);
  }

  return state;
}

export function buildResumeSummary(state: ExtensionState): string | null {
  const parts: string[] = [];

  if (state.phase !== "idle") parts.push(`phase=${state.phase}`);
  if (state.lastCommand) parts.push(`command=${state.lastCommand}`);
  if (state.lastTopic) parts.push(`topic=${state.lastTopic}`);
  if (state.lastArtifactPath) parts.push(`artifact=${state.lastArtifactPath}`);
  if (state.activeGoalDocument) parts.push(`goal=${state.activeGoalDocument}`);
  if (state.interrupted) parts.push(`interrupted=${state.interruptedReason ?? "yes"}`);

  return parts.length > 0 ? parts.join(" | ") : null;
}

export function buildResumePrompt(state: ExtensionState): string | null {
  if (
    state.phase === "idle" &&
    !state.lastCommand &&
    !state.lastTopic &&
    !state.lastArtifactPath &&
    !state.activeGoalDocument &&
    !state.interrupted
  ) {
    return null;
  }

  const lines = [
    "Resume the previous OMJ workflow in this session.",
    "",
    "Recovered OMJ state:",
    `- Phase: ${state.phase}`,
  ];

  if (state.lastCommand) lines.push(`- Last command: ${state.lastCommand}`);
  if (state.lastTopic) lines.push(`- Last topic: ${state.lastTopic}`);
  if (state.lastArtifactPath) lines.push(`- Last artifact: ${state.lastArtifactPath}`);
  if (state.activeGoalDocument) lines.push(`- Active goal document: ${state.activeGoalDocument}`);
  if (state.lastUpdatedAt) lines.push(`- Last updated: ${state.lastUpdatedAt}`);
  if (state.interrupted) {
    lines.push(
      `- Previous run was interrupted${state.interruptedReason ? ` (${state.interruptedReason})` : ""}.`,
    );
  }

  lines.push(
    "",
    "Continue from exactly where this session left off.",
    "Do not restart from scratch unless the restored state is clearly stale.",
    "First briefly acknowledge what was resumed, then continue the next sensible step.",
  );

  return lines.join("\n");
}
