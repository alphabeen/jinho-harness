# GitHub Pages Quickstart Landing Implementation Plan

> **Worker note:** Execute this plan task-by-task using the agentic-run-plan skill or subagents. Each step uses checkbox (`- [ ]`) syntax for progress tracking.

**Goal:** Build a GitHub Pages landing site that explains how to install and start using `oh-my-jinho` in under 5 minutes.

**Architecture:** Ship a static site under `docs/` (plain HTML/CSS, no build step) and deploy it with GitHub Actions Pages workflow. Reuse README content as source-of-truth and add a small sync note to keep docs/README aligned.

**Tech Stack:** Static HTML5 + CSS3, GitHub Actions (Pages), existing Node scripts (`vitest`, `tsc --noEmit`) for regression checks.

**Work Scope:**
- **In scope:** `docs/index.html`, `docs/assets/styles.css`, Pages deployment workflow, README link/update for quickstart site.
- **Out of scope:** JS framework adoption, docs search/versioning system, extension runtime behavior changes (`index.ts`, `subagent.ts`, etc.), localization expansion.

**Verification Strategy:**
- **Level:** test-suite
- **Command:** `npm test`
- **What it validates:** Existing extension behavior/tests still pass after docs/workflow changes.

---

## File Structure Mapping

- **Create** `docs/index.html` — quickstart-focused landing page content.
- **Create** `docs/assets/styles.css` — lightweight visual system for landing page.
- **Create** `.github/workflows/deploy-pages.yml` — Pages deploy automation.
- **Modify** `README.md:1-82` — add website link + quickstart website section + skill count correction.

Decomposition lock:
- `docs/index.html` and `docs/assets/styles.css` can be developed in parallel.
- `README.md` update depends on final landing URL section references.
- workflow is independent from page markup/style and can run in parallel.

---

## Project Capability Discovery

- **Bundled agents available:** `explorer`, `worker`, `planner`, `plan-worker`, `plan-validator`, `plan-compliance`, reviewers.
- **Project agents directories:** no `.agents/` or `.pi/agents/` requirement for this task.
- **Project skills:** repository contains `skills/*/SKILL.md` (12 files currently), but this task is documentation-focused and can be executed directly.

---

### Task 1: Create landing page markup

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `docs/index.html`

- [ ] **Step 1: Create docs directory structure**

Run:
```bash
mkdir -p docs/assets
```
Expected: `docs/` and `docs/assets/` exist.

- [ ] **Step 2: Create landing page HTML**

Write `docs/index.html` with the exact content below:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>oh-my-jinho | Quick Start</title>
    <meta
      name="description"
      content="Install and start using the oh-my-jinho extension in minutes. Clarify, plan, and execute with structured agentic workflows."
    />
    <link rel="stylesheet" href="./assets/styles.css" />
  </head>
  <body>
    <header class="topbar">
      <div class="container nav">
        <a class="brand" href="#home">oh-my-jinho</a>
        <nav>
          <a href="#install">Install</a>
          <a href="#quickstart">Quick Start</a>
          <a href="#commands">Commands</a>
          <a href="#faq">FAQ</a>
          <a href="https://github.com/alphabeen/oh-my-jinho" target="_blank" rel="noreferrer">GitHub</a>
        </nav>
      </div>
    </header>

    <main id="home">
      <section class="hero container">
        <p class="eyebrow">Agentic Coding Harness for pi</p>
        <h1>Install, clarify, plan, and execute in a disciplined workflow.</h1>
        <p class="subtitle">
          oh-my-jinho adds practical command workflows to pi so teams can turn vague requests into executable plans.
        </p>
        <div class="hero-actions">
          <a class="btn primary" href="#install">Get Started</a>
          <a class="btn" href="https://github.com/alphabeen/oh-my-jinho" target="_blank" rel="noreferrer">View Repository</a>
        </div>
      </section>

      <section id="install" class="section container">
        <h2>1) Install</h2>
        <p>Install directly from GitHub:</p>
        <pre><code>pi install git:alphabeen/oh-my-jinho</code></pre>
        <p>Optional pinned version:</p>
        <pre><code>pi install git:alphabeen/oh-my-jinho#v1.0.0</code></pre>
      </section>

      <section id="quickstart" class="section container">
        <h2>2) Quick Start (3 steps)</h2>
        <ol class="steps">
          <li>Run <code>/setup</code> once after install (quiet startup setting).</li>
          <li>Start with <code>/clarify [topic]</code> to build a Context Brief.</li>
          <li>Move to <code>/plan [topic]</code> for an executable implementation plan.</li>
        </ol>
        <div class="callout">
          <strong>Tip:</strong> Use <code>/resume</code> to return to previous sessions by workspace.
        </div>
      </section>

      <section id="commands" class="section container">
        <h2>Core Commands</h2>
        <table>
          <thead>
            <tr><th>Command</th><th>Description</th></tr>
          </thead>
          <tbody>
            <tr><td><code>/clarify [topic]</code></td><td>Clarify scope with one-question-at-a-time flow.</td></tr>
            <tr><td><code>/plan [topic]</code></td><td>Generate executable implementation plan tasks.</td></tr>
            <tr><td><code>/ultraplan [topic]</code></td><td>Decompose complex work into milestone DAG with reviewers.</td></tr>
            <tr><td><code>/resume</code></td><td>Select and jump back to a prior session workflow.</td></tr>
            <tr><td><code>/reset-phase</code></td><td>Reset workflow phase back to idle.</td></tr>
          </tbody>
        </table>
      </section>

      <section class="section container">
        <h2>How context injection works</h2>
        <p>
          If your project has an <code>IDS.md</code> file in the working directory or parent directories,
          the harness discovers and re-reads it every turn.
        </p>
      </section>

      <section id="faq" class="section container">
        <h2>FAQ</h2>
        <details>
          <summary>Do I need to run with --extension path manually?</summary>
          <p>No. After <code>pi install</code>, pi manages extension installation paths.</p>
        </details>
        <details>
          <summary>Does this change my source code automatically?</summary>
          <p>Only when tasks/tools explicitly write files. Clarification and planning phases are read-focused first.</p>
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

