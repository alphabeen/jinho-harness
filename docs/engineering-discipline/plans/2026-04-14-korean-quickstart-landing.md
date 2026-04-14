# Korean Quickstart Landing Page Implementation Plan

> **Worker note:** Execute this plan task-by-task using the agentic-run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Convert the GitHub Pages landing page to Korean-first content and improve onboarding clarity while preserving the current static deployment setup.

**Architecture:** Keep the site as plain static HTML/CSS under `docs/` and deploy with the existing GitHub Pages workflow. Add lightweight repository verification for landing content using Vitest so future edits can be validated automatically.

**Tech Stack:** Static HTML/CSS, GitHub Actions Pages, Node + Vitest, TypeScript build check.

**Work Scope:**
- **In scope:** Korean-first content rewrite for `docs/index.html`, visual/content polish in `docs/assets/styles.css`, README wording sync, and minimal docs verification test.
- **Out of scope:** English toggle/routing (`/en/`), JS framework adoption, runtime harness behavior changes, search/versioned docs.

**Verification Strategy:**
- **Level:** build-only (current) → upgraded to test-suite via Task 0
- **Command:** `npm test`
- **What it validates:** Korean landing has required sections/phrases and key install/command content exists; prevents accidental regression in docs content.

---

## File Structure Mapping

- **Create** `tests/docs-site.test.ts` — landing content regression checks (Korean quickstart sections).
- **Modify** `docs/index.html:1-200` — Korean-first page content and enhanced onboarding sections.
- **Modify** `docs/assets/styles.css:1-220` — style enhancements for Korean readability and callout/checklist blocks.
- **Modify** `README.md:1-120` — website section wording sync for Korean-first page.

Decomposition lock:
- Task 1 (test infra) must run first so later tasks can validate against tests.
- Task 2 and Task 3 can run in parallel (different files).
- Task 4 depends on Task 2 and Task 3.

---

## Project Capability Discovery

- **Bundled agents available:** `explorer`, `worker`, `planner`, `plan-worker`, `plan-validator`, `plan-compliance`, reviewers.
- **Project agents:** none found in `.agents/` or `.pi/agents/`.
- **Project skills:** skill docs exist under `skills/*/SKILL.md`.

Use `worker` agent for execution if delegating; validator can be `plan-validator` after each task.

---

### Task 0: Create verification infrastructure for docs landing

**Dependencies:** None (must run first)
**Files:**
- Create: `tests/docs-site.test.ts`

- [ ] **Step 1: Create tests directory**

Run:
```bash
mkdir -p tests
```
Expected: `tests/` exists.

- [ ] **Step 2: Create docs landing regression test**

Write `tests/docs-site.test.ts` with the exact content below:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";

const htmlPath = "docs/index.html";

