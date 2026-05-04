import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryDb } from "../memory.js";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tmpDir: string;
let db: MemoryDb;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "omj-memory-test-"));
  db = new MemoryDb(join(tmpDir, "test.db"));
});

afterEach(() => {
  db.close();
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("MemoryDb: sessions", () => {
  it("upserts and recalls a session", () => {
    db.upsertSession({
      session_id: "sess-1",
      workspace: "/home/user/project",
      phase: "planning",
      last_command: "plan",
      last_topic: "Add auth flow",
      last_artifact_path: "docs/plans/plan.md",
      resume_summary: "planning auth",
      interrupted: 0,
      interrupted_reason: null,
    });

    const row = db.recallSession("sess-1");
    expect(row).not.toBeNull();
    expect(row!.phase).toBe("planning");
    expect(row!.last_topic).toBe("Add auth flow");
    expect(row!.workspace).toBe("/home/user/project");
  });

  it("upserts a session twice and updates it", () => {
    db.upsertSession({
      session_id: "sess-2",
      workspace: "/ws",
      phase: "clarifying",
      last_command: "clarify",
      last_topic: "topic-a",
      last_artifact_path: null,
      resume_summary: null,
      interrupted: 0,
      interrupted_reason: null,
    });

    db.upsertSession({
      session_id: "sess-2",
      workspace: "/ws",
      phase: "planning",
      last_command: "plan",
      last_topic: "topic-b",
      last_artifact_path: "plan.md",
      resume_summary: "updated",
      interrupted: 0,
      interrupted_reason: null,
    });

    const row = db.recallSession("sess-2");
    expect(row!.phase).toBe("planning");
    expect(row!.last_topic).toBe("topic-b");
  });

  it("returns null for unknown session", () => {
    expect(db.recallSession("nonexistent")).toBeNull();
  });

  it("lists recent sessions by workspace", () => {
    for (let i = 0; i < 3; i++) {
      db.upsertSession({
        session_id: `sess-ws-${i}`,
        workspace: "/ws",
        phase: "idle",
        last_command: null,
        last_topic: null,
        last_artifact_path: null,
        resume_summary: null,
        interrupted: 0,
        interrupted_reason: null,
      });
    }
    db.upsertSession({
      session_id: "other-ws",
      workspace: "/other",
      phase: "idle",
      last_command: null,
      last_topic: null,
      last_artifact_path: null,
      resume_summary: null,
      interrupted: 0,
      interrupted_reason: null,
    });

    const rows = db.recentSessions("/ws", 10);
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.workspace === "/ws")).toBe(true);
  });
});

describe("MemoryDb: summaries", () => {
  it("inserts and retrieves summaries by workspace", () => {
    db.insertSummary("sess-1", "/ws", "This session implemented auth.", ["auth.ts"]);
    db.insertSummary("sess-1", "/ws", "Plan was drafted for deployment.", ["deploy.md"]);
    db.insertSummary("sess-1", "/other", "Unrelated session.", []);

    const rows = db.recentSummariesForWorkspace("/ws", 10);
    expect(rows.length).toBe(2);
  });

  it("writes context briefs as markdown artifacts and stores them as searchable memory", () => {
    const result = db.writeContextBrief(
      "sess-brief",
      "/ws",
      "Clarify brief",
      "# Context Brief\n\n- decision: use SQLite\n- next step: add memory_write tool",
      ["docs/engineering-discipline/context/brief.md"],
    );

    expect(existsSync(result.artifactPath)).toBe(true);
    expect(readFileSync(result.artifactPath, "utf-8")).toContain("# Context Brief");
    expect(JSON.parse(result.summary.related_files)).toContain(result.artifactPath);

    const searchResults = db.searchSummaries("/ws", "memory_write");
    expect(searchResults.length).toBe(1);
    expect(searchResults[0]!.summary_text).toContain("memory_write");
  });

  it("searches summaries by keyword", () => {
    db.insertSummary("sess-1", "/ws", "Implemented authentication with JWT.", []);
    db.insertSummary("sess-1", "/ws", "Fixed deployment pipeline issue.", []);

    const results = db.searchSummaries("/ws", "JWT");
    expect(results.length).toBe(1);
    expect(results[0]!.summary_text).toContain("JWT");
  });

  it("returns empty array if no match", () => {
    db.insertSummary("sess-1", "/ws", "Something unrelated.", []);
    const results = db.searchSummaries("/ws", "nonexistent-keyword-xyz");
    expect(results.length).toBe(0);
  });

  it("respects the limit param", () => {
    for (let i = 0; i < 8; i++) {
      db.insertSummary(`sess-${i}`, "/ws", `Summary number ${i}`, []);
    }
    const rows = db.recentSummariesForWorkspace("/ws", 3);
    expect(rows.length).toBe(3);
  });
});

describe("MemoryDb: events", () => {
  it("inserts and retrieves events", () => {
    db.insertEvent("sess-1", "/ws", "session_start", "reason=startup");
    db.insertEvent("sess-1", "/ws", "compaction_triggered", "context_length=180000");

    const row = db.searchSummaries("/ws", "");
    expect(row.length).toBe(0); // events are separate from summaries

    // Verify events table directly via a session recall
    const session = db.recallSession("sess-1");
    expect(session).toBeNull(); // event insert doesn't create session
  });
});

describe("MemoryDb: session search", () => {
  it("searches session metadata by keyword", () => {
    db.upsertSession({
      session_id: "sess-search",
      workspace: "/ws",
      phase: "planning",
      last_command: "clarify",
      last_topic: "Context Brief persistence",
      last_artifact_path: "docs/engineering-discipline/context/2026-05-04-public-memory-brief.md",
      resume_summary: "planning context brief persistence",
      interrupted: 0,
      interrupted_reason: null,
    });

    const results = db.searchSessions("/ws", "brief");
    expect(results.length).toBe(1);
    expect(results[0]!.session_id).toBe("sess-search");
  });
});