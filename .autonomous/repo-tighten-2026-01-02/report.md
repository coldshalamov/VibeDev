# Repo Tighten Report — 2026-01-02

## Scope

You asked for an exhaustive pass over the repo: read the canonical docs, run audits, and tighten up hygiene with small, low-risk fixes.

## Docs Read (Canonical Set)

- `docs/00_overview.md` → `docs/07_doc_map.md`
- `CLAUDE.md` (repo behavior contract)
- `README.md` (user-facing setup and quick start)

## Commands Run (Evidence)

- `python -m pytest -v` → **72 passed**
- `cd vibedev-ui; npm run lint` → **exit 0**
- `cd vibedev-ui; npm run build` → **exit 0**
- `cd vibedev-ui; npm audit --audit-level=high` → **0 vulnerabilities**
- `pip-audit .` → **No known vulnerabilities found**

Lightweight security/hygiene scans:
- `rg` scans for obvious secret patterns (no matches in project code; matches were in legacy/docs/reference material)
- `rg` scans for `shell=True` found in `vibedev_mcp/store.py` (intended and policy-guarded)

## High-Impact Findings

### 1) Generated UI build output was tracked

`vibedev-ui/dist/` was in the git index. That’s almost always accidental (causes noisy diffs, bloats history).

### 2) No module-local ignore for the UI

There was no `vibedev-ui/.gitignore`, so the repo relied on root ignore patterns (which previously did not cover `vibedev-ui/dist/`, `vibedev-ui/node_modules/`, etc.).

### 3) SQLite concurrency risk (multi-process)

Repo docs and existing code suggest running both stdio MCP and HTTP server; SQLite can contend with multiple writers.

### 4) UI lint warning (unused catch variable)

ESLint reported a warning in `ExecutionDashboard.tsx` due to an unused `catch (e)` binding.

## Tightening Changes Applied

### Backend

- Added health endpoints:
  - `GET /health`
  - `GET /api/health`
  - Includes a DB connectivity check via `VibeDevStore.ping()`.
- Enabled SQLite settings on connect:
  - `PRAGMA journal_mode = WAL;`
  - `PRAGMA busy_timeout = 5000;`

### Frontend

- Added a lightweight connection indicator (polls health every 5s) and surfaced it in the header + error state.
- Removed the unused `catch (e)` binding that caused an ESLint warning.

### Repo Hygiene

- Added root ignores for:
  - `vibedev-ui/dist/`
  - `vibedev-ui/node_modules/`
  - `vibedev-ui/.vite/`
- Removed tracked `vibedev-ui/dist/*` files from git (`git rm -r --cached vibedev-ui/dist`) so future builds don’t churn the repo.

### Docs

- Updated `README.md` to document `/api/health` and the optional runner CLI.

## Recommended Next Refactors (Not Implemented)

1. **Split `vibedev_mcp/store.py` by concern**
   - Suggested modules: `gates.py`, `git_tools.py`, `repo_tools.py`, `execution.py`, `planning.py`.
   - Goal: make verifier/gates easier to evolve and test independently.

2. **Stabilize backend↔UI typing**
   - Consider generating a TS client/types from FastAPI OpenAPI to reduce drift (`UIState`, job/step payload shapes).

3. **Line endings policy**
   - Git warned about LF→CRLF normalization for multiple files (Windows checkout). Consider enforcing `eol=lf` via `.gitattributes` for `*.py`, `*.ts`, `*.tsx`, `*.md` to avoid churn.

4. **Decide how to treat legacy docs**
   - `docs/spec.md` is large and explicitly marked legacy; consider moving legacy docs under `docs/legacy/` to reduce “what’s canonical?” confusion.

## Notes About New/Untracked Files

Your working tree currently contains additional untracked files (e.g. `vibedev_mcp/cli.py`, `vibedev-ui/src/components/ConnectionStatus.tsx`, `tests/test_runner_cli_integration.py`, `VIBEDEV_REPO_AUDIT.md`). If you want them in the repo, make sure they are `git add`’d together with the tracked changes that reference them.
