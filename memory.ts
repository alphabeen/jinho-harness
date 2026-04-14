import Database from "better-sqlite3";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync } from "fs";

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

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id   TEXT NOT NULL,
  workspace    TEXT NOT NULL DEFAULT '',
  event_type   TEXT NOT NULL,
  detail       TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_workspace ON events(workspace, created_at DESC);
`;

export class MemoryDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec(SCHEMA);
  }

  upsertSession(row: Omit<SessionRow, "started_at" | "updated_at"> & { started_at?: string }): void {
    const now = new Date().toISOString();
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
      row.workspace,
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

  insertSummary(sessionId: string, workspace: string, summaryText: string, relatedFiles: string[] = []): void {
    this.db.prepare(`
      INSERT INTO summaries (session_id, workspace, summary_text, related_files, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, workspace, summaryText, JSON.stringify(relatedFiles), new Date().toISOString());
  }

  insertEvent(sessionId: string, workspace: string, eventType: string, detail: string): void {
    this.db.prepare(`
      INSERT INTO events (session_id, workspace, event_type, detail, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(sessionId, workspace, eventType, detail, new Date().toISOString());
  }

  recentSummariesForWorkspace(workspace: string, limit = 5): SummaryRow[] {
    return this.db.prepare(`
      SELECT * FROM summaries
      WHERE workspace = ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(workspace, limit) as unknown as SummaryRow[];
  }

  searchSummaries(workspace: string, query: string, limit = 10): SummaryRow[] {
    return this.db.prepare(`
      SELECT * FROM summaries
      WHERE workspace = ? AND summary_text LIKE ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(workspace, `%${query}%`, limit) as unknown as SummaryRow[];
  }

  recallSession(sessionId: string): SessionRow | null {
    return (this.db.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
    `).get(sessionId) as unknown as SessionRow | null) ?? null;
  }

  recentSessions(workspace: string, limit = 10): SessionRow[] {
    return this.db.prepare(`
      SELECT * FROM sessions
      WHERE workspace = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(workspace, limit) as unknown as SessionRow[];
  }

  close(): void {
    this.db.close();
  }
}

export function defaultDbPath(): string {
  const dir = join(homedir(), ".pi");
  try { mkdirSync(dir, { recursive: true }); } catch { /* already exists */ }
  return join(dir, "omj-memory.db");
}
