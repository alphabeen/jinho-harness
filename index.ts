import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { keyHint, keyText, rawKeyHint, SessionManager } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { JinhoFooter, type CacheStats, type ActiveTools } from "./footer.js";
import { homedir } from "os";
import { join, dirname, relative, basename } from "path";
import { fileURLToPath } from "url";
import { discoverAgents } from "./agents.js";
import { runAgent, mapWithConcurrencyLimit, MAX_CONCURRENCY, MAX_PARALLEL_TASKS, resolveDepthConfig, getCycleViolations } from "./subagent.js";
import { emptyUsage, isResultError, isResultSuccess, getResultSummaryText, getFinalOutput, type SingleResult, type SubagentDetails } from "./types.js";
import { renderCall, renderResult } from "./render.js";
import {
  DEFAULT_STATE,
  buildResumePrompt,
  buildResumeSummary,
  mergeState,
  restoreStateFromBranch,
  type ExtensionState,
  type WorkflowPhase,
  SESSION_STATE_ENTRY_TYPE,
} from "./state.js";
import { parsePlan } from "./plan-parser.js";
import { buildValidatorPrompt } from "./validator-template.js";
import { readFile, writeFile, mkdir } from "fs/promises";
import { microcompactMessages, getCompactionPrompt, formatCompactSummary } from "./compaction.js";
import { convertToLlm, serializeConversation } from "@mariozechner/pi-coding-agent";
import { complete } from "@mariozechner/pi-ai";
import { isDisciplineAgent, augmentAgentWithBoth, augmentAgentWithContext, getSlopCleanerTask } from "./discipline.js";
import { fetchUrlToMarkdown } from "./webfetch/utils.js";
import { renderWebfetchCall, renderWebfetchResult } from "./webfetch/render.js";
import { MemoryDb, defaultDbPath } from "./memory.js";
import {
  PROJECT_CONTEXT_CANDIDATES,
  buildIdsModeNotice,
  isIdsMode,
} from "./ids-profile.js";

let workflowState: ExtensionState = { ...DEFAULT_STATE };
let currentPhase: WorkflowPhase = workflowState.phase;
let activeGoalDocument: string | null = workflowState.activeGoalDocument;
let projectContext: string = "";
let projectContextPath: string | null = null;
let currentWorkspace = "";
let agentRunActive = false;
let assistantMessageCompleted = false;
let idsModeActive = false;

let memoryDb: MemoryDb | null = null;

function getMemoryDb(): MemoryDb {
  if (!memoryDb) {
    memoryDb = new MemoryDb(defaultDbPath());
  }
  return memoryDb;
}

const cacheStats: CacheStats = { totalInput: 0, totalCacheRead: 0 };

const activeTools: ActiveTools = { running: new Map() };

