import Database from "better-sqlite3";
import { createHash } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";

export interface SessionRow {
  session_id: string;
  workspace: string;
  phase: string;
  last_command: string | null;
  last_topic: string | null;
  last_artifact_path: string | null;
  resume_summary: string | null;
  interrupted: number;
  interrupted_reason: string | null;
  started_at: string;
  updated_at: string;
}

export interface SummaryRow {
  id: number;
  session_id: string;
  workspace: string;
  summary_text: string;
  related_files: string;
  created_at: string;
}

export interface EventRow {
  id: number;
  session_id: string;
  workspace: string;
  event_type: string;
  detail: string;
  created_at: string;
}

export interface ContextBriefWriteResult {
  artifactPath: string;
  summary: SummaryRow;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id     TEXT PRIMARY KEY,
  workspace      TEXT NOT NULL DEFAULT '',
  phase          TEXT NOT NULL DEFAULT 'idle',
  last_command   TEXT,
  last_topic     TEXT,
  last_artifact_path TEXT,
  resume_summary TEXT,
  interrupted    INTEGER NOT NULL DEFAULT 0,
  interrupted_reason TEXT,
  started_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  workspace    TEXT NOT NULL DEFAULT '',
  summary_text TEXT NOT NULL,
  related_files TEXT NOT NULL DEFAULT '[]',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_summaries_workspace ON summaries(workspace, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_summaries_session ON summaries(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  workspace    TEXT NOT NULL DEFAULT '',
  event_type   TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_workspace ON events(workspace, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, created_at DESC);
`;

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeWorkspace(workspace: string): string {
  const value = workspace.trim();
  return value.length > 0 ? value : "(unknown workspace)";
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/^[./\\]+/, "")
    .replace(/[<>:"|?*\x00-\x1F]+/g, "-")
    .replace(/[\\/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80) || "item";
}

function workspaceHash(workspace: string): string {
  return createHash("sha1").update(normalizeWorkspace(workspace)).digest("hex").slice(0, 12);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function relatedFilesToJson(files: string[]): string {
  return JSON.stringify(uniqueStrings(files));
}

function parseRelatedFiles(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : [];
  } catch {
    return [];
  }
}

function buildLikePattern(query: string): string {
  return `%${query}%`;
}

function toSummaryRow(row: {
  id: number;
  session_id: string;
  workspace: string;
  summary_text: string;
  related_files: string;
  created_at: string;
}): SummaryRow {
  return {
    id: row.id,
    session_id: row.session_id,
    workspace: row.workspace,
    summary_text: row.summary_text,
    related_files: row.related_files,
    created_at: row.created_at,
  };
}

export class MemoryDb {
  private db: Database.Database;
  private readonly briefRoot: string;

  constructor(dbPath: string) {
    const dbDir = dirname(dbPath);
    mkdirSync(dbDir, { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA);
    this.briefRoot = join(dbDir, "briefs");
    mkdirSync(this.briefRoot, { recursive: true });
  }

  upsertSession(row: Omit<SessionRow, "started_at" | "updated_at"> & { started_at?: string }): void {
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO sessions (session_id, workspace, phase, last_command, last_topic,
        last_artifact_path, resume_summary, interrupted, interrupted_reason, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        workspace = excluded.workspace,
        phase = excluded.phase,
        last_command = excluded.last_command,
        last_topic = excluded.last_topic,
        last_artifact_path = excluded.last_artifact_path,
        resume_summary = excluded.resume_summary,
        interrupted = excluded.interrupted,
        interrupted_reason = excluded.interrupted_reason,
        updated_at = excluded.updated_at
    `).run(
      row.session_id,
      normalizeWorkspace(row.workspace),
      row.phase,
      row.last_command ?? null,
      row.last_topic ?? null,
      row.last_artifact_path ?? null,
      row.resume_summary ?? null,
      row.interrupted ? 1 : 0,
      row.interrupted_reason ?? null,
      row.started_at ?? now,
      now,
    );
  }

  insertSummary(sessionId: string, workspace: string, summaryText: string, relatedFiles: string[] = []): SummaryRow {
    const createdAt = nowIso();
    const result = this.db.prepare(`
      INSERT INTO summaries (session_id, workspace, summary_text, related_files, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, normalizeWorkspace(workspace), summaryText, relatedFilesToJson(relatedFiles), createdAt);

    return {
      id: Number(result.lastInsertRowid),
      session_id: sessionId,
      workspace: normalizeWorkspace(workspace),
      summary_text: summaryText,
      related_files: relatedFilesToJson(relatedFiles),
      created_at: createdAt,
    };
  }

  writeContextBrief(
    sessionId: string,
    workspace: string,
    title: string,
    markdown: string,
    relatedFiles: string[] = [],
  ): ContextBriefWriteResult {
    const normalizedWorkspace = normalizeWorkspace(workspace);
    const createdAt = nowIso();
    const artifactDir = join(this.briefRoot, workspaceHash(normalizedWorkspace), sanitizeSegment(sessionId));
    mkdirSync(artifactDir, { recursive: true });

    const artifactPath = join(
      artifactDir,
      `${createdAt.replace(/:/g, "-")}-${sanitizeSegment(title)}.md`,
    );
    const body = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
    writeFileSync(artifactPath, body, "utf8");

    const summary = this.insertSummary(sessionId, normalizedWorkspace, markdown, [artifactPath, ...relatedFiles]);
    return { artifactPath, summary };
  }

  insertEvent(sessionId: string, workspace: string, eventType: string, detail: string): void {
    this.db.prepare(`
      INSERT INTO events (session_id, workspace, event_type, detail, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, normalizeWorkspace(workspace), eventType, detail, nowIso());
  }

  recentSummariesForWorkspace(workspace: string, limit = 5): SummaryRow[] {
    return this.db.prepare(`
      SELECT * FROM summaries
      WHERE workspace = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(normalizeWorkspace(workspace), limit) as SummaryRow[];
  }

  searchSummaries(workspace: string, query: string, limit = 10): SummaryRow[] {
    const pattern = buildLikePattern(query);
    return this.db.prepare(`
      SELECT * FROM summaries
      WHERE workspace = ?
        AND (
          summary_text LIKE ?
          OR related_files LIKE ?
          OR session_id LIKE ?
        )
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(normalizeWorkspace(workspace), pattern, pattern, pattern, limit) as SummaryRow[];
  }

  searchSessions(workspace: string, query: string, limit = 10): SessionRow[] {
    const pattern = buildLikePattern(query);
    return this.db.prepare(`
      SELECT * FROM sessions
      WHERE workspace = ?
        AND (
          session_id LIKE ?
          OR last_command LIKE ?
          OR last_topic LIKE ?
          OR last_artifact_path LIKE ?
          OR resume_summary LIKE ?
        )
      ORDER BY updated_at DESC, session_id DESC
      LIMIT ?
    `).all(normalizeWorkspace(workspace), pattern, pattern, pattern, pattern, pattern, limit) as SessionRow[];
  }

  recallSession(sessionId: string): SessionRow | null {
    return (this.db.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
    `).get(sessionId) as SessionRow | null) ?? null;
  }

  recentSessions(workspace: string, limit = 10): SessionRow[] {
    return this.db.prepare(`
      SELECT * FROM sessions
      WHERE workspace = ?
      ORDER BY updated_at DESC, session_id DESC
      LIMIT ?
    `).all(normalizeWorkspace(workspace), limit) as SessionRow[];
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbPath(): string {
  const dir = join(homedir(), ".pi");
  try {
    mkdirSync(dir, { recursive: true });
  } catch {
    // already exists
  }
  return join(dir, "omj-memory.db");
}
