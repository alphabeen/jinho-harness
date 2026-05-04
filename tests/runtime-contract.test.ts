import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("index.ts", "utf-8");

describe("runtime contract: critical commands and hooks", () => {
  it("keeps critical command registrations", () => {
    const required = [
      'pi.registerCommand("setup"',
      'pi.registerCommand("clarify"',
      'pi.registerCommand("plan"',
      'pi.registerCommand("resume"',
      'pi.registerCommand("mode"',
      'name: "memory_search"',
      'name: "memory_write"',
      'name: "memory_recent"',
      'name: "memory_recall"',
    ];

    for (const token of required) {
      expect(source.includes(token), `missing command token: ${token}`).toBe(true);
    }
  });

  it("keeps critical startup hooks", () => {
    const required = [
      'pi.on("session_start"',
      'pi.on("before_agent_start"',
      "buildIdsModeNotice(idsModeActive)",
      "buildLoadedMessage(idsModeActive)",
      "## IDS Focus Mode",
    ];

    for (const token of required) {
      expect(source.includes(token), `missing startup token: ${token}`).toBe(true);
    }
  });
});
