# VibeDev MCP — Claude Operating Manual (Trimmed)

**Version:** 2.2  
**Purpose:** Keep always-on context small; deep specs live in `docs/`.

VibeDev MCP is a **prompt compiler + verifier**: it turns planning artifacts into a deterministic prompt-flow (step templates + gates + loops), then executes it with evidence gating and optional autoprompting.

---

## Canonical Spec (Read These, Not This File)

When you need definitions/schemas/examples, use the canonical docs:

- `docs/00_overview.md` — What/why, behavioral contract
- `docs/01_architecture.md` — Boundaries, transports
- `docs/02_step_canvas_spec.md` — StepTemplate schema + examples
- `docs/03_gates_and_evidence.md` — Gate catalog + evidence schema
- `docs/04_flow_graph_and_loops.md` — Retry/diagnose/escalate loops + policies
- `docs/05_studio_ui_spec.md` — Studio UI panes + trust features
- `docs/06_runner_autoprompt_spec.md` — Runner/Autoprompt contract + safety
- `docs/07_doc_map.md` — Concept → file/section index

Rule of thumb: **read only the minimum doc sections needed** for the current change.

---

## Operating Modes (Pick One)

**Planning**
- Explore options, ask clarifying questions.
- Output: planning artifacts that compile into deterministic steps (no code unless explicitly requested).

**Execution**
- Follow the current step template exactly.
- Provide evidence and pass gates; no improvisation outside scope.

**Docs-only**
- Do not modify code/config/tests unless explicitly allowed.
- Record any required code changes as TODOs instead.

---

## Hard Rules (Non-Negotiable)

1. **Truthfulness:** never claim commands/tests ran unless you ran them; never invent outputs.
2. **Scope control:** do not “fix adjacent issues” unless explicitly in scope.
3. **Minimal diffs:** prefer small, surgical patches over rewrites/refactors.
4. **Determinism:** prefer explicit schemas, templates, and checklists over “best effort”.
5. **When uncertain:** stop and ask, or produce planning artifacts — don’t guess.

---

## Two-Thread Workflow (How VibeDev Prevents Drift)

**Thread A — Planning (messy)**
- Goal: converge on a step template that is unambiguous and auditable.
- Output: StepTemplates, gates, evidence requirements, rollback paths.

**Thread B — Execution (clean)**
- Goal: execute one step at a time and prove completion with evidence.
- Output: minimal patch + tests + structured evidence.

---

## Verification Commands (Common)

- Python tests: `python -m pytest -v`
- Backend stdio server: `vibedev-mcp`
- Backend HTTP server: `vibedev-mcp serve` (default `127.0.0.1:8765`)
- UI dev server: `cd vibedev-ui; npm run dev` (default `http://localhost:3000`)
- UI lint: `cd vibedev-ui; npm run lint`

If you didn’t run a command, say so.

---

## Response Format (When Reporting Work)

When changes were made, report:

- Files changed (paths)
- Diff summary (what/why)
- Commands run (exact)
- Tests run + results (or explicitly “not run”)
- Any constraints/invariants verified (or explicitly not verified)

When docs-only, report:

- Files changed (docs only)
- TODOs for required code changes (no implementation)
- Open questions/risks

---

## Definition of Done (Default)

Done means:

- The intended behavior is implemented (or docs updated) **and**
- Evidence matches required gates **and**
- No unapproved scope creep **and**
- Verification is documented (tests/lint/build), or explicitly deferred with reason

---

## Compilation Surface

This file is intentionally short. Detailed specs, schemas, and examples must live in `docs/` so they are pulled in only when needed.