- [ ] **Step 3: Verify HTML includes required quickstart sections**

Run:
```bash
python - <<'PY'
from pathlib import Path
html = Path('docs/index.html').read_text(encoding='utf-8')
required = ['id="install"', 'id="quickstart"', 'id="commands"', 'pi install git:alphabeen/oh-my-jinho', '/clarify [topic]']
missing = [r for r in required if r not in html]
assert not missing, f'Missing sections: {missing}'
print('PASS: landing page sections present')
PY
```
Expected: `PASS: landing page sections present`

- [ ] **Step 4: Commit**

```bash
git add docs/index.html
git commit -m "docs: add quickstart-focused GitHub Pages landing markup"
```

---

### Task 2: Create landing page styles

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `docs/assets/styles.css`

- [ ] **Step 1: Create stylesheet**

Write `docs/assets/styles.css` with the exact content below:

```css
:root {
  --bg: #ffffff;
  --text: #0b0b0b;
  --muted: #4b4b4b;
  --line: #111111;
  --accent: #0080ff;
  --panel: #f6f6f6;
  --shadow: 6px 6px 0 #000;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: "Inter", "Noto Sans KR", system-ui, -apple-system, sans-serif;
  color: var(--text);
  background: var(--bg);
  line-height: 1.6;
}

.container { width: min(1040px, 92vw); margin: 0 auto; }

.topbar {
  position: sticky;
  top: 0;
  z-index: 10;
  background: #fff;
  border-bottom: 4px solid var(--line);
}

.nav { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; }
.brand { font-weight: 900; text-decoration: none; color: var(--text); }
.nav nav { display: flex; gap: 14px; flex-wrap: wrap; }
.nav nav a { color: var(--text); text-decoration: none; font-weight: 700; }
.nav nav a:hover { color: var(--accent); }

.hero { padding: 72px 0 40px; }
.eyebrow { font-weight: 800; color: var(--accent); margin-bottom: 8px; }
h1 { font-size: clamp(2rem, 3.6vw, 3.2rem); line-height: 1.12; margin: 0 0 16px; }
.subtitle { color: var(--muted); max-width: 72ch; }
.hero-actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }

.btn {
  border: 3px solid #000;
  padding: 10px 14px;
  text-decoration: none;
  color: #000;
  font-weight: 800;
  background: #fff;
  box-shadow: var(--shadow);
}
.btn.primary { background: var(--accent); color: #fff; }

.section {
  border-top: 4px solid #000;
  padding: 32px 0;
}

pre {
  background: var(--panel);
  border: 3px solid #000;
  padding: 12px;
  overflow-x: auto;
}

code {
  font-family: "JetBrains Mono", "Fira Code", monospace;
  background: #efefef;
  padding: 0.1rem 0.3rem;
}

.steps { padding-left: 20px; }

.callout {
  margin-top: 12px;
  border: 3px solid #000;
  background: #eaf3ff;
  padding: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  border: 3px solid #000;
  background: #fff;
}
th, td {
  border: 2px solid #000;
  text-align: left;
  padding: 10px;
}
th { background: #f2f2f2; }

details {
  border: 2px solid #000;
  padding: 10px;
  margin-bottom: 10px;
  background: #fff;
}
summary { cursor: pointer; font-weight: 800; }

.footer {
  border-top: 4px solid #000;
  margin-top: 30px;
  padding: 20px 0;
  color: var(--muted);
}

@media (max-width: 760px) {
  .nav { align-items: flex-start; gap: 8px; flex-direction: column; }
}
```

