# VibeDev

VibeDev MCP is a **prompt compiler + verifier**: it turns planning artifacts into deterministic **StepTemplates** with **Gates**, then executes them with **EvidenceSchema**-based gating (and optional autoprompt runner actions).

Why it exists:
- LLMs reliably fail via premature implementation, scope creep, and hand-wavy “done”.
- VibeDev makes those failures expensive by requiring explicit steps, explicit gates, and verifiable evidence.

## Docs (start here)

- `docs/00_overview.md` — what/why + behavioral contract
- `docs/02_step_canvas_spec.md` — StepTemplate schema + examples
- `docs/03_gates_and_evidence.md` — gate catalog + evidence schema
- `docs/05_studio_ui_spec.md` — the GUI (“Studio”) spec
- `docs/07_doc_map.md` — where every concept lives
- `docs/agent_setup.md` — install + agent/client MCP setup templates

For LLM usage rules in this repo, read `CLAUDE.md`.

## Install (local)

Prereqs: Python 3.11+

- `python -m pip install -e .`
- (dev) `python -m pip install -e .[dev]`

## Quick start

### 1) Run as an MCP server (stdio)

- `vibedev-mcp`

### 2) Run the HTTP API (REST + SSE, for the GUI)

- `vibedev-mcp serve` (defaults to `127.0.0.1:8765`)

Health check:
- `curl http://127.0.0.1:8765/api/health`

### 3) Run the GUI (local)

- Terminal 1: `vibedev-mcp serve`
- Terminal 2: `cd vibedev-ui` then `npm install` then `npm run dev` (Vite runs on `http://localhost:3000` and proxies `/api` to `http://localhost:8765`)

## Configuration

- Default DB path: `%USERPROFILE%\.vibedev\vibedev.sqlite3`
- Override DB path: `set VIBEDEV_DB_PATH=C:\path\to\vibedev.sqlite3`
- Override HTTP port: `set VIBEDEV_HTTP_PORT=8765`

## Tool surface (high level)

- Planning: `conductor_init`, `conductor_next_questions`, `conductor_answer`, `plan_*`, `job_set_ready`
- Execution: `job_start`, `job_next_step_prompt`, `job_submit_step_result`
- UI: `get_ui_state` (and `/api/jobs/{job_id}/ui-state` via HTTP)
- Memory: `context_*`, `mistake_*`, `devlog_*`
- Repo helpers: `repo_snapshot`, `repo_map_export`, `repo_find_stale_candidates`, `repo_hygiene_suggest`, `git_*`

## Runner (optional)

For a minimal “hands” loop outside the UI (read/write evidence JSON and drive a
job forward), use the runner CLI:

- `vibedev runner --job <JOB_ID> --evidence path\\to\\evidence.json`

## Workflow templates (best-practice defaults)

VibeDev includes built-in workflow templates you can apply during planning to get a
strong default step chain (small diffs, evidence, gates).

- HTTP: `GET /api/templates`
- HTTP apply: `POST /api/jobs/{job_id}/templates/{template_id}/apply`
- MCP tools: `template_list`, `template_apply`

### Safety note: shell-executing command gates

Some templates include command-executing gates (e.g. run tests/build). For safety, these
are enforced as **opt-in** and **allowlisted** per job:

- `policies.enable_shell_gates` (default: `false`)
- `policies.shell_gate_allowlist` (default: `[]`)

## Contributing

- Run tests: `python -m pytest -v`
- Update generated API types (if you change HTTP models/endpoints): `cd vibedev-ui` then `npm run gen:api`
- Keep diffs small and evidence-driven (see `CLAUDE.md`).

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Docs links | Informational | (Navigation only) |
| Install/quick start | Informational | (How to run locally) |
| Tool surface | Informational | (Public tool/API entrypoints) |
