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
