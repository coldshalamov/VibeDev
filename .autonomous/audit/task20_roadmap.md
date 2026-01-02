# Task 20: Remediation Roadmap (Tightening Plan)

Date: 2026-01-01

This is a concrete plan for tightening “execution correctness” (truthfulness + auditability) while keeping diffs small and avoiding opportunistic refactors.

## Phase 0 (Today): Make verification reproducible

1) Standardize Python environment
- Add a small dev script (or documented command block) that:
  - creates a venv,
  - installs `-e .[dev]`,
  - runs `pytest`,
  - runs `vibedev-mcp serve`.

2) Ensure the “strict_feature” template works on default setups
- Confirm the allowlist matches actual commands used across platforms (`python` vs `python3`).

## Phase 1 (High leverage): Evidence you can trust

Goal: turn “I ran tests” into **machine-verifiable and inspectable** proof.

1) Persist shell-gate execution details
- When gates like `command_exit_0` run, store:
  - command string
  - exit code
  - bounded stdout/stderr snippet (cap bytes/lines)
  - timestamp and duration
- Store per-attempt, either:
  - embedded into `attempts.evidence_json` under a reserved key (e.g. `gate_runs`), or
  - a new table `gate_runs` keyed by `attempt_id`.

2) Expose per-gate results to UI
- Extend submit response to include:
  - which gates were evaluated,
  - pass/fail per gate,
  - (if applicable) output snippet references.

3) Fix policy invariants
- Prevent “required but unverifiable” configurations by enforcing one of:
  - If `require_tests_evidence==true`, require shell gates enabled + allowlist set, OR
  - If shell gates are disabled, default `require_tests_evidence==false` (and rely on non-shell gates).

## Phase 2 (UI trust surfaces): Make the Studio a real “glass box”

1) Gate Results panel
- Show per gate:
  - type + parameters + description
  - pass/fail + reason
  - output snippet (if shell gate)

2) Injection Preview panel
- Explicitly show what context is injected into the step prompt:
  - invariants,
  - recent mistakes,
  - context blocks,
  - repo map entries (if injected),
  - policies affecting evidence keys.

3) Next Action Preview
- Surface `next_action` returned by submission (NEXT_STEP_AVAILABLE / JOB_COMPLETE / PAUSE_FOR_HUMAN).

4) Wire acceptance criteria UI to evidence
- If strict evidence requires `criteria_checklist`, auto-populate it from the checkbox UI and keep it consistent.

## Phase 3 (Security hardening): Make boundaries explicit

1) HTTP API boundary
- If the HTTP server is *only* for local use:
  - Document “localhost-only” as a hard constraint and add warnings if binding to non-local.
  - Optionally add a simple token header check behind an env var.

2) `repo_root` tightening
- Add guardrails so `repo_root` is not an arbitrary filesystem pointer unless explicitly allowed.
- Option: enforce `repo_root` under a configured “workspace root allowlist.”

## Phase 4 (Spec alignment): Reduce doc drift

1) Decide what is canonical
- Either implement FlowGraph/RunnerActions as specced, or mark them as “planned”/“not implemented yet” in docs.

2) Add integration tests for the contract
- Minimal tests to ensure:
  - submitting invalid `model_claim` is rejected,
  - gate results and outputs are persisted,
  - SSE emits expected event types on state changes.