describe("Korean landing page", () => {
  it("has required quickstart sections", () => {
    expect(existsSync(htmlPath)).toBe(true);
    const html = readFileSync(htmlPath, "utf-8");

    const required = [
      'lang="ko"',
      'id="install"',
      'id="quickstart"',
      'id="commands"',
      'id="faq"',
      'pi install git:alphabeen/oh-my-jinho',
      '/clarify [주제]',
      '/plan [주제]',
      '설치',
      '빠른 시작',
      '핵심 커맨드',
    ];

    for (const token of required) {
      expect(html.includes(token), `missing token: ${token}`).toBe(true);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify infrastructure works**

Run:
```bash
npm test
```
Expected: PASS with `tests/docs-site.test.ts` discovered and passing.

- [ ] **Step 4: Commit**

```bash
git add tests/docs-site.test.ts
git commit -m "test: add docs landing regression checks"
```

---

### Task 1: Rewrite landing page to Korean-first and enhance content

**Dependencies:** Runs after Task 0 completes
**Files:**
- Modify: `docs/index.html:1-200`

- [ ] **Step 1: Replace docs/index.html with Korean-first content**

Write `docs/index.html` with the exact content below:

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>oh-my-jinho | 빠른 시작</title>
    <meta
      name="description"
      content="oh-my-jinho 익스텐션 설치부터 /clarify, /plan까지 5분 안에 시작하는 한국어 가이드"
    />
    <link rel="stylesheet" href="./assets/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="container nav">
        <a class="brand" href="#home">oh-my-jinho</a>
        <nav>
          <a href="#install">설치</a>
          <a href="#quickstart">빠른 시작</a>
          <a href="#commands">핵심 커맨드</a>
          <a href="#faq">FAQ</a>
          <a href="https://github.com/alphabeen/oh-my-jinho" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </header>

    <main id="home">
      <section class="hero container">
        <p class="eyebrow">pi를 위한 Agentic Coding Harness</p>
        <h1>요청을 명확히 하고, 실행 가능한 계획으로 바꿔서, 안전하게 구현하세요.</h1>
        <p class="subtitle">
          oh-my-jinho는 pi에 실전형 워크플로우를 추가해 모호한 요청을 Context Brief와 실행 계획으로 정리해줍니다.
        </p>
        <div class="hero-actions">
          <a class="btn primary" href="#install">바로 시작</a>
          <a class="btn" href="https://github.com/alphabeen/oh-my-jinho" target="_blank" rel="noreferrer">저장소 보기</a>
        </div>
      </section>

      <section id="install" class="section container">
        <h2>1) 설치</h2>
        <p>GitHub에서 바로 설치:</p>
        <pre><code>pi install git:alphabeen/oh-my-jinho</code></pre>
        <p>버전 고정 설치:</p>
        <pre><code>pi install git:alphabeen/oh-my-jinho#v1.0.0</code></pre>
      </section>

      <section id="quickstart" class="section container">
        <h2>2) 빠른 시작 (3단계)</h2>
        <ol class="steps">
          <li>설치 후 <code>/setup</code>을 1회 실행하세요 (quiet startup 설정).</li>
          <li><code>/clarify [주제]</code>로 Context Brief를 먼저 만드세요.</li>
          <li><code>/plan [주제]</code>로 실행 가능한 구현 계획을 생성하세요.</li>
        </ol>
        <div class="callout">
          <strong>Tip:</strong> 작업이 끊겨도 <code>/resume</code>으로 워크스페이스별 세션을 이어갈 수 있습니다.
        </div>
      </section>

      <section class="section container" id="checklist">
        <h2>3) 5분 체크리스트</h2>
        <ul class="checklist">
          <li><input type="checkbox" disabled /> pi install 완료</li>
          <li><input type="checkbox" disabled /> /setup 실행 완료</li>
          <li><input type="checkbox" disabled /> /clarify로 범위 확정</li>
          <li><input type="checkbox" disabled /> /plan으로 실행 계획 확보</li>
        </ul>
      </section>

      <section id="commands" class="section container">
        <h2>핵심 커맨드</h2>
        <table>
          <thead>
            <tr><th>커맨드</th><th>설명</th></tr>
          </thead>
          <tbody>
            <tr><td><code>/clarify [주제]</code></td><td>요청을 질문 기반으로 명확화하고 Context Brief를 만듭니다.</td></tr>
            <tr><td><code>/plan [주제]</code></td><td>실행 가능한 구현 계획을 만듭니다.</td></tr>
            <tr><td><code>/ultraplan [주제]</code></td><td>복잡한 작업을 마일스톤 DAG로 분해합니다.</td></tr>
            <tr><td><code>/resume</code></td><td>이전 세션으로 돌아가 작업 흐름을 이어갑니다.</td></tr>
            <tr><td><code>/reset-phase</code></td><td>워크플로우 상태를 idle로 초기화합니다.</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section container">
        <h2>컨텍스트 주입 방식</h2>
        <p>
          프로젝트 루트(또는 상위 디렉토리)에 <code>IDS.md</code>가 있으면,
          하네스가 이를 자동 탐색하고 매 턴 다시 읽어 최신 팀 규칙을 반영합니다.
        </p>
      </section>

      <section id="faq" class="section container">
        <h2>FAQ</h2>
        <details>
          <summary>매번 --extension 경로를 직접 지정해야 하나요?</summary>
          <p>아니요. <code>pi install</code> 이후에는 pi가 설치 경로를 관리합니다.</p>
        </details>
        <details>
          <summary>코드를 자동으로 막 수정하나요?</summary>
          <p>명시적으로 write/edit가 실행될 때만 파일이 바뀝니다. 기본은 명확화와 계획 수립부터 진행합니다.</p>
        </details>
      </section>
    </main>

    <footer class="footer">
      <div class="container">
        <p>MIT License · Built for pi workflows · <a href="https://github.com/alphabeen/oh-my-jinho" target="_blank" rel="noreferrer">GitHub</a></p>
      </div>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Validate required Korean tokens exist**

Run:
```bash
python - <<'PY'
from pathlib import Path
html = Path('docs/index.html').read_text(encoding='utf-8')
required = ['lang="ko"', '빠른 시작', '핵심 커맨드', '/clarify [주제]', '/plan [주제]', '5분 체크리스트']
missing = [r for r in required if r not in html]
assert not missing, f'Missing Korean content tokens: {missing}'
print('PASS: Korean landing content present')
PY
```
Expected: `PASS: Korean landing content present`

- [ ] **Step 3: Commit**

```bash
git add docs/index.html
git commit -m "docs: rewrite landing page to Korean-first quickstart"
```

---

### Task 2: Enhance styles for Korean readability and checklist block

**Dependencies:** Runs after Task 0 completes (can run in parallel with Task 1)
**Files:**
- Modify: `docs/assets/styles.css:1-220`

- [ ] **Step 1: Update stylesheet for Korean page readability**

Append the following CSS block to the end of `docs/assets/styles.css`:

```css
.checklist {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.checklist li {
  border: 2px solid #000;
  background: #fff;
  padding: 10px;
  font-weight: 700;
}

.checklist input {
  margin-right: 8px;
}

.hero .subtitle {
  word-break: keep-all;
}

.section p,
.section li,
.section td,
.section summary {
  word-break: keep-all;
}
```

- [ ] **Step 2: Verify CSS additions exist**

Run:
```bash
python - <<'PY'
from pathlib import Path
css = Path('docs/assets/styles.css').read_text(encoding='utf-8')
required = ['.checklist {', '.checklist li {', 'word-break: keep-all;']
missing = [r for r in required if r not in css]
assert not missing, f'Missing CSS blocks: {missing}'
print('PASS: Korean style enhancements present')
PY
```
Expected: `PASS: Korean style enhancements present`

- [ ] **Step 3: Commit**

```bash
git add docs/assets/styles.css
git commit -m "docs: enhance styles for Korean quickstart layout"
```

---

### Task 3: Sync README website section with Korean-first landing

**Dependencies:** Runs after Task 1 completes
**Files:**
- Modify: `README.md:1-40`

- [ ] **Step 1: Update website section wording in README**

In `README.md`, replace this block:

```markdown
## 웹사이트

설치/빠른 시작 중심 페이지:

- GitHub Pages: `https://alphabeen.github.io/oh-my-jinho/`
- 로컬 미리보기: `docs/index.html` 직접 열기
```

with this exact block:

```markdown
## 웹사이트

한국어 설치/빠른 시작 페이지:

- GitHub Pages: `https://alphabeen.github.io/oh-my-jinho/`
- 로컬 미리보기: `docs/index.html` 직접 열기

> 영어 토글/이중언어 페이지는 다음 배치에서 추가합니다.
```

- [ ] **Step 2: Verify README sync**

Run:
```bash
python - <<'PY'
from pathlib import Path
r = Path('README.md').read_text(encoding='utf-8')
required = ['한국어 설치/빠른 시작 페이지', 'https://alphabeen.github.io/oh-my-jinho/', '영어 토글/이중언어 페이지는 다음 배치']
missing = [x for x in required if x not in r]
assert not missing, f'Missing README sync tokens: {missing}'
print('PASS: README synced with Korean-first landing')
PY
```
Expected: `PASS: README synced with Korean-first landing`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: sync README website section with Korean-first landing"
```

---

### Task 4 (Final): End-to-End Verification

**Dependencies:** All preceding tasks
**Files:** None (read-only verification)

- [ ] **Step 1: Run highest-level verification**

Run:
```bash
npm test
```
Expected: ALL PASS

- [ ] **Step 2: Verify plan success criteria**

Manually check each success criterion from the plan header:
- [ ] `docs/index.html` is Korean-first and includes Install/Quick Start/Core Commands/FAQ sections.
- [ ] Checklist section is present and visible.
- [ ] README website section explicitly states Korean-first status.
- [ ] Site remains static and deployable from `docs/`.

- [ ] **Step 3: Run build regression check**

Run:
```bash
npm run build
```
Expected: PASS (`tsc --noEmit` succeeds)

- [ ] **Step 4: Push and verify deployment URL**

Run:
```bash
git push origin main
```
Expected: push succeeds.

Then verify in browser:
- `https://alphabeen.github.io/oh-my-jinho/` returns 200 and Korean landing is visible.

---

## Self-Review

1. **Spec coverage:** Korean-first conversion, landing enhancement, README sync, and verification are all covered by explicit tasks.
2. **Placeholder scan:** No TODO/TBD placeholders present.
3. **Type consistency:** Minimal TS test file uses existing vitest environment without new interfaces.
4. **Dependency verification:** Parallel tasks do not modify same file (`docs/index.html` vs `docs/assets/styles.css`). README sync waits for landing copy.
5. **Verification coverage:** Final task includes `npm test`, `npm run build`, and deployment URL check.

No unresolved gaps.

---

Plan complete and saved to `docs/engineering-discipline/plans/2026-04-14-korean-quickstart-landing.md`.

How would you like to proceed?

1. **Subagent execution (recommended)** — dispatch a fresh subagent per task, review between tasks
2. **Inline execution** — execute tasks in this session using the plan