- [ ] **Step 2: Validate stylesheet is linked from landing page**

Run:
```bash
python - <<'PY'
from pathlib import Path
html = Path('docs/index.html').read_text(encoding='utf-8')
css = Path('docs/assets/styles.css').exists()
assert './assets/styles.css' in html, 'Missing stylesheet link in docs/index.html'
assert css, 'docs/assets/styles.css not found'
print('PASS: stylesheet linked and file exists')
PY
```
Expected: `PASS: stylesheet linked and file exists`

- [ ] **Step 3: Commit**

```bash
git add docs/assets/styles.css
git commit -m "docs: add landing page stylesheet for GitHub Pages"
```

---

### Task 3: Add GitHub Pages deployment workflow

**Dependencies:** None (can run in parallel)
**Files:**
- Create: `.github/workflows/deploy-pages.yml`

- [ ] **Step 1: Create workflow directory**

Run:
```bash
mkdir -p .github/workflows
```
Expected: `.github/workflows` exists.

- [ ] **Step 2: Create Pages workflow**

Write `.github/workflows/deploy-pages.yml` with the exact content below:

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: docs

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Validate workflow syntax quickly**

Run:
```bash
python - <<'PY'
from pathlib import Path
wf = Path('.github/workflows/deploy-pages.yml').read_text(encoding='utf-8')
required = ['actions/configure-pages@v5', 'actions/upload-pages-artifact@v3', 'actions/deploy-pages@v4', 'path: docs']
missing = [r for r in required if r not in wf]
assert not missing, f'Missing workflow keys: {missing}'
print('PASS: deploy-pages workflow includes required actions')
PY
```
Expected: `PASS: deploy-pages workflow includes required actions`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy-pages.yml
git commit -m "ci: add GitHub Pages deployment workflow for docs site"
```

---

### Task 4: Update README for landing page entry and consistency

**Dependencies:** Runs after Task 1 and Task 3 complete
**Files:**
- Modify: `README.md:1-82`

- [ ] **Step 1: Add website section and fix skill count mismatch**

Edit `README.md` with these exact changes:

1) Insert a new section after line 9 (`---`) named `## 웹사이트` containing:

```markdown
## 웹사이트

설치/빠른 시작 중심 페이지:

- GitHub Pages: `https://alphabeen.github.io/oh-my-jinho/`
- 로컬 미리보기: `docs/index.html` 직접 열기
```

2) Change section title:

```markdown
## 스킬 (13개)
```

to:

```markdown
## 스킬 (12개)
```

- [ ] **Step 2: Verify README updates**

Run:
```bash
python - <<'PY'
from pathlib import Path
r = Path('README.md').read_text(encoding='utf-8')
assert '## 웹사이트' in r, 'README missing website section'
assert 'https://alphabeen.github.io/oh-my-jinho/' in r, 'README missing pages URL'
assert '## 스킬 (12개)' in r, 'README skill count not updated'
print('PASS: README website section + skill count updated')
PY
```
Expected: `PASS: README website section + skill count updated`

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add quickstart website entry and correct skill count"
```

---

### Task 5 (Final): End-to-End Verification

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
- [ ] GitHub Pages landing content exists at `docs/index.html` with Install/Quick Start/Commands sections.
- [ ] `docs/assets/styles.css` is linked and renders page structure.
- [ ] `.github/workflows/deploy-pages.yml` deploys `docs/` via Pages actions.
- [ ] README includes website link and quickstart entry.
- [ ] README skill count matches repository skill files (12).

- [ ] **Step 3: Run full regression command set**

Run:
```bash
npm run build
```
Expected: PASS (`tsc --noEmit` succeeds)

---

## Self-Review

- **Spec coverage:** Plan includes quickstart landing page creation, styling, deployment, and README integration.
- **Placeholder scan:** No TBD/TODO placeholders in steps or commands.
- **Type consistency:** N/A (documentation + workflow change only; no TS API changes).
- **Dependency verification:** Parallel tasks do not modify same files; README update waits for page/workflow completion.
- **Verification coverage:** Final verification includes highest-level test-suite command and build regression check.

No gaps found against current scope.

---

Plan complete and saved to `docs/engineering-discipline/plans/2026-04-14-gh-pages-quickstart-landing.md`.

How would you like to proceed?

1. **Subagent execution (recommended)** — dispatch a fresh subagent per task, review between tasks
2. **Inline execution** — execute tasks in this session using the plan
