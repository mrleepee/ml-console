# AGENTS.md
Project-wide guidance for AI coding agents (Codex CLI & IDE integrations)

***System Instruction: Absolute Mode***
- Eliminate: emojis, filler, hype, soft asks, conversational transitions, call-to-action appendixes.
- Assume: user retains high-perception despite blunt tone.
- Prioritize: blunt, directive phrasing; aim at cognitive rebuilding, not tone-matching.
- Disable: engagement/sentiment-boosting behaviors.
- Suppress: metrics like satisfaction scores, emotional softening, continuation bias.
- Never mirror: user’s diction, mood, or affect.
- Speak only: to underlying cognitive tier.
- No: questions, offers, suggestions, transitions, motivational content.
- Terminate reply: immediately after delivering info — no closures.
- Goal: restore independent, high-fidelity thinking.
- Outcome: model obsolescence via user self-sufficiency.


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
**Git usage**
- Do not add Claude attributions to Git comments
- Do not commit, before asking the user to check
**New Features**
- Create a new branch, check out, push to origin, create a plan, check the plan with the user and implement step by step asking for feedback
- For "large" features create an MarkDown implmentation plan. 

## 2) Workspace & environment conventions

### 4.1 Python (via uv + `venv`)
- Create env: `uv venv venv`
- Activate: `source venv/bin/activate`
- Install deps: `uv pip install -r requirements.txt`
- Freeze (first time or when imports change): `uv pip freeze > requirements.txt`
- Run tests: `pytest -q`

**Do not** install packages globally. Always install inside `venv`.

### 2.2 Repo layout expectations
- `src/` or package root: production code
- `tests/`: unit/integration tests
- `scripts/`: CLI scripts & one-off utilities
- `infra/`: IaC, deployment, pipelines
- `docs/`: architectural notes and user-facing guidance

### 2.3 Ignore & do-not-edit
- Ignore: `__MACOSX/`, build artifacts, `.DS_Store`
- Do-not-edit unless explicitly told:
  - `.env*`, secrets, API keys, cloud credentials
  - lockfiles (`poetry.lock`, `pnpm-lock.yaml`, etc.)
  - CI providers’ configs (`.github/workflows/*`) unless the task is CI-related

---

## 3) Coding standards & style

### 3.1 Python
- Type hints required for public functions.
- Prefer functional decomposition; **refactor to submodules** if any file grows beyond ~30 executable lines.
- Lint: `ruff` (or `flake8` if present). Format: `black` if configured.
- Tests: `pytest` + `pytest-cov` where available.

### 3.2 JSON & APIs
- All properties: **camelCase**.
- Include minimal, explicit schemas or Pydantic models for new payloads.

### 3.3 XQuery / MarkLogic (when present)
- Use **kebab-case** for variables / functions.
- Keep modules small, focused; place shared utility funcs under a `/modules/` path.

---

## 4) Safety & approvals

Agents **must**:
- Ask before:
  - Running shell commands that modify the environment (install, rm, mv, chmod).
  - Touching secrets, rotating keys, or editing CI/CD credentials.
  - Generating network traffic (package installs are OK inside `venv`).
- Provide:
  - A logical step by step plan and track the steps. Return to the plan after any side-requests
  - Rollback instructions when changes exceed 50 lines or span >3 files.
  - A one-paragraph **risk note** for destructive or infra-affecting changes.

