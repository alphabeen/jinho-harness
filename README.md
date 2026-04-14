# oh-my-jinho — Agentic Coding Harness

[pi coding agent](https://github.com/badlogic/pi-mono) 확장으로, **clarify → plan → milestone → execute** 워크플로우를 추가합니다.

에이전트가 요청을 완전히 이해할 때까지 질문을 던지면서(코드베이스도 병렬로 읽어요), 이해한 바탕으로 계획을 세워 실행합니다.

프로젝트별 컨텍스트는 `IDS.md` 파일에서 자동으로 읽습니다. 매 턴마다 re-read되므로 세션 재시작 없이 파일 수정이 반영됩니다.

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

설치 후 `/setup` 실행 (quietStartup 설정).

특정 버전으로 설치:
```bash
pi install git:alphabeen/oh-my-jinho#v1.0.0
```

---

## 커맨드

| 커맨드 | 설명 |
|--------|------|
| `/clarify [주제]` | 요청 명확화 — 질문을 하나씩 던지며 Context Brief 작성 |
| `/plan [주제]` | 실행 가능한 구현 계획 생성 (플레이스홀더 없음) |
| `/ultraplan [주제]` | 복잡한 작업을 마일스톤 DAG로 분해 (5개 reviewer 병렬 실행) |
| `/resume` | workspace별 이전 세션 목록을 보고 선택한 세션으로 진입한 뒤 작업 흐름을 이어감 |
| `/reset-phase` | 워크플로우를 idle로 초기화 |

---

## 프로젝트 컨텍스트 자동 주입

프로젝트 루트(혹은 상위 디렉토리)에 `IDS.md` 파일을 두면 하네스가 자동으로 읽어 모든 에이전트에 주입합니다.

- **매 턴 re-read** — 세션 중 파일 수정 시 즉시 반영 (재시작 불필요)
- **없어도 동작** — `IDS.md`가 없으면 컨텍스트 없이 실행
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

## 동작 방식

```
pi --extension ~/.pi/agent/extensions/alphabeen/oh-my-jinho/index.ts
```

pi가 설치를 관리하므로 `pi install` 이후에는 위 경로를 직접 쓸 필요 없습니다.

짧은 TypeScript + Markdown으로 구성되어 있어 동작 방식을 직접 읽어볼 수 있습니다.
