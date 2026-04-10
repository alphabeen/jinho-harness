# JINHO — IDS Agentic Harness

[pi coding agent](https://github.com/badlogic/pi-mono) extension for the IDS (Intelligent Deployment System) project.

Adds structured workflow to pi — **clarify → plan → milestone → execute**.

The agent asks questions until it fully understands the request (while reading the codebase in parallel), then builds a plan and executes it.

---

## Features

- **`/clarify`** — Agent asks dynamic questions one at a time to resolve ambiguity. Explores codebase in parallel. Ends with a Context Brief.
- **`/plan`** — Generates an executable implementation plan from the Context Brief. No placeholders.
- **`/ultraplan`** — Dispatches 5 reviewer agents in parallel (feasibility, architecture, risk, dependency, user-value), synthesizes into a milestone DAG.
- **`/ids-phase`** — Scans the IDS codebase for TODO stubs and reports Phase 0 readiness.
- **`/reset-phase`** — Resets workflow to idle.

## IDS-Specific

All agents are pre-loaded with IDS context:
- 4-layer DDD architecture (application / domain / ports / infrastructure)
- Service domains: planning, prediction, deployment, alerting
- Confirmed design values: Flavor thresholds, ML input shape (24×31), score formula
- Phase 0 (MVP 4/20) vs Phase 1 (5/15) awareness
- OpenStack/Aolda small-scale risk rules

## Installation

```bash
pi install git:alphabeen/jinho-harness
```

Run `/setup` after installation to configure recommended settings.

## Usage

```bash
pi
```

Then use slash commands:

1. `/clarify` — resolve ambiguity before planning
2. `/plan` — create an executable implementation plan
3. `/ultraplan` — decompose complex tasks into milestones
4. `/ids-phase` — check Phase 0 progress
5. `/reset-phase` — reset workflow to idle

## Agents

| Agent | Role |
|-------|------|
| `explorer` | Read-only codebase investigation |
| `worker` | General execution |
| `planner` | Implementation planning |
| `plan-worker` | Executes plan steps exactly |
| `plan-compliance` | Verifies preconditions |
| `plan-validator` | Independent verification |
| `synthesis` | Synthesizes reviewer outputs |
| `reviewer-feasibility` | Technical feasibility |
| `reviewer-architecture` | 4-layer DDD compliance |
| `reviewer-risk` | OpenStack/ML/small-scale risk |
| `reviewer-dependency` | Component dependencies |
| `reviewer-user-value` | End-user impact |
| `slop-cleaner` | AI code smell cleanup |

## Skills (14)

clarification, plan-crafting, milestone-planning, run-plan, review-work, long-run, brainstorming, clean-ai-slop, karpathy, simplify, rob-pike, systematic-debugging, **ids-workflow** (IDS-specific checklist)
