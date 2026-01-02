# Task 18: Findings (Severity / Impact / Evidence)

Date: 2026-01-01

This consolidates audit findings into actionable items. Severity is based on the likely impact *in the typical VibeDev deployment mode* (local dev tool). If you ever run this bound to non-local interfaces, treat “Info/Low” items as more severe.

## F-01: HTTP API has no authentication/authorization

- Severity: Medium (High if exposed beyond localhost)
- Impact: Anyone who can reach the HTTP port can enumerate jobs, read prompts/evidence, and mutate job state.
- Evidence:
  - `vibedev_mcp/http_server.py` exposes `/api/*` endpoints without auth checks.
  - SSE endpoint `/api/jobs/{job_id}/events` streams job data to any client that knows a `job_id`.
- Recommendation:
  - Explicitly document “localhost-only” as a security boundary, and/or add optional auth (token header) and deny non-local by default.
  - Add a clear startup warning when binding to `0.0.0.0`.

## F-02: Evidence is not fully auditable (command gate outputs not persisted)

- Severity: Medium
- Impact: Even when machine-checkable gates run (e.g., `command_exit_0`), the system stores only pass/fail + high-level attempt fields, not the command output. This weakens “glass box” verification and postmortems.
- Evidence:
  - `vibedev_mcp/store.py` executes shell gate commands with `capture_output=True` but does not persist stdout/stderr into the attempt evidence or a dedicated log table.
- Recommendation:
  - Persist a bounded stdout/stderr snippet (e.g., first/last N lines, capped bytes) into the attempt record.
  - Surface this output in the UI alongside gate results.

## F-03: Default policy combinations can create “required but unverifiable” evidence

- Severity: Low/Medium
- Impact: Jobs can require test evidence (`tests_run`, `tests_passed`) even when shell gates are disabled; users can supply those keys without a machine-verifiable gate.
- Evidence:
  - Policies include `require_tests_evidence` (default true in both `vibedev_mcp/server.py` and `vibedev_mcp/http_server.py`) while `enable_shell_gates` defaults false.
- Recommendation:
  - Either default `require_tests_evidence` to false, or automatically require shell gates when tests evidence is required (with allowlist).
  - Alternatively: require an explicit `tests_passed` gate (shell) whenever `require_tests_evidence` is true.

## F-04: UI trust surfaces incomplete (gate results / next action / injection preview)

- Severity: Low/Medium
- Impact: Users can’t easily verify “why” a step was accepted/rejected, what gates ran, and what exact context got injected.
- Evidence:
  - Prompt preview + attempts are present in `vibedev-ui/src/components/ExecutionDashboard.tsx`, but there is no dedicated gate results panel, no injection preview panel, and no “next action preview.”
- Recommendation:
  - Add UI panes:
    - Gate Results: per-gate pass/fail, gate params, and (if shell gate) output snippet.
    - Injection Preview: invariants, mistakes, context blocks, repo map entries actually injected into the step prompt.
    - Next Action Preview: show `next_action` from submit response.

## F-05: `model_claim` validation mismatch (stringly typed at HTTP boundary)

- Severity: Low
- Impact: Invalid `model_claim` values could be accepted at the HTTP API boundary and end up in attempts; reduces data integrity and UI clarity.
- Evidence:
  - Canonical enum exists as `ModelClaim` in `vibedev_mcp/models.py`.
- Recommendation:
  - Implemented: `model_claim` is now typed as `ModelClaim` in both HTTP (`vibedev_mcp/http_server.py`) and MCP tool input (`vibedev_mcp/server.py`).

## F-06: Smoke-test/dev UX mismatch across environments

- Severity: Info
- Impact: In WSL (without a venv), tests and server starts can fail with missing deps; this can lead to false-negative “system broken” impressions.
- Evidence:
  - Initial Task 15/16 attempts failed due to missing `pytest` / `aiosqlite`; follow-up with venv succeeded.
- Recommendation:
  - Add explicit “quickstart” for WSL: create venv + `pip install -e .[dev]`.
  - Add a script (Makefile or `scripts/dev.sh`) that creates/uses the venv consistently.
