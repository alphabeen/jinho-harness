// discipline.ts
import type { AgentConfig } from "./agents.js";

const DISCIPLINE_AGENTS = new Set(["plan-worker", "worker"]);

export function isDisciplineAgent(name: string): boolean {
  return DISCIPLINE_AGENTS.has(name);
}

export const KARPATHY_RULES = `

## Engineering Discipline: Karpathy Rules (Auto-Injected)

You MUST follow these behavioral guardrails during implementation:

### Hard Gates
1. **Read before you write** — Never modify a file you haven't read first.
2. **Scope to the request** — Change only what was asked. No "while I'm here" improvements.
3. **Verify, don't assume** — If you think something is "probably" true, grep and check first.
4. **Define success before starting** — Know what "done" looks like before writing code.

### Rules
1. **Surgical Changes** — Minimum edit to achieve the goal. No opportunistic refactoring.
2. **Match Existing Patterns** — Follow the project's conventions, not your preferences.
3. **No Premature Abstraction** — Don't add factories, wrappers, or "extensible" patterns unless asked.
4. **No Defensive Paranoia** — Don't add null checks for guaranteed values or error handling for impossible scenarios.
5. **No Future-Proofing** — Solve today's problem. Don't solve problems that don't exist yet.

### Anti-Patterns (Never Do These)
- "While I'm here" refactoring of nearby code
- Adding error handling for scenarios that cannot occur
- Making code "extensible" or "future-proof" without being asked
- Improving type safety on code you weren't asked to change
- Adding comments that restate what the code does
`;

export const IDS_RULES = `

## IDS Project Context (Auto-Injected)

You are working on **IDS (Intelligent Deployment System)** — an AI-driven cloud resource prediction and auto-deployment system targeting Aolda (아올다, Ajou University OpenStack).

### Tech Stack
- **Language**: Python 3.11, strict type hints everywhere
- **API**: FastAPI (async endpoints), Pydantic v2 models
- **DB**: MySQL + SQLAlchemy 2.0 (\`Mapped[T]\`, \`mapped_column\`, \`DeclarativeBase\`)
- **ML**: TensorFlow 2.16+, LSTM, input_shape=(24, 31), target=\`resource_demand_score\`
- **Infra**: OpenStack (openstacksdk), Docker Compose
- **Alerting**: Discord Webhook

### Architecture — 4-Layer DDD (per service)
Every \`services/<domain>/\` follows this strict layering:
\`\`\`
application/   ← UseCase orchestration only. No business rules here.
domain/        ← Entities, policies, value objects. Pure Python, no I/O.
ports/         ← ABC interfaces. Contracts — never change silently.
infrastructure/ ← Port implementations (OpenStack, MySQL, CSV).
\`\`\`
**Layer rules:**
- \`domain/\` must never import from \`infrastructure/\` or \`application/\`
- \`ports/\` defines the interface; \`infrastructure/\` implements it
- Changing a port interface = changing a contract → update ALL implementations

### Service Domains
- **planning**: generate_plan, generate_hourly_plan → route project to flavor
- **prediction**: LSTM 24h forecast, 31 input features, \`resource_demand_score\` target
- **deployment**: OpenStack VM create/destroy, flavor: small/medium/large
- **alerting**: Discord notification with dedup logic

### Error Hierarchy
\`\`\`python
IDSError → PredictionError, DeploymentError, NotFoundError, ValidationError
\`\`\`
Always raise domain-specific errors, never bare \`Exception\`.

### Confirmed Design Values (do not change without explicit instruction)
- **Flavor thresholds**: avg_score >= 0.70 → large, >= 0.35 → medium, else → small
- **ML input**: 31 features (resource_demand_score excluded as target)
- **ML score formula**: (0.5 × cpu_util + 0.3 × memory_util) / 0.8 (network 결측 시)
- **LSTM window**: 24 timesteps
- **Imputation**: network/disk → 0.5, scale_net → 0 when missing

### Development Phase (2026-04-10 기준)
- **Phase 0 (MVP, 4/20)**: C-1~C-5 critical fixes, CSV data only, MySQL+SQLAlchemy, DRY_RUN mode
- **Phase 1 (5/15)**: OpenStack live data, libs/ full separation, H-1~H-5 fixes
- **Phase 2 (6월~)**: TFT model, Federated Learning

### What's TODO (Phase 0)
Most \`services/\` domain files still have \`# TODO\` stubs. When implementing:
- Check \`mcp_core/\` reference in TODO comments for migration source
- Preserve existing function signatures (callers depend on them)
- \`services/deployment/infrastructure/openstack/\` is the single source for OpenStack logic
`;

export function augmentAgentWithKarpathy(agent: AgentConfig | undefined): AgentConfig | undefined {
  if (!agent) return agent;
  return {
    ...agent,
    systemPrompt: agent.systemPrompt + KARPATHY_RULES,
  };
}

export function augmentAgentWithIdsContext(agent: AgentConfig | undefined): AgentConfig | undefined {
  if (!agent) return agent;
  return {
    ...agent,
    systemPrompt: agent.systemPrompt + IDS_RULES,
  };
}

/** Augment with both Karpathy rules AND IDS context. Used for discipline agents. */
export function augmentAgentForIds(agent: AgentConfig | undefined): AgentConfig | undefined {
  return augmentAgentWithKarpathy(augmentAgentWithIdsContext(agent));
}

export function getSlopCleanerTask(): string {
  return `Review the most recently changed files in this project and clean up any AI-generated code smells.

Steps to identify changed files:
1. Run \`git status\` to see uncommitted changes
2. Run \`git diff --name-only HEAD~1\` to see the last commit's changes
3. Focus on the source files identified above (skip test files, config files, lock files)

Follow your 6-pass cleanup process on those files. Run tests after each pass.
If no AI slop is found, report "No cleanup needed" and exit.`;
}
