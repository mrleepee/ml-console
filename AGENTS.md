# AGENTS.md
Project-wide guidance for AI coding agents (Codex CLI & IDE integrations)

System Instruction: Absolute Mode
• Eliminate: emojis, filler, hype, soft asks, conversational transitions, call-to-action appendixes.
• Assume: user retains high-perception despite blunt tone.
• Prioritize: blunt, directive phrasing; aim at cognitive rebuilding, not tone-matching.
• Disable: engagement/sentiment-boosting behaviors.
• Suppress: metrics like satisfaction scores, emotional softening, continuation bias.
• Never mirror: user’s diction, mood, or affect.
• Speak only: to underlying cognitive tier.
• No: questions, offers, suggestions, transitions, motivational content.
• Terminate reply: immediately after delivering info — no closures.
• Goal: restore independent, high-fidelity thinking.
• Outcome: model obsolescence via user self-sufficiency.

**Purpose**  
This document is read by coding agents to learn your repo, conventions, guardrails, tools, tasks, and approval rules. Keep it concise but explicit. When conventions change, update this file first.

---

## 1) How to work in this repo (TL;DR for agents)
- **Language & tooling defaults**
  - Python projects use **uv** and a virtualenv named **`venv`** (never `.venv`).
  - JSON properties are **camelCase**.  
  - XQuery **variables/functions** use **kebab-case**.
- **Editing policy**
  - Prefer minimal, isolated diffs; keep PRs small and focused.
  - Never touch secrets, lockfiles, or dotfiles unless the task explicitly says so.
- **Testing policy**
  - Add/extend tests for any behavior change. Keep coverage ≥ existing level.
  - Provide a clear `How to run tests` snippet in your outputs.
- **Docs**
  - Update `README.md` and module-level docstrings when public APIs change.
  - When creating download links to new versions, append **`-v[n]`** before the file suffix (e.g., `report-v2.pdf`).

---

## 2) Codex CLI quickstart for humans

### Install
- **macOS / Linux**
  - Homebrew: `brew install codex`
  - npm: `npm install -g @openai/codex`
- Run once to sign in: `codex`

### Typical runs
- Interactive:  
  `codex "Add a /health endpoint in FastAPI with a 200 JSON {status:'ok'}"`
- Approval modes:
  - Suggest (default, asks before edits/commands):  
    `codex --approval-mode suggest "Refactor 'etl/' into packages and add tests"`
  - Auto Edit (auto file edits; still asks before running commands):  
    `codex --approval-mode auto-edit "Generate unit tests for pipeline stages"`
  - Full Auto (edits + commands without prompts—use carefully):  
    `codex --approval-mode full-auto "Bootstrap a demo service and run tests"`

- **Non-interactive / CI runs** (no UI):  
  `codex exec "Run flake8 + pytest and produce a short summary"`

> Run Codex from the **repo root** unless the task is intentionally scoped to a subfolder.

---

## 3) Approval modes (choose the right autonomy)

| Mode       | What it does                                                        | Pros                                                     | Cons / Risks                                          | Recommended use |
|------------|---------------------------------------------------------------------|----------------------------------------------------------|-------------------------------------------------------|-----------------|
| suggest    | Proposes diffs & commands; requires your approval                   | Maximum control; great for first use & sensitive repos  | Slower feedback loop                                  | Default         |
| auto-edit  | Auto-applies file edits; still asks before running shell commands   | Faster code changes with command safety gate             | Larger diffs if prompts are broad                     | Routine refactor/test work |
| full-auto  | No prompts for edits **or** commands                                | Fastest; ideal for scripted CI tasks & sandboxes         | Highest risk; watch for destructive ops               | Ephemeral envs only |

---

## 4) Workspace & environment conventions

### 4.1 Python (via uv + `venv`)
- Create env: `uv venv venv`
- Activate: `source venv/bin/activate`
- Install deps: `uv pip install -r requirements.txt`
- Freeze (first time or when imports change): `uv pip freeze > requirements.txt`
- Run tests: `pytest -q`

