# agentic-ids-workflow

Rules for working on IDS (Intelligent Deployment System) tasks.

## When to Use

Apply these rules whenever implementing, reviewing, or planning changes to the IDS codebase.

---

## 1. Layer Verification (Before Every Change)

Before writing any code, answer these questions:

1. **Which service domain?** planning / prediction / deployment / alerting
2. **Which layer?** application / domain / ports / infrastructure
3. **Is a port interface changing?** If yes → find all `infrastructure/` implementations and update them too.
4. **Is this Phase 0 or Phase 1?** Phase 0 = MVP 4/20, Phase 1 = 5/15.

If you cannot answer all four, use `/clarify` first.

---

## 2. IDS Implementation Checklist

### For any `domain/` file:
- [ ] No I/O operations (no file reads, no network calls, no DB queries)
- [ ] No imports from `infrastructure/` or `application/`
- [ ] Pure Python: entities, value objects, policies
- [ ] Uses `IDSError` subclasses for domain violations

### For any `ports/` file:
- [ ] Defines an ABC (`from abc import ABC, abstractmethod`)
- [ ] Every method has type hints
- [ ] Docstring explains what the contract guarantees
- [ ] **Alert**: changing this file breaks all implementations — list them before proceeding

### For any `infrastructure/` file:
- [ ] Implements exactly one port ABC
- [ ] All I/O is here (OpenStack SDK, SQLAlchemy, CSV reads)
- [ ] Async where the framework is async (aiomysql, httpx)
- [ ] Errors wrapped into appropriate `IDSError` subclasses before re-raising

### For any `application/` file:
- [ ] Uses only ports (injected or imported) — never imports infrastructure directly
- [ ] Orchestrates: calls domain logic, calls ports, returns result
- [ ] No business rules embedded here (those belong in `domain/`)

---

## 3. Migrating from mcp_core/

When a TODO says `ref: mcp_core/<path>`:

1. Read the source file in `mcp_core/`
2. Identify what changes are required:
   - Replace in-memory storage → MySQL+SQLAlchemy persistence
   - Replace bare `Exception` → `IDSError` subclasses
   - Replace hardcoded values → use `libs/settings/base.py` `Settings`
   - Adjust `context_scale` or model parameters for Aolda small-scale
3. Preserve function signatures unless the TODO explicitly says to change them
4. Write the IDS version in the correct layer

---

## 4. Confirmed Design Values (Never Redesign Without Instruction)

| Value | Location | Description |
|-------|----------|-------------|
| Flavor: large | avg_score >= 0.70 | `services/deployment/domain/flavor_mapper.py` |
| Flavor: medium | avg_score >= 0.35 | |
| ML input shape | (24, 31) | 24 timesteps × 31 features |
| ML target | `resource_demand_score` | excluded from input features |
| Score formula | (0.5×cpu + 0.3×mem) / 0.8 | network missing case |
| Imputation: network/disk | 0.5 | neutral value |
| pct_change clip | (-3, 3) | preserves signal, removes inf |

---

## 5. Phase 0 Safety Rules

Phase 0 is the MVP targeting real Aolda deployment (4/20). Safety is critical:

- All deployment commands must check `DRY_RUN` flag before calling OpenStack
- `deploy_policy.py` safety cap must reflect Aolda's 3~10 VM scale (not large-cloud scale)
- Never bypass the `flavor_mapper.py` thresholds
- Any change to OpenStack client must be in `services/deployment/infrastructure/openstack/` only

---

## 6. Test Requirements

For each implementation:
- **domain/** changes → unit tests in `tests/unit/<domain>/`
- **ports/** + **infrastructure/** changes → integration tests in `tests/integration/`
- **API endpoint** changes → contract tests in `apps/api/tests/contract/`
- Run `pytest tests/unit/` at minimum before considering a task complete