async function findProjectContextFile(startDir: string): Promise<string | null> {
  let dir = startDir;
  while (true) {
    for (const fileName of PROJECT_CONTEXT_CANDIDATES) {
      const candidate = join(dir, fileName);
      try {
        await readFile(candidate, "utf-8");
        return candidate;
      } catch {
        // keep searching
      }
    }

    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function syncWorkflowGlobals(state: ExtensionState): void {
  workflowState = state;
  currentPhase = state.phase;
  activeGoalDocument = state.activeGoalDocument;
}

function persistWorkflowState(pi: ExtensionAPI, partial: Partial<ExtensionState>): ExtensionState {
  const next = mergeState(workflowState, {
    ...partial,
    lastUpdatedAt: partial.lastUpdatedAt ?? new Date().toISOString(),
  });
  next.resumeSummary = buildResumeSummary(next);
  syncWorkflowGlobals(next);
  pi.appendEntry(SESSION_STATE_ENTRY_TYPE, next);

  try {
    const sessionFile = pi.getSessionName?.() ?? "unknown";
    getMemoryDb().upsertSession({
      session_id: sessionFile,
      workspace: currentWorkspace,
      phase: next.phase,
      last_command: next.lastCommand ?? null,
      last_topic: next.lastTopic ?? null,
      last_artifact_path: next.lastArtifactPath ?? null,
      resume_summary: next.resumeSummary ?? null,
      interrupted: next.interrupted ? 1 : 0,
      interrupted_reason: next.interruptedReason ?? null,
    });
  } catch {
    // Non-fatal: workflow state should still persist to session entries.
  }

  return next;
}

function restoreWorkflowState(ctx: ExtensionContext): ExtensionState {
  const restored = restoreStateFromBranch(ctx);
  syncWorkflowGlobals(restored);
  return restored;
}

function makeSessionName(prefix: string, topic: string): string {
  const cleaned = topic.replace(/\s+/g, " ").trim();
  const short = cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  return `${prefix}: ${short}`;
}

function toWorkspaceKey(cwd: string): string {
  return cwd?.trim() || "(unknown workspace)";
}

function formatTimestamp(date: Date): string {
  return Number.isNaN(date.getTime()) ? "unknown time" : date.toLocaleString();
}

function formatSessionChoice(
  session: { name?: string; firstMessage: string; modified: Date; id: string; path: string },
  currentSessionPath?: string,
): string {
  const title = (session.name || session.firstMessage || "(untitled session)").replace(/\s+/g, " ").trim();
  const shortTitle = title.length > 72 ? `${title.slice(0, 69)}...` : title;
  const current = currentSessionPath && session.path === currentSessionPath ? " [current]" : "";
  return `${formatTimestamp(session.modified)} — ${shortTitle}${current} — ${session.id.slice(0, 8)}`;
}

function describeInterruptReason(reason: string | null): string {
  if (!reason) return "interrupted";
  return reason.replace(/_/g, " ");
}

function getResumePromptForState(state: ExtensionState): string | null {
  const prompt = buildResumePrompt(state);
  if (!prompt) return null;
  return prompt;
}

export default function (pi: ExtensionAPI) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const BUNDLED_AGENTS_DIR = join(__dirname, "agents");
  const BUNDLED_SKILLS_DIR = join(__dirname, "skills");

  const DIRECT_INPUT_OPTION = "직접 입력하기";

  const AskUserQuestionParams = Type.Object({
    question: Type.String({
      description: "The question to ask the user. The agent generates this dynamically based on context.",
    }),
    choices: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Multiple choice options generated by the agent. '직접 입력하기' is auto-appended. Omit for free-text input.",
      })
    ),
    placeholder: Type.Optional(
      Type.String({
        description: "Placeholder hint for free-text input mode.",
      })
    ),
    defaultValue: Type.Optional(
      Type.String({
        description: "Default value if user presses Enter without typing.",
      })
    ),
  });

  pi.registerTool({
    name: "ask_user_question",
    label: "Ask User Question",
    description:
      "Ask the user a question when the agent needs clarification. The agent composes the question and optional choices dynamically. Returns the user's answer as text.",
    promptSnippet:
      "Ask the user a clarifying question with optional multiple-choice answers",
    promptGuidelines: [
      "Use ask_user_question whenever you encounter ambiguity, unclear scope, or need user preference.",
      "Generate the question and choices yourself based on the current context — do not rely on predefined templates.",
      "Offer concrete choices (A/B/C style) when the options are enumerable. Omit choices for open-ended questions.",
      "Ask one focused question at a time. Do not bundle multiple questions.",
      "After receiving an answer, decide whether further clarification is needed or proceed with the task.",
    ],
    parameters: AskUserQuestionParams,
    execute: async (toolCallId, params, signal, onUpdate, ctx) => {
      const { question, choices, placeholder, defaultValue } = params;

      let answer: string | undefined;

      if (choices && choices.length > 0) {
        const withDirect = choices.includes(DIRECT_INPUT_OPTION)
          ? choices
          : [...choices, DIRECT_INPUT_OPTION];

        answer = await ctx.ui.select(question, withDirect, { signal });

        if (answer === DIRECT_INPUT_OPTION) {
          answer = await ctx.ui.input(question, placeholder || defaultValue, {
            signal,
          });
        }
      } else {
        answer = await ctx.ui.input(question, placeholder || defaultValue, {
          signal,
        });
      }

      if (answer === undefined) {
        return {
          content: [{ type: "text", text: "User cancelled the question." }],
          details: undefined,
        };
      }

      return {
        content: [{ type: "text", text: answer }],
        details: undefined,
      };
    },
  });

  const MemorySearchParams = Type.Object({
    query: Type.String({ description: "Keyword or phrase to search in past session summaries." }),
    limit: Type.Optional(Type.Number({ description: "Max results (default 5)." })),
  });

  pi.registerTool({
    name: "memory_search",
    label: "Search Long-Term Memory",
    description: "Search past session summaries from the long-term memory DB.",
    promptSnippet: "Search long-term memory for past context",
    promptGuidelines: [
      "Use memory_search when you need to recall past decisions, implementations, or context from previous sessions.",
    ],
    parameters: MemorySearchParams,
    execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
      try {
        const results = getMemoryDb().searchSummaries(ctx.cwd ?? "", params.query, params.limit ?? 5);
        if (results.length === 0) {
          return { content: [{ type: "text", text: "No matching memory found." }], details: undefined };
        }

        const text = results
          .map((r, i) => `--- Memory ${i + 1} [${r.created_at.slice(0, 10)}] ---\n${r.summary_text.slice(0, 800)}`)
          .join("\n\n");

        return { content: [{ type: "text", text }], details: undefined };
      } catch (error) {
        return { content: [{ type: "text", text: `memory_search error: ${String(error)}` }], details: undefined };
      }
    },
  });

  const MemoryRecallParams = Type.Object({
    session_id: Type.String({ description: "Session file path or session ID to recall." }),
  });

  pi.registerTool({
    name: "memory_recall",
    label: "Recall Session Memory",
    description: "Recall the stored state for a specific session ID.",
    promptSnippet: "Recall a specific past session from long-term memory",
    promptGuidelines: [
      "Use memory_recall to get detailed information about a specific past session.",
    ],
    parameters: MemoryRecallParams,
    execute: async (_toolCallId, params) => {
      try {
        const session = getMemoryDb().recallSession(params.session_id);
        if (!session) {
          return { content: [{ type: "text", text: `No session found for ID: ${params.session_id}` }], details: undefined };
        }

        const text = [
          `Session: ${session.session_id}`,
          `Workspace: ${session.workspace}`,
          `Phase: ${session.phase}`,
          `Last command: ${session.last_command ?? "none"}`,
          `Last topic: ${session.last_topic ?? "none"}`,
          `Last artifact: ${session.last_artifact_path ?? "none"}`,
          `Interrupted: ${session.interrupted ? "yes" : "no"}`,
          `Updated: ${session.updated_at}`,
          session.resume_summary ? `Summary: ${session.resume_summary}` : "",
        ].filter(Boolean).join("\n");

        return { content: [{ type: "text", text }], details: undefined };
      } catch (error) {
        return { content: [{ type: "text", text: `memory_recall error: ${String(error)}` }], details: undefined };
      }
    },
  });

  const HEARTBEAT_MS = 1000;
  const depthConfig = resolveDepthConfig();

  const TaskItem = Type.Object({
    agent: Type.String({ description: "Name of the agent to invoke" }),
    task: Type.String({ description: "Task to delegate to the agent" }),
    cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
  });

  const ChainItem = Type.Object({
    agent: Type.String({ description: "Name of the agent to invoke" }),
    task: Type.String({ description: "Task with optional {previous} placeholder for prior step output" }),
    cwd: Type.Optional(Type.String({ description: "Working directory for the agent process" })),
  });

  const SubagentParams = Type.Object({
    agent: Type.Optional(Type.String({ description: "Agent name for single mode execution" })),
    task: Type.Optional(Type.String({ description: "Task description for single mode execution" })),
    tasks: Type.Optional(Type.Array(TaskItem, { description: "Array of {agent, task} objects for parallel execution (max 8)" })),
    chain: Type.Optional(Type.Array(ChainItem, { description: "Array of {agent, task} objects for sequential chaining. Use {previous} in task to reference prior output." })),
    agentScope: Type.Optional(Type.Unsafe<"user" | "project" | "both">({
      type: "string", enum: ["user", "project", "both"],
      description: 'Which agent directories to search. Default: "user".',
      default: "user",
    })),
    cwd: Type.Optional(Type.String({ description: "Working directory for single mode" })),
    planFile: Type.Optional(Type.String({ description: "Path to plan file. Required when agent is plan-validator — the validator prompt is built from this file, not from the task field." })),
    planTaskId: Type.Optional(Type.Number({ description: "Task number in the plan file to validate (e.g. 1 for Task 1). Required when agent is plan-validator." })),
  });

  const makeDetails = (mode: "single" | "parallel") => (results: SingleResult[]): SubagentDetails => ({ mode, results });

  if (depthConfig.canDelegate) {
    pi.registerTool({
      name: "subagent",
      label: "Subagent",
      description:
        "Delegate tasks to specialized agents running as separate pi processes. Supports single, parallel, and chain execution modes.",
      promptSnippet:
        "Delegate tasks to specialized agents (single, parallel, or chain mode)",
      promptGuidelines: [
        "Use single mode (agent + task) for one-off tasks. Use parallel mode (tasks array) for concurrent dispatch. Use chain mode (chain array) for sequential pipelines with {previous} placeholder.",
        "ONLY use these exact agent names — do NOT invent or guess agent names: explorer, worker, planner, plan-worker, plan-validator, plan-compliance, reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
        "All agents use the default model. Do NOT specify or mention specific models (no Haiku, Sonnet, etc.).",
        "For codebase exploration: use 'explorer'. For general execution: use 'worker'. For plan execution: use 'plan-compliance' → 'plan-worker' → 'plan-validator'.",
        "For ultraplan milestone reviews: dispatch all 5 reviewers in parallel: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
        "Max 8 parallel tasks with 4 concurrent. Chain mode stops on first error.",
        "When calling plan-validator, ALWAYS provide planFile (path to the plan .md file) and planTaskId (the task number to validate). The validator prompt will be built from the plan file automatically — you do not need to compose it. Example: { agent: 'plan-validator', task: 'validate', planFile: 'docs/.../plan.md', planTaskId: 3 }",
      ],
      parameters: SubagentParams,

      renderCall: (args, theme) => renderCall(args, theme),
      renderResult: (result, { expanded }, theme) => renderResult(result, expanded, theme),

      execute: async (toolCallId, params, signal, onUpdate, ctx) => {
        const { agent, task, tasks, chain, agentScope, cwd } = params;
        const defaultCwd = ctx.cwd;
        const agents = await discoverAgents(defaultCwd, agentScope || "user", BUNDLED_AGENTS_DIR);
        const findAgent = (name: string) => agents.find((a) => a.name === name);

        // Safety: cycle detection
        if (depthConfig.preventCycles) {
          const requested: string[] = [];
          if (agent) requested.push(agent);
          if (tasks) for (const t of tasks) requested.push(t.agent);
          if (chain) for (const s of chain) requested.push(s.agent);
          const violations = getCycleViolations(requested, depthConfig.ancestorStack);
          if (violations.length > 0) {
            return {
              content: [{ type: "text" as const, text: `Blocked: delegation cycle detected. Agents already in stack: ${violations.join(", ")}. Stack: ${depthConfig.ancestorStack.join(" -> ") || "(root)"}` }],
              details: makeDetails("single")([]),
              isError: true,
            };
          }
        }

        if (chain && chain.length > 0) {
          let previousOutput = "";
          const allResults: SingleResult[] = [];

          for (let i = 0; i < chain.length; i++) {
            const step = chain[i];
            const taskWithContext = step.task.replace(/\{previous\}/g, previousOutput);
            const ctx_ = projectContext;
              const chainAgent = isDisciplineAgent(step.agent)
              ? augmentAgentWithBoth(findAgent(step.agent), ctx_)
              : augmentAgentWithContext(findAgent(step.agent), ctx_);
            const result = await runAgent({
              agent: chainAgent,
              agentName: step.agent,
              task: taskWithContext,
              cwd: step.cwd || defaultCwd,
              depthConfig,
              signal,
              onUpdate,
              makeDetails: makeDetails("single"),
            });
            allResults.push(result);

            if (isResultError(result)) {
              const summary = allResults.map((r, j) => `[${chain[j].agent}] ${isResultError(r) ? "failed" : "completed"}: ${getResultSummaryText(r)}`).join("\n\n");
              return {
                content: [{ type: "text" as const, text: `Chain failed at step ${i + 1}: ${result.errorMessage || "error"}\n\n${summary}` }],
                details: makeDetails("single")(allResults),
              };
            }
            previousOutput = getFinalOutput(result.messages) || result.stderr;
          }

          const summary = allResults.map((r, i) => `[${chain[i].agent}] completed: ${getResultSummaryText(r)}`).join("\n\n");
          return {
            content: [{ type: "text" as const, text: summary }],
            details: makeDetails("single")(allResults),
          };
        }

        if (tasks && tasks.length > 0) {
          if (tasks.length > MAX_PARALLEL_TASKS) {
            return {
              content: [{ type: "text" as const, text: `Too many parallel tasks (${tasks.length}). Max is ${MAX_PARALLEL_TASKS}.` }],
              details: makeDetails("parallel")([]),
            };
          }

          const allResults: SingleResult[] = tasks.map((t) => ({
            agent: t.agent, agentSource: "unknown" as const, task: t.task,
            exitCode: -1, messages: [], stderr: "", usage: emptyUsage(),
          }));

          const emitProgress = () => {
            if (!onUpdate) return;
            const done = allResults.filter((r) => r.exitCode !== -1).length;
            const running = allResults.filter((r) => r.exitCode === -1).length;
            onUpdate({
              content: [{ type: "text" as const, text: `Parallel: ${done}/${allResults.length} done, ${running} running...` }],
              details: makeDetails("parallel")([...allResults]),
            });
          };

          let heartbeat: ReturnType<typeof setInterval> | undefined;
          if (onUpdate) {
            emitProgress();
            heartbeat = setInterval(() => {
              if (allResults.some((r) => r.exitCode === -1)) emitProgress();
            }, HEARTBEAT_MS);
          }

          let results: SingleResult[];
          try {
            results = await mapWithConcurrencyLimit(tasks, MAX_CONCURRENCY, async (t, index) => {
              const pCtx = projectContext;
              const parallelAgent = isDisciplineAgent(t.agent)
                ? augmentAgentWithBoth(findAgent(t.agent), pCtx)
                : augmentAgentWithContext(findAgent(t.agent), pCtx);
              const result = await runAgent({
                agent: parallelAgent,
                agentName: t.agent,
                task: t.task,
                cwd: t.cwd || defaultCwd,
                depthConfig,
                signal,
                onUpdate: (partial) => {
                  if (partial.details?.results[0]) {
                    allResults[index] = partial.details.results[0];
                    emitProgress();
                  }
                },
                makeDetails: makeDetails("parallel"),
              });
              allResults[index] = result;
              emitProgress();
              return result;
            });
          } finally {
            if (heartbeat) clearInterval(heartbeat);
          }

          const successCount = results.filter((r) => isResultSuccess(r)).length;
          const summaries = results.map((r) =>
            `[${r.agent}] ${isResultError(r) ? "failed" : "completed"}: ${getResultSummaryText(r)}`,
          );
          return {
            content: [{ type: "text" as const, text: `Parallel: ${successCount}/${results.length} succeeded\n\n${summaries.join("\n\n")}` }],
            details: makeDetails("parallel")(results),
          };
        }

        if (agent && task) {
          let effectiveTask = task;

          // Validator information barrier: replace LLM-composed task with
          // code-generated prompt built directly from the plan file.
          if (agent === "plan-validator" && params.planFile && params.planTaskId != null) {
            try {
              const planContent = await readFile(params.planFile, "utf-8");
              const parsed = parsePlan(planContent);
              const planTask = parsed.tasks.find((t) => t.id === params.planTaskId);
              if (planTask) {
                effectiveTask = buildValidatorPrompt(planTask, parsed.verificationCommand);
              }
            } catch {
            }
          }

          const sCtx = projectContext;
          const singleAgent = isDisciplineAgent(agent)
            ? augmentAgentWithBoth(findAgent(agent), sCtx)
            : augmentAgentWithContext(findAgent(agent), sCtx);
          const result = await runAgent({
            agent: singleAgent,
            agentName: agent,
            task: effectiveTask,
            cwd: cwd || defaultCwd,
            depthConfig,
            signal,
            onUpdate,
            makeDetails: makeDetails("single"),
          });

          if (isDisciplineAgent(agent) && isResultSuccess(result)) {
            const slopCleaner = findAgent("slop-cleaner");
            if (slopCleaner) {
              const cleanResult = await runAgent({
                agent: slopCleaner,
                agentName: "slop-cleaner",
                task: getSlopCleanerTask(),
                cwd: cwd || defaultCwd,
                depthConfig,
                signal,
                onUpdate,
                makeDetails: makeDetails("single"),
              });
              const mainText = getResultSummaryText(result);
              const cleanText = isResultSuccess(cleanResult)
                ? `\n\n[slop-cleaner] completed: ${getResultSummaryText(cleanResult)}`
                : `\n\n[slop-cleaner] failed: ${getResultSummaryText(cleanResult)}`;
              return {
                content: [{ type: "text" as const, text: mainText + cleanText }],
                details: makeDetails("single")([result, cleanResult]),
              };
            }
          }

          if (isResultError(result)) {
            return {
              content: [{ type: "text" as const, text: `Agent ${result.stopReason || "failed"}: ${getResultSummaryText(result)}` }],
              details: makeDetails("single")([result]),
              isError: true,
            };
          }
          return {
            content: [{ type: "text" as const, text: getResultSummaryText(result) }],
            details: makeDetails("single")([result]),
          };
        }

        return {
          content: [{ type: "text" as const, text: "Error: Specify either (agent + task) for single mode, tasks for parallel mode, or chain for chain mode." }],
          details: makeDetails("single")([]),
        };
      },
    });
  }

  const WebFetchParams = Type.Object({
    url: Type.String({
      description: "The URL to fetch and convert to Markdown",
    }),
    raw: Type.Optional(
      Type.Boolean({
        description:
          "Convert the full HTML page to Markdown without filtering",
        default: false,
      }),
    ),
    includeScripts: Type.Optional(
      Type.Boolean({
        description:
          "Include <script> and <style> tag content in the output. Default: false (stripped)",
        default: false,
      }),
    ),
    maxLength: Type.Optional(
      Type.Number({
        description:
          "Maximum number of characters to return. Content beyond this limit is truncated.",
      }),
    ),
  });

  pi.registerTool({
    name: "webfetch",
    label: "WebFetch",
    description:
      "Fetch a URL and convert its HTML content to clean Markdown. Uses Turndown + GFM for Markdown conversion. Results are cached for 15 minutes.",
    promptSnippet: "Fetch a URL and convert to Markdown",
    promptGuidelines: [
      "Use webfetch to retrieve and read web pages, documentation, or any URL content.",
      "Script and style tags are stripped by default. Use includeScripts: true when you need CSS/JS source code.",
      "Use raw: true when you need the full HTML page converted without any filtering.",
      "Use maxLength to limit output size for very large pages.",
      "Results are cached for 15 minutes — repeated requests for the same URL return instantly.",
    ],
    parameters: WebFetchParams,

    renderCall: (args, theme) => renderWebfetchCall(args, theme),
    renderResult: (result, { expanded }, theme) =>
      renderWebfetchResult(result, expanded, theme),

    execute: async (toolCallId, params, signal, _onUpdate, _ctx) => {
      const { url, raw, maxLength, includeScripts } = params;
      try {
        const { content, details } = await fetchUrlToMarkdown(url, {
          raw,
          maxLength,
          includeScripts,
          signal,
        });
        return {
          content: [{ type: "text" as const, text: content }],
          details,
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : String(err);
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching ${url}: ${message}`,
            },
          ],
          details: undefined,
          isError: true,
        };
      }
    },
  });

  pi.on("resources_discover", async (_event, _ctx) => {
    return {
      skillPaths: [BUNDLED_SKILLS_DIR],
    };
  });

  const PHASE_GUIDANCE: Record<WorkflowPhase, string> = {
    idle: "",
    clarifying: [
      "\n\n## Active Workflow: Clarification",
      "You are in agentic-clarification mode. Follow the agentic-clarification skill rules strictly:",
      "- Ask ONE question per message using the ask_user_question tool.",
      "- Generate questions and choices dynamically based on the task context.",
      "- Use the subagent tool with agent 'explorer' to investigate the codebase in parallel.",
      "- After each answer, update 'what we've established so far' and assess remaining ambiguity.",
      "- When ambiguity is resolved, present a Context Brief.",
      "- Do NOT start implementation. This phase ends with a Context Brief, not code.",
    ].join("\n"),
    planning: [
      "\n\n## Active Workflow: Plan Crafting",
      "You are in agentic-plan-crafting mode. Follow the agentic-plan-crafting skill rules strictly:",
      "- Write an executable implementation plan from the current context.",
      "- Every step must be executable — no placeholders like 'implement the service'.",
      "- For each step, identify: which files, which modules, what changes.",
      "- Use ask_user_question if you need to resolve any remaining ambiguity.",
      "- End with a Self-Review before presenting the plan.",
    ].join("\n"),
    ultraplanning: [
      "\n\n## Active Workflow: Milestone Planning — Ultraplan",
      "You are in agentic-milestone-planning mode. Follow the agentic-milestone-planning skill rules strictly:",
      "- Compose a Problem Brief from the current context.",
      "- Dispatch all 5 reviewer agents in parallel: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.",
      "- Synthesize all reviewer findings into a milestone DAG.",
      "- Use ask_user_question if you need user input on trade-offs.",
    ].join("\n"),
  };

  pi.on("before_agent_start", async (event, _ctx) => {
    const guidance = PHASE_GUIDANCE[currentPhase];

    // Re-read project context every turn so mid-session edits are reflected immediately
    if (projectContextPath) {
      try {
        projectContext = await readFile(projectContextPath, "utf-8");
      } catch {
        projectContext = "";
      }
    }

    const contextLabel = projectContextPath ? basename(projectContextPath) : "context";
    const contextBlock = projectContext
      ? `\n\n## Project Context (${contextLabel})\n${projectContext}`
      : "";

    let memoryBlock = "";
    try {
      const recentSummaries = getMemoryDb().recentSummariesForWorkspace(_ctx.cwd ?? "", 3);
      if (recentSummaries.length > 0) {
        const lines = recentSummaries.map((s, i) => (
          `### Memory ${i + 1} (${s.created_at.slice(0, 10)})\n${s.summary_text.slice(0, 600)}`
        ));
        memoryBlock = `\n\n## Long-Term Memory (recent sessions)\n${lines.join("\n\n")}`;
      }
    } catch {
      // Non-fatal: prompt proceeds without memory injection.
    }

    let delegationInfo = "";
    if (depthConfig.canDelegate) {
      const agentList = (await discoverAgents(_ctx.cwd || ".", "user", BUNDLED_AGENTS_DIR))
        .map((a) => `- **${a.name}**: ${a.description}`)
        .join("\n");
      delegationInfo = `\n\n## Delegation Guards\n- Current depth: ${depthConfig.currentDepth}, max: ${depthConfig.maxDepth}\n- Cycle prevention: ${depthConfig.preventCycles ? "enabled" : "disabled"}\n- Ancestor stack: ${depthConfig.ancestorStack.length > 0 ? depthConfig.ancestorStack.join(" -> ") : "(root)"}\n\n## Available Subagents\n${agentList}`;
    }

    const idsGuidance = idsModeActive
      ? "\n\n## IDS Focus Mode\n- Prioritize IDS.md constraints over generic defaults.\n- Follow clarify -> plan -> execute sequence.\n- Respect DDD layer boundaries and Phase 0 safety rules."
      : "";

    return {
      systemPrompt: event.systemPrompt + contextBlock + memoryBlock + idsGuidance + (guidance || "") + delegationInfo,
    };
  });

  pi.on("context", async (event, _ctx) => {
    const compacted = microcompactMessages(event.messages);
    const changed = compacted.some((msg, i) => msg !== event.messages[i]);
    if (!changed) return;
    return { messages: compacted };
  });

  pi.on("session_before_compact", async (event, ctx) => {
    // Skip custom compaction for idle phase with no active goal document —
    // let pi's default compaction handle simple conversations.
    if (currentPhase === "idle" && !activeGoalDocument) return;

    const { preparation, signal } = event;
    const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

    const model = ctx.model;
    if (!model) {
      ctx.ui.notify("No model available, using default compaction", "warning");
      return;
    }
    const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!auth.ok || !auth.apiKey) {
      ctx.ui.notify("Compaction auth failed, using default compaction", "warning");
      return;
    }

    const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
    if (allMessages.length === 0) return;

    ctx.ui.notify(
      `Custom compaction: summarizing ${allMessages.length} messages (${tokensBefore.toLocaleString()} tokens)...`,
      "info",
    );

    const conversationText = serializeConversation(convertToLlm(allMessages));

    const promptText = getCompactionPrompt(
      currentPhase,
      activeGoalDocument,
      event.customInstructions,
    );

    const previousContext = previousSummary
      ? `\n\nPrevious session summary for context:\n${previousSummary}`
      : "";

    const summaryMessages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: `${promptText}${previousContext}\n\n<conversation>\n${conversationText}\n</conversation>`,
          },
        ],
        timestamp: Date.now(),
      },
    ];

    try {
      const response = await complete(
        model,
        { messages: summaryMessages },
        {
          apiKey: auth.apiKey,
          headers: auth.headers,
          maxTokens: 8192,
          signal,
        },
      );

      const summary = response.content
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("\n");

      if (!summary.trim()) {
        if (!signal.aborted) {
          ctx.ui.notify("Compaction summary was empty, using default", "warning");
        }
        return;
      }

      const formattedSummary = formatCompactSummary(summary);

      try {
        const sessionFile = ctx.sessionManager.getSessionFile() ?? "unknown";
        getMemoryDb().insertEvent(
          sessionFile,
          ctx.cwd ?? "",
          "compaction_triggered",
          `context_length=${event.preparation.tokensBefore}`,
        );
      } catch {
        // Non-fatal
      }

      return {
        compaction: {
          summary: formattedSummary,
          firstKeptEntryId,
          tokensBefore,
          details: {
            phase: currentPhase,
            activeGoalDocument,
          },
        },
      };
    } catch (error) {
      if (signal.aborted) return;
      const message = error instanceof Error ? error.message : String(error);
      ctx.ui.notify(`Compaction failed: ${message}`, "error");
      return;
    }
  });

  pi.on("session_compact", async (event, _ctx) => {
    if (event.fromExtension && event.compactionEntry.details) {
      const details = event.compactionEntry.details as {
        phase?: string;
        activeGoalDocument?: string | null;
      };
      syncWorkflowGlobals(mergeState(workflowState, {
        phase: (details.phase as WorkflowPhase | undefined) ?? workflowState.phase,
        activeGoalDocument:
          details.activeGoalDocument !== undefined
            ? details.activeGoalDocument
            : workflowState.activeGoalDocument,
      }));
    }

    try {
      const sessionFile = _ctx.sessionManager.getSessionFile() ?? "unknown";
      const text = event.compactionEntry?.summary ?? "";
      if (text.trim()) {
        getMemoryDb().insertSummary(sessionFile, _ctx.cwd ?? "", text, []);
        getMemoryDb().insertEvent(sessionFile, _ctx.cwd ?? "", "compacted", `chars=${text.length}`);
      }
    } catch {
      // Non-fatal
    }
  });
  const GOAL_DOC_PATTERN = /^docs\/(adr|architecture|runbook|api)\//;

  pi.on("tool_result", async (event, ctx) => {
    const toolName = event.toolName;

    if (toolName === "subagent" && event.isError) {
      const details = event.details as SubagentDetails | undefined;
      const aborted = details?.results?.some((result) => result.stopReason === "aborted");
      if (aborted) {
        persistWorkflowState(pi, {
          interrupted: true,
          interruptedReason: "subagent_aborted",
          interruptedAt: new Date().toISOString(),
        });
      }
    }

    if (currentPhase === "idle") return;
    if (toolName !== "write" && toolName !== "edit") return;

    const filePath = event.input.path as string | undefined;
    if (!filePath) return;

    const relativePath = relative(ctx.cwd, filePath).replace(/\\/g, "/");
    const nextPartial: Partial<ExtensionState> = {
      lastArtifactPath: relativePath,
      interrupted: false,
      interruptedReason: null,
      interruptedAt: null,
    };

    if (GOAL_DOC_PATTERN.test(relativePath)) {
      nextPartial.activeGoalDocument = relativePath;
    }

    persistWorkflowState(pi, nextPartial);
  });

  pi.registerCommand("clarify", {
    description:
      "Start agentic-clarification — the agent asks dynamic questions to resolve ambiguity",
    handler: async (args, ctx) => {
      const topic = args?.trim() || "";
      const start = await ctx.ui.confirm(
        "Start Clarification",
        "The agent will ask you questions one at a time to clarify your request.\nIt will also explore the codebase in parallel.\n\nProceed?"
      );
      if (!start) return;

      if (topic) pi.setSessionName(makeSessionName("Clarify", topic));
      persistWorkflowState(pi, {
        phase: "clarifying",
        activeGoalDocument: null,
        lastCommand: "clarify",
        lastTopic: topic || workflowState.lastTopic,
        interrupted: false,
        interruptedReason: null,
        interruptedAt: null,
      });
      ctx.ui.setStatus("JINHO", "Clarification in progress...");

      const prompt = topic
        ? `The user wants to clarify the following task: "${topic}"\n\nBegin the agentic-clarification process. Follow the agentic-clarification skill rules.\n- Ask ONE question using the ask_user_question tool.\n- Use the subagent tool with agent 'explorer' to investigate the relevant codebase area in parallel.\n- Build up a clear Context Brief.`
        : `The user wants to start an agentic-clarification session.\n\nBegin the agentic-clarification process. Follow the agentic-clarification skill rules.\n- Ask ONE question using the ask_user_question tool to understand what the user wants to accomplish.\n- Use the subagent tool with agent 'explorer' to investigate the codebase in parallel.\n- Build up a clear Context Brief.`;

      pi.sendUserMessage(prompt);
    },
  });

  pi.registerCommand("plan", {
    description:
      "Generate an implementation plan — the agent follows agentic-plan-crafting skill rules",
    handler: async (args, ctx) => {
      const ok = await ctx.ui.confirm(
        "Start Agentic Plan Crafting",
        "The agent will create an executable implementation plan based on current context using the agentic-plan-crafting workflow.\n\nProceed?"
      );
      if (!ok) return;

      const topic = args?.trim() || "";
      if (topic) pi.setSessionName(makeSessionName("Plan", topic));
      persistWorkflowState(pi, {
        phase: "planning",
        lastCommand: "plan",
        lastTopic: topic || workflowState.lastTopic,
        interrupted: false,
        interruptedReason: null,
        interruptedAt: null,
      });
      ctx.ui.setStatus("JINHO", "Agentic planning workflow in progress...");

      const prompt = topic
        ? `Create an executable implementation plan for: "${topic}"\n\nFollow the agentic-plan-crafting skill rules.\n- If a Context Brief exists from a previous /clarify, use it as input.\n- Each step must specify: exact file path, what changes, why.\n- Every step must be concrete — no placeholders like 'implement the service'.`
        : `Create an executable implementation plan for the current task.\n\nFollow the agentic-plan-crafting skill rules.\n- If a Context Brief exists from a previous /clarify, use it as input.\n- If not, use ask_user_question to confirm scope and approach.\n- Each step must be concrete — no placeholders.\n- End with a Self-Review.`;

      pi.sendUserMessage(prompt);
    },
  });

  pi.registerCommand("ultraplan", {
    description:
      "Decompose a complex task into milestones — the agent dynamically selects reviewers",
    handler: async (args, ctx) => {
      const confirmed = await ctx.ui.confirm(
        "Start Agentic Milestone Planning (Ultraplan)",
        "The agent will:\n1. Compose a Problem Brief\n2. Decide which reviewer perspectives are needed\n3. Dispatch reviewers in parallel\n4. Synthesize a milestone DAG\n\nProceed?"
      );
      if (!confirmed) return;

      const topic = args?.trim() || "";
      if (topic) pi.setSessionName(makeSessionName("Ultraplan", topic));
      persistWorkflowState(pi, {
        phase: "ultraplanning",
        lastCommand: "ultraplan",
        lastTopic: topic || workflowState.lastTopic,
        interrupted: false,
        interruptedReason: null,
        interruptedAt: null,
      });
      ctx.ui.setStatus("JINHO", "Agentic milestone workflow in progress...");

      const prompt = topic
        ? `Decompose the following task into milestones: "${topic}"\n\nFollow the agentic-milestone-planning skill rules.\n1. Compose a Problem Brief — identify which parts of the codebase are affected.\n2. Dispatch all 5 reviewer agents in parallel: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.\n3. Synthesize findings into a milestone DAG.`
        : `Decompose the current task into milestones.\n\nFollow the agentic-milestone-planning skill rules.\n1. Compose a Problem Brief — identify the scope and affected components.\n2. Dispatch all 5 reviewer agents in parallel: reviewer-feasibility, reviewer-architecture, reviewer-risk, reviewer-dependency, reviewer-user-value.\n3. Synthesize their findings into a milestone DAG.`;

      pi.sendUserMessage(prompt);
    },
  });

  pi.registerCommand("resume", {
    description: "Browse previous sessions by workspace and resume one with OMJ workflow restoration",
    handler: async (_args, ctx) => {
      const sessions = await SessionManager.listAll();
      const currentSessionPath = ctx.sessionManager.getSessionFile();
      const resumableSessions = sessions
        .filter((session) => session.path !== currentSessionPath)
        .sort((a, b) => b.modified.getTime() - a.modified.getTime());

      if (resumableSessions.length === 0) {
        ctx.ui.notify("No previous sessions found.", "info");
        return;
      }

      const grouped = new Map<string, typeof resumableSessions>();
      for (const session of resumableSessions) {
        const key = toWorkspaceKey(session.cwd);
        const bucket = grouped.get(key);
        if (bucket) bucket.push(session);
        else grouped.set(key, [session]);
      }

      while (true) {
        const workspaceChoices = Array.from(grouped.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([workspace, list]) => `${workspace} (${list.length})`);

        const workspaceChoice = await ctx.ui.select(
          "Choose a workspace to resume from:",
          [...workspaceChoices, "Cancel"],
        );

        if (!workspaceChoice || workspaceChoice === "Cancel") return;

        const workspace = workspaceChoice.replace(/ \(\d+\)$/, "");
        const group = grouped.get(workspace);
        if (!group || group.length === 0) continue;

        const sessionChoices = group.map((session) => formatSessionChoice(session, currentSessionPath));
        const sessionChoice = await ctx.ui.select(
          `Choose a session in ${workspace}:`,
          [...sessionChoices, "← Back"],
        );

        if (!sessionChoice || sessionChoice === "← Back") continue;

        const selected = group.find(
          (session) => formatSessionChoice(session, currentSessionPath) === sessionChoice,
        );
        if (!selected) continue;

        const result = await ctx.switchSession(selected.path);
        if (result.cancelled) {
          ctx.ui.notify("Resume cancelled.", "info");
        }
        return;
      }
    },
  });

  pi.registerCommand("ask", {
    description: "Manual smoke test for the ask_user_question tool",
    handler: async (args, ctx) => {
      const topic = args?.trim() || "Ask me one focused question using the ask_user_question tool.";
      const confirmed = await ctx.ui.confirm(
        "Run /ask",
        "The agent will send a manual prompt that requires one ask_user_question tool call.\n\nProceed?"
      );
      if (!confirmed) return;

      persistWorkflowState(pi, {
        phase: "idle",
        lastCommand: null,
        interrupted: false,
        interruptedReason: null,
        interruptedAt: null,
      });
      ctx.ui.setStatus("JINHO", "Manual ask_user_question test in progress...");

      pi.sendUserMessage(
        `Manual tool test: use the ask_user_question tool exactly once, then stop. User context: "${topic}"`
      );
    },
  });

  const setupHandler = async (_args: string, ctx: any) => {
    const settingsPath = join(homedir(), ".pi", "agent", "settings.json");

    let current: Record<string, unknown> = {};
    try {
      const raw = await readFile(settingsPath, "utf-8");
      current = JSON.parse(raw);
    } catch {
    }

    if (current.quietStartup === true) {
      ctx.ui.notify("Settings already configured — quietStartup is true.", "info");
      return;
    }

    const ok = await ctx.ui.confirm(
      "Setup: Configure Recommended Settings",
      [
        "This will add \"quietStartup\": true to your settings.json:",
        `  ${settingsPath}`,
        "",
        "This hides the default Skills/Extensions/Themes listing at startup.",
        "The JINHO banner takes over instead.",
        "",
        "Proceed?",
      ].join("\n"),
    );
    if (!ok) return;

    const updated = { ...current, quietStartup: true };
    await mkdir(dirname(settingsPath), { recursive: true });
    await writeFile(settingsPath, JSON.stringify(updated, null, 2) + "\n");

    ctx.ui.notify("Settings updated — quietStartup is now true. Restart pi to see the effect.", "info");
  };

  pi.registerCommand("init", {
    description:
      "Configure recommended settings — sets quietStartup: true in ~/.pi/agent/settings.json",
    handler: setupHandler,
  });

  pi.registerCommand("setup", {
    description:
      "Configure recommended settings — sets quietStartup: true in ~/.pi/agent/settings.json",
    handler: setupHandler,
  });

  pi.registerCommand("reset-phase", {
    description: "Reset the workflow phase to idle (clears clarify/plan/ultraplan mode)",
    handler: async (_args, ctx) => {
      persistWorkflowState(pi, {
        phase: "idle",
        activeGoalDocument: null,
        interrupted: false,
        interruptedReason: null,
        interruptedAt: null,
      });
      ctx.ui.setStatus("JINHO", undefined);
      ctx.ui.notify("Workflow phase reset to idle.", "info");
    },
  });

  pi.on("agent_start", async () => {
    agentRunActive = true;
    assistantMessageCompleted = false;
  });

  pi.on("agent_end", async (_event, _ctx) => {
    if (agentRunActive) {
      if (!assistantMessageCompleted && currentPhase !== "idle") {
        persistWorkflowState(pi, {
          interrupted: true,
          interruptedReason: "agent_interrupted",
          interruptedAt: new Date().toISOString(),
        });
      } else if (workflowState.interrupted) {
        persistWorkflowState(pi, {
          interrupted: false,
          interruptedReason: null,
          interruptedAt: null,
        });
      }
    }

    agentRunActive = false;
    assistantMessageCompleted = false;
  });

  pi.on("message_end", async (event, _ctx) => {
    const msg = event.message;
    if (msg.role === "assistant") {
      assistantMessageCompleted = true;
      const usage = msg.usage;
      if (usage) {
        cacheStats.totalInput += usage.input;
        cacheStats.totalCacheRead += usage.cacheRead;
      }
    }
  });

  pi.on("tool_execution_start", async (event, _ctx) => {
    activeTools.running.set(event.toolCallId, event.toolName);
  });

  pi.on("tool_execution_end", async (event, _ctx) => {
    activeTools.running.delete(event.toolCallId);
  });

  pi.on("session_before_switch", async (_event, _ctx) => {
    if (!agentRunActive || currentPhase === "idle") return;
    persistWorkflowState(pi, {
      interrupted: true,
      interruptedReason: "session_switch",
      interruptedAt: new Date().toISOString(),
    });
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    if (!agentRunActive || currentPhase === "idle") return;
    persistWorkflowState(pi, {
      interrupted: true,
      interruptedReason: "session_shutdown",
      interruptedAt: new Date().toISOString(),
    });
  });

  pi.on("session_tree", async (_event, ctx) => {
    restoreWorkflowState(ctx);
  });

  pi.on("session_start", async (event, ctx) => {
    restoreWorkflowState(ctx);
    currentWorkspace = ctx.cwd ?? "";

    try {
      const sessionFile = ctx.sessionManager.getSessionFile() ?? "unknown";
      getMemoryDb().upsertSession({
        session_id: sessionFile,
        workspace: currentWorkspace,
        phase: workflowState.phase,
        last_command: workflowState.lastCommand ?? null,
        last_topic: workflowState.lastTopic ?? null,
        last_artifact_path: workflowState.lastArtifactPath ?? null,
        resume_summary: workflowState.resumeSummary ?? null,
        interrupted: workflowState.interrupted ? 1 : 0,
        interrupted_reason: workflowState.interruptedReason ?? null,
      });
      getMemoryDb().insertEvent(sessionFile, currentWorkspace, "session_start", `reason=${event.reason}`);
    } catch {
      // Non-fatal
    }

    cacheStats.totalInput = 0;
    cacheStats.totalCacheRead = 0;
    activeTools.running.clear();
    agentRunActive = false;
    assistantMessageCompleted = false;

    // Find project context file path (walk up from cwd) — content is re-read every turn in before_agent_start
    try {
      projectContextPath = await findProjectContextFile(ctx.cwd);
      if (projectContextPath) {
        projectContext = await readFile(projectContextPath, "utf-8");
        ctx.ui.notify(`${basename(projectContextPath)} found — context will refresh every turn (${projectContextPath})`, "info");
      } else {
        projectContextPath = null;
        projectContext = "";
      }
    } catch {
      projectContextPath = null;
      projectContext = "";
    }

    idsModeActive = isIdsMode(projectContextPath, ctx.cwd);
    ctx.ui.notify(buildIdsModeNotice(idsModeActive), idsModeActive ? "info" : "warning");

    ctx.ui.setHeader((_tui, theme) => {
      const banner = [
        "     ██╗██╗███╗   ██╗██╗  ██╗ ██████╗ ",
        "     ██║██║████╗  ██║██║  ██║██╔═══██╗",
        "     ██║██║██╔██╗ ██║███████║██║   ██║",
        "██   ██║██║██║╚██╗██║██╔══██║██║   ██║",
        "╚█████╔╝██║██║ ╚████║██║  ██║╚██████╔╝",
        " ╚════╝ ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝ ╚═════╝ ",
      ].map(line => theme.bold(theme.fg("accent", line))).join("\n");

      const tagline = theme.fg(
        "dim",
        idsModeActive
          ? "oh-my-jinho — IDS-focused Agentic Harness"
          : "oh-my-jinho — Agentic Harness (add IDS.md for IDS mode)",
      );

      const tips = [
        "Use /clarify first, then /plan for IDS-safe implementation sequencing.",
        "Keep IDS.md current to enforce DDD layer rules and phase constraints.",
        "Use /resume to continue interrupted IDS workflows.",
      ];
      const randomTip = tips[Math.floor(Math.random() * tips.length)];
      const tipLine = theme.fg("muted", `Tip: ${randomTip}`);
      const clarifyLine = theme.fg("dim", "However, in most cases, it's best to start with /clarify.");

      const hints = [
        keyHint("app.interrupt", "to interrupt"),
        keyHint("app.clear", "to clear"),
        rawKeyHint(`${keyText("app.clear")} twice`, "to exit"),
        keyHint("app.tools.expand", "to expand tools"),
        rawKeyHint("/", "for commands"),
        rawKeyHint("!", "to run bash"),
      ].join("\n");

      return new Text(`\n${banner}\n${tagline}\n\n${tipLine}\n${clarifyLine}\n\n${hints}`, 1, 0);
    });

    ctx.ui.setFooter((_tui, theme, footerData) => {
      return new JinhoFooter(theme, footerData, {
        cwd: ctx.cwd,
        getModelName: () => ctx.model?.name,
        getContextUsage: () => ctx.getContextUsage(),
      }, cacheStats, activeTools);
    });

    if (event.reason === "resume" && workflowState.interrupted) {
      ctx.ui.notify(
        `Resumed interrupted workflow (${describeInterruptReason(workflowState.interruptedReason)}).`,
        "warning",
      );
    } else if (event.reason === "resume" && workflowState.phase !== "idle") {
      ctx.ui.notify(`Resumed ${workflowState.phase} workflow.`, "info");
    }

    ctx.ui.notify(
      idsModeActive
        ? "oh-my-jinho (IDS mode) loaded: /clarify, /plan, /ultraplan, /resume, /reset-phase"
        : "oh-my-jinho loaded: /clarify, /plan, /ultraplan, /resume, /reset-phase",
      "info"
    );

    if (event.reason === "resume") {
      const resumePrompt = getResumePromptForState(workflowState);
      if (resumePrompt) {
        pi.sendUserMessage(resumePrompt);
      }
    }
  });
}
