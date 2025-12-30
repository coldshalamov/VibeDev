# VibeDev
VibeDev MCP: a persistent “development process brain” that enforces disciplined LLM coding workflows.

It’s designed to:
- Separate **Planning** (messy, research-heavy) from **Execution** (clean, step-by-step).
- Store a “compiled prompt chain” as a `job_id` you can paste into a new thread.
- Gate progress using required **evidence fields** so the model can’t hand-wave.

The core spec lives in `VibeDev.txt`.

## Install (local)
Run:
- `python -m pip install -e .`

Optional dev deps:
- `python -m pip install -e .[dev]`

## Run
Default transport is `stdio`:
- `vibedev-mcp`

By default, the SQLite DB is stored at:
- `%USERPROFILE%\.vibedev\vibedev.sqlite3`

Override DB path:
- `set VIBEDEV_DB_PATH=C:\path\to\vibedev.sqlite3`
- `vibedev-mcp`

## Core tools
Planning / memory:
- `conductor_init`, `conductor_next_questions`, `conductor_answer`
- `context_add_block`, `context_get_block`, `context_search`
- `plan_set_deliverables`, `plan_set_invariants`, `plan_set_definition_of_done`, `plan_propose_steps`, `job_set_ready`

Execution / gating:
- `job_start`, `job_next_step_prompt`, `job_submit_step_result`

Logging / artifacts:
- `devlog_append`, `mistake_record`, `mistake_list`
- `repo_snapshot`, `repo_file_descriptions_update`, `repo_map_export`, `repo_find_stale_candidates`
- `job_export_bundle`, `job_archive`

## Planning phases (roadmap)
`conductor_next_questions` runs a phased planning interview (Phase 1–5) aligned with `VibeDev.txt`:
1. Intent & scope (repo exists, out-of-scope, environment, timeline)
2. Deliverables (and definition of done)
3. Invariants (non-negotiables)
4. Repo context (repo root; optional repo map)
5. Plan compilation (step list)

## Evidence gating
`job_next_step_prompt` emits a structured step prompt with an evidence template.
Gating can be tightened via policies (set at `conductor_init.policies`):
- `require_tests_evidence`: require `tests_run` + `tests_passed`
- `require_diff_summary`: require `diff_summary`
- `evidence_schema_mode: "strict"`: require per-criterion `criteria_checklist` and reject if any criterion is false
