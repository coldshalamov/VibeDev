# VibeDev MCP — Architecture

## Purpose

This document defines the **component boundaries** and the **behavioral contracts** between them, using the exact planning-doc terms:

- **StepTemplate**: the compiled unit of work.
- **Gate**: the qualification check.
- **EvidenceSchema**: the structured proof payload.
- **FlowGraph**: the execution transitions and failure loops.
- **RunnerAction**: automation commands executed outside the model.
- **Invariant**: non‑negotiable job rules.
- **MistakeLedger**: persistent failure memory.
- **DevLog**: per-step progress log.

This is planning documentation. If the current implementation differs, the difference is recorded as a TODO (no code changes are made here).

---

## One System, Five Roles

VibeDev is easiest to reason about as five cooperating roles:

1. **Store** (persistence): durable state across threads (e.g., SQLite).
2. **Compiler** (planning): turns messy answers into a deterministic **StepTemplate** chain.
3. **Verifier** (execution): evaluates **EvidenceSchema** against **Gates** and chooses the next **FlowGraph** transition.
4. **Studio UI** (glass box): exposes prompts, injections, and gate results for inspection and edits.
5. **Runner** (hands): optional automation that performs **RunnerActions** (copy/paste/new thread), never deciding what to do next.

---

## Boundaries & Interfaces

### Transport Boundary (stdio vs HTTP)

VibeDev can be exposed via multiple transports:

- **MCP stdio**: tool-call transport intended for IDE-integrated LLM usage.
- **HTTP REST + SSE**: transport intended for the Studio UI (browser), with:
  - REST endpoints for all job operations
  - an SSE stream per job for real-time updates

**Rule:** transports are adapters. The Store + Verifier semantics must be identical across transports.

#### HTTP surface (summary)

- Base path: `/api`
- Primary UI read: `GET /api/jobs/{job_id}/ui-state`
- Real-time events: `GET /api/jobs/{job_id}/events` (SSE)

See also:
- Studio expectations: `docs/05_studio_ui_spec.md`
- Runner expectations: `docs/06_runner_autoprompt_spec.md`

### Store Boundary (Truth Source)

The Store is the source of truth for:
- Job lifecycle state (PLANNING → READY → EXECUTING → COMPLETE/FAILED/PAUSED).
- StepTemplates and their ordering.
- Attempts (every submission; accepted/rejected).
- Context blocks (research/notes/snippets).
- MistakeLedger entries.
- DevLog entries.
- Repo snapshot/map metadata (optional).

**Rule:** the LLM must not “remember” state that contradicts the Store.

### Compiler Boundary (Planning Thread Only)

The Compiler:
- Collects deliverables, invariants, and a definition of done.
- Produces an ordered list of StepTemplates.
- Produces verifier policies (defaults + job-specific overrides).

**Rule:** the Compiler does not execute steps; it produces compile-ready artifacts.

### Verifier Boundary (Execution Thread Only)

The Verifier:
- Emits the next StepTemplate prompt (with injections).
- Requires EvidenceSchema submissions.
- Evaluates Gates deterministically.
- Advances, rejects, pauses, routes to planning, or fails the job via FlowGraph transitions.

**Rule:** “MET” without passing gates is treated as failure (reject or escalate).

### Studio UI Boundary

The Studio UI:
- Renders the current Job state (including StepTemplate chain).
- Shows **prompt preview** and **injection preview**.
- Shows gate evaluation results and the next action.
- Allows the human to edit the StepTemplate chain (planning) and override gate outcomes (optional policy).

**Rule:** UI edits must be persisted to the Store, not held in transient UI state.

### Runner Boundary

The Runner:
- Performs **RunnerActions** (e.g., copy prompt to clipboard, open new thread).
- Never chooses FlowGraph transitions.

**Rule:** “brain” and “hands” are separated: MCP decides; Runner acts.

---

## Core Entities (Planning Terms)

### Job

A Job is the unit that spans threads.

Minimum conceptual fields:
- `job_id`
- `status`
- `goal`
- `deliverables[]`
- `invariants[]`
- `definition_of_done[]`
- `policies{...}`
- `step_order[]`
- `current_step_index`
- `planning_answers{...}`

### StepTemplate

A StepTemplate is the compiled step canvas object.

Minimum conceptual fields:
- `step_id`
- `title`
- `objective`
- `prompt_template`
- `injections{...}`
- `tool_policy{...}`
- `evidence_schema{required[], optional[], criteria_checklist?}`
- `gates[]`
- `on_fail{...}`
- `on_pass{...}`
- `human_review`
- `checkpoint`

### Attempt

An Attempt is a single submission for a step:
- `model_claim` (MET/NOT_MET/PARTIAL)
- `summary`
- `evidence{...}`
- `outcome` (accepted/rejected)
- `rejection_reasons[]`
- `missing_fields[]`

### MistakeLedger Entry

Minimal fields:
- `title`
- `what_happened`
- `why`
- `lesson`
- `avoid_next_time`
- `tags[]`
- `related_step_id?`

### DevLog Entry

Minimal fields:
- `content`
- `log_type`
- `step_id?`
- `commit_hash?`

---

## Implementation Notes (for Realism)

This repository currently implements a subset of the full StepTemplate/Gate model:
- StepTemplates exist as persisted steps with prompts + required evidence keys.
- Evidence gating exists (required keys + policy-driven required keys).
- Many “Gate types” described in `docs/03_gates_and_evidence.md` are intended design, not yet implemented as typed gates. Document gaps as TODOs.

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| Job | Store state | `Job.*` |
| StepTemplate | Store state | `StepTemplate.*` |
| Verifier boundary | Verifier policies | `Job.policies.*` |
| Runner boundary | Runner actions | `RunnerAction.*` |
| UI boundary | Informational + UI implementation | (UI only) |