**Do not** install packages globally. Always install inside `venv`.

### 4.2 Repo layout expectations
- `src/` or package root: production code
- `tests/`: unit/integration tests
- `scripts/`: CLI scripts & one-off utilities
- `infra/`: IaC, deployment, pipelines
- `docs/`: architectural notes and user-facing guidance

### 4.3 Ignore & do-not-edit
- Ignore: `__MACOSX/`, build artifacts, `.DS_Store`
- Do-not-edit unless explicitly told:
  - `.env*`, secrets, API keys, cloud credentials
  - lockfiles (`poetry.lock`, `pnpm-lock.yaml`, etc.)
  - CI providers’ configs (`.github/workflows/*`) unless the task is CI-related

---

## 5) Coding standards & style

### 5.1 Python
- Type hints required for public functions.
- Prefer functional decomposition; **refactor to submodules** if any file grows beyond ~30 executable lines.
- Lint: `ruff` (or `flake8` if present). Format: `black` if configured.
- Tests: `pytest` + `pytest-cov` where available.

### 5.2 JSON & APIs
- All properties: **camelCase**.
- Include minimal, explicit schemas or Pydantic models for new payloads.

### 5.3 XQuery / MarkLogic (when present)
- Use **kebab-case** for variables / functions.
- Keep modules small, focused; place shared utility funcs under a `/modules/` path.

---

## 6) Safety & approvals

Agents **must**:
- Ask before:
  - Running shell commands that modify the environment (install, rm, mv, chmod).
  - Touching secrets, rotating keys, or editing CI/CD credentials.
  - Generating network traffic (package installs are OK inside `venv`).
- Provide:
  - A plan + diff preview for multi-file edits.
  - Rollback instructions when changes exceed 50 lines or span >3 files.
  - A one-paragraph **risk note** for destructive or infra-affecting changes.

---

## 7) Task recipes (copy/paste prompts)

> Use these in `codex "..."` (interactive) or `codex exec "..."` (non-interactive).

### 7.1 Feature (FastAPI health)
> Implement `GET /health` returning `{"status":"ok"}` with tests.  
> Create/extend `src/app/main.py`, wire to router, update docs, add `pytest` test to `tests/test_health.py`. Use **uv** with `venv`. Update README with run & test commands.

### 7.2 Refactor into packages
> Split `etl/` into `etl/io`, `etl/transform`, `etl/load`. Add `__init__.py`, keep imports stable, write unit tests for each layer, and add a high-level diagram to `docs/etl-overview.md`.

### 7.3 Test-only pass
> Generate unit tests for `src/lib/*.py` focusing on edge cases. Don’t change public APIs. Produce a short coverage delta.

### 7.4 Bugfix with reproduction
> Create a minimal failing test case for issue #XYZ, fix it, and annotate the root cause in the PR description.

### 7.5 Data transformation utility
> Build `scripts/csv_to_parquet.py` supporting schema inference, column selection, and compression. Add CLI help, tests, and README usage examples.

---

## 8) Runbook: local bootstrap scripts

### 8.1 `scripts/bootstrap_python.sh`
Create this file (executable) and call it from the README when Python is present in the repo.

```bash
#!/usr/bin/env bash
set -euo pipefail

# Bootstrap a Python project using uv with a 'venv' folder
# Usage: ./scripts/bootstrap_python.sh

if ! command -v uv >/dev/null 2>&1; then
  echo "uv not found. Installing uv (Linux/macOS)..."
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.cargo/bin:$PATH"
fi

# Create venv if missing
if [ ! -d "venv" ]; then
  uv venv venv
fi

# Activate and install deps
# - If requirements.txt exists, install it. Otherwise, create one.
source venv/bin/activate
if [ -f "requirements.txt" ]; then
  uv pip install -r requirements.txt
else
  echo "# pinned at first run" > requirements.txt
  uv pip freeze >> requirements.txt || true
fi

echo "Python bootstrap complete. Activate with: source venv/bin/activate"