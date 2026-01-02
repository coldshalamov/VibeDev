# Task 17: Docs vs Implementation Cross-Check

Date: 2026-01-01

This compares the canonical docs (`docs/00_overview.md` → `docs/07_doc_map.md`) to the current implementation in:
- Backend: `vibedev_mcp/` (`server.py`, `http_server.py`, `store.py`, `models.py`, `templates.py`)
- Frontend: `vibedev-ui/`

## 1) Two-thread workflow (Planning vs Execution)

**Docs expectation**
- Planning produces stable artifacts, then execution follows deterministic StepTemplates with gates + evidence.

**Implementation**
- Job lifecycle exists with explicit statuses (`PLANNING`, `READY`, `EXECUTING`, etc.) and state persisted in SQLite (`vibedev_mcp/store.py`, `vibedev_mcp/models.py`).
- Execution is enforced via `job_next_step_prompt()` + `job_submit_step_result()` in `vibedev_mcp/store.py`.

**Gap / Tightening**
- “Deterministic” is partially enforced: gates can be machine-checkable (e.g., `command_exit_0`) only if shell gates are enabled + allowlisted. Otherwise evidence can be supplied without a machine check.

## 2) StepTemplate schema

**Docs expectation**
- `docs/02_step_canvas_spec.md` describes StepTemplate fields and compilation expectations.

**Implementation**
- Planning input shape is “StepSpec” and stored “Step” (`vibedev_mcp/models.py`), persisted in SQLite (`steps` table).
- Execution prompt is generated from stored step fields in `job_next_step_prompt()`.

**Gap / Tightening**
- The system uses a pragmatic subset of the spec (title/prompt/criteria/evidence/gates), but doesn’t implement several advanced spec ideas (e.g., explicit FlowGraph transitions per step).

## 3) EvidenceSchema + truthfulness

**Docs expectation**
- Evidence is the audit trail; “no claims without evidence.” When commands are required, evidence should reflect what was run and ideally include outputs.

**Implementation**
- Evidence is a dict stored per attempt; required keys are derived from `Step.required_evidence` plus policy toggles.
- Gate checks can enforce `tests_passed`, `lint_passed`, allowlists, and command execution (shell gates) in `vibedev_mcp/store.py`.

**Gaps / Tightening**
- When command gates are executed, stdout/stderr is not persisted as evidence; only pass/fail is enforced. This limits auditability.
- Default policies can require test evidence even when shell gates are disabled (depends on how jobs are created), which creates an “evidence required but unverifiable” path.

## 4) Gates catalog vs implementation

**Docs expectation**
- `docs/03_gates_and_evidence.md` defines the catalog; gates should be enforceable.

**Implementation**
- A substantial gate set exists in `vibedev_mcp/store.py`, including allowlist/forbid globs, diff bounds, and command gates gated by policy.

**Gaps / Tightening**
- The “glass box” requirement implies showing gate-by-gate results and rationale. Backend returns rejection reasons/missing fields, but UI does not currently render per-gate pass/fail detail.

## 5) FlowGraph / loops

**Docs expectation**
- `docs/04_flow_graph_and_loops.md` describes retry/diagnose/escalate loops and deterministic policies.

**Implementation**
- A simplified loop exists via `max_retries_per_step` + `retry_exhausted_action` (e.g., pause-for-human) in policies.

**Gap / Tightening**
- No explicit “diagnose step” generation or per-step FlowGraph transitions (`on_fail` / `on_pass`) are implemented; escalation is coarse.

## 6) Studio UI trust features

**Docs expectation**
- `docs/05_studio_ui_spec.md` emphasizes “glass box” surfaces (prompt preview, injection preview, gate results, evidence display, attempt history, override).

**Implementation**
- Prompt preview exists (“Step Prompt (Copy/Paste)”) and attempt history is displayed (“Previous Attempts”) in `vibedev-ui/src/components/ExecutionDashboard.tsx`.

**Gaps / Tightening**
- Injection preview is not explicitly surfaced (what context blocks, repo map entries, or other injections are included).
- Gate results and “next action preview” are not shown as a first-class surface.
- Acceptance criteria checkboxes are UI-only and not wired into evidence submission (risk of misleading “checked == passed” perception).

## 7) RunnerActions / autoprompt

**Docs expectation**
- `docs/06_runner_autoprompt_spec.md` defines RunnerActions (copy/paste/send/new thread) and safety interlocks.

**Implementation**
- Clipboard bridge exists (copying prompts to clipboard) and “auto mode” toggles exist in UI, but the full RunnerActions catalog is not implemented as an execution backend.

**Gap / Tightening**
- If RunnerActions are in-scope, a minimal, auditable “hands” implementation is still missing (especially SEND_PROMPT / WAIT_FOR_RESPONSE / NEW_THREAD with interlocks).
