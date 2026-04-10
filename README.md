# JINHO — IDS 전용 Agentic Harness

[pi coding agent](https://github.com/badlogic/pi-mono) 확장으로, IDS(Intelligent Deployment System) 프로젝트에 특화된 워크플로우를 추가합니다.

**clarify → plan → milestone → execute** 순서로 동작해요.
에이전트가 요청을 완전히 이해할 때까지 질문을 던지면서(코드베이스도 병렬로 읽어요), 이해한 바탕으로 계획을 세워 실행합니다.

---

## 설치

```bash
pi install git:alphabeen/jinho-harness
```

설치 후 `/setup` 실행 (quietStartup 설정).

특정 버전으로 설치:
```bash
pi install git:alphabeen/jinho-harness#v1.0.0
```

---

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/clarify [주제]` | 요청 명확화 — 질문을 하나씩 던지며 Context Brief 작성 |
| `/plan [주제]` | 실행 가능한 구현 계획 생성 (플레이스홀더 없음) |
| `/ultraplan [주제]` | 복잡한 작업을 마일스톤 DAG로 분해 (5개 reviewer 병렬 실행) |
| `/ids-phase` | IDS Phase 0 진행률 확인 (TODO 스텁 기준) |
| `/reset-phase` | 워크플로우를 idle로 초기화 |

---

## IDS 전용 기능

모든 에이전트에 IDS 컨텍스트가 자동 주입됩니다:

- **4-layer DDD 아키텍처** — `application/` → `domain/` → `ports/` → `infrastructure/` 레이어 규칙 강제
- **서비스 도메인 인식** — planning, prediction, deployment, alerting
- **확정 설계값 보호** — Flavor 임계값, ML input shape (24×31), score 공식은 명시적 지시 없이 변경 불가
- **Phase 0/1 구분** — MVP(4/20) 범위와 Phase 1(5/15) 범위를 계획 단계에서 분리
- **OpenStack/Aolda 리스크** — 소규모 환경(3~10 VM) 특화 리스크 분석

---

## 에이전트

| 에이전트 | 역할 |
|---------|------|
| `explorer` | 코드베이스 탐색 (읽기 전용) |
| `worker` | 범용 실행 |
| `planner` | 구현 계획 설계 |
| `plan-worker` | 계획 단계별 정확 실행 |
| `plan-compliance` | 전제조건 확인 |
| `plan-validator` | 독립적 검증 (정보 장벽 기반) |
| `synthesis` | reviewer 출력 종합 → 마일스톤 DAG |
| `reviewer-feasibility` | 기술적 실현 가능성 |
| `reviewer-architecture` | 4-layer DDD 컴플라이언스 |
| `reviewer-risk` | OpenStack/ML/소규모 환경 리스크 |
| `reviewer-dependency` | 컴포넌트 의존성 |
| `reviewer-user-value` | 사용자 관점 가치 |
| `slop-cleaner` | AI 코드 스멜 정리 |

---

## 스킬 (14개)

`agentic-clarification`, `agentic-plan-crafting`, `agentic-milestone-planning`, `agentic-run-plan`, `agentic-review-work`, `agentic-long-run`, `agentic-brainstorming`, `agentic-clean-ai-slop`, `agentic-karpathy`, `agentic-simplify`, `agentic-rob-pike`, `agentic-systematic-debugging`, `agentic-ids-workflow` (IDS 전용 체크리스트)

---

## 동작 방식

```
pi --extension ~/.pi/agent/extensions/alphabeen/jinho-harness/index.ts
```

pi가 설치를 관리하므로 `pi install` 이후에는 위 경로를 직접 쓸 필요 없습니다.

짧은 TypeScript + Markdown으로 구성되어 있어 동작 방식을 직접 읽어볼 수 있습니다.
