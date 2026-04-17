# oh-my-jinho — Agentic Coding Harness

[pi coding agent](https://github.com/badlogic/pi-mono) 확장으로, **clarify → plan → milestone → execute** 워크플로우를 추가합니다.

에이전트가 요청을 완전히 이해할 때까지 질문을 던지면서(코드베이스도 병렬로 읽어요), 이해한 바탕으로 계획을 세워 실행합니다.

프로젝트별 컨텍스트는 아래 우선순위로 자동 탐색합니다(상위 디렉토리까지 탐색).

1. `IDS.md` (기본 우선)
2. `OMJ.md` (하위 호환)
3. `PROJECT_CONTEXT.md`
4. `AGENT_CONTEXT.md`

매 턴마다 re-read되므로 세션 재시작 없이 파일 수정이 반영됩니다.

---

## 웹사이트

한국어 설치/빠른 시작 페이지:

- GitHub Pages: `https://alphabeen.github.io/oh-my-jinho/`
- 로컬 미리보기: `docs/index.html` 직접 열기

> 영어 토글/이중언어 페이지는 다음 배치에서 추가합니다.

---

## 설치

```bash
pi install git:alphabeen/oh-my-jinho
```

설치 후 **반드시** `/setup` 실행 (quietStartup 설정).

특정 버전으로 설치:
```bash
pi install git:alphabeen/oh-my-jinho#v1.0.0
```

## IDS 전용 운용 (Soft Mode)

기본 동작은 IDS 중심으로 맞춰져 있습니다.

- `IDS.md`가 있으면 **IDS mode active**로 시작하며, IDS 규칙(DDD 레이어/Phase 안전 규칙)을 우선 적용합니다.
- `IDS.md`가 없어도 하네스는 동작하지만, 시작 시 경고가 표시되고 일반 모드로 실행됩니다.
- 하드 차단(비-IDS 작업 거부)은 이번 범위에 포함되지 않습니다.

### 시작 직후 확인 방법

pi 재시작 후 아래 순서로 확인하세요.

1. 시작 알림에 `IDS mode active` 또는 `IDS mode inactive`가 표시되는지 확인
2. `/mode` 실행
3. `Context file`이 기대값(예: `.../IDS.md`)인지 확인

문제가 있으면 실행 위치(`cwd`)와 `IDS.md` 존재 경로를 먼저 점검하세요.

---

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/clarify [주제]` | 요청 명확화 — 질문을 하나씩 던지며 Context Brief 작성 |
| `/plan [주제]` | 실행 가능한 구현 계획 생성 (플레이스홀더 없음) |
| `/ultraplan [주제]` | 복잡한 작업을 마일스톤 DAG로 분해 (5개 reviewer 병렬 실행) |
| `/resume` | workspace별 이전 세션 목록을 보고 선택한 세션으로 진입한 뒤 작업 흐름을 이어감 |
| `/mode` | 현재 IDS 모드 상태(active/inactive), 컨텍스트 파일, workflow snapshot 표시 |
| `/reset-phase` | 워크플로우를 idle로 초기화 |

---

## 프로젝트 컨텍스트 자동 주입

프로젝트 루트(혹은 상위 디렉토리)에서 아래 순서로 컨텍스트 파일을 찾습니다.

1. `IDS.md` (기본 우선)
2. `OMJ.md` (하위 호환)
3. `PROJECT_CONTEXT.md`
4. `AGENT_CONTEXT.md`

- **매 턴 re-read** — 세션 중 파일 수정 시 즉시 반영 (재시작 불필요)
- **없어도 동작** — 컨텍스트 파일이 없으면 기본 모드로 실행
- **내용은 자유** — 기술 스택, 아키텍처 규칙, 설계값, 체크리스트 등 팀 규약을 자유롭게 기술

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

## 스킬 (12개)

`agentic-clarification`, `agentic-plan-crafting`, `agentic-milestone-planning`, `agentic-run-plan`, `agentic-review-work`, `agentic-long-run`, `agentic-brainstorming`, `agentic-clean-ai-slop`, `agentic-karpathy`, `agentic-simplify`, `agentic-rob-pike`, `agentic-systematic-debugging`

---

## Capabilities Matrix

| 기능 | command | 필요조건 | 결과물 | 실패 시 대응 |
|---|---|---|---|---|
| 요구사항 명확화 | `/clarify` | 작업 목표가 모호함 | Context Brief | 추가 질문으로 범위 재고정 |
| 실행 계획 수립 | `/plan` | 범위가 명확함 | 실행 가능한 plan 문서 | `/clarify`로 돌아가 모호성 해소 |
| 복잡 작업 분해 | `/ultraplan` | 멀티 단계/리스크 높음 | milestone DAG | reviewer 의견 기반 재분해 |
| 세션 재개 | `/resume` | 이전 세션 존재 | 복원된 workflow 상태 | `/reset-phase` 후 재시작 |
| 단계 초기화 | `/reset-phase` | phase 전환 필요 | idle 상태 | 다시 `/clarify`부터 진행 |

## 동작 방식

```
pi --extension ~/.pi/agent/extensions/alphabeen/oh-my-jinho/index.ts
```

pi가 설치를 관리하므로 `pi install` 이후에는 위 경로를 직접 쓸 필요 없습니다.

짧은 TypeScript + Markdown으로 구성되어 있어 동작 방식을 직접 읽어볼 수 있습니다.
