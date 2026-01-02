# VibeDev MCP — Studio UI Spec (Glass Box)

## Purpose

The Studio UI is not a chat window. It is a **glass box** that makes the StepTemplate pipeline inspectable:
- prompt preview (what will be sent)
- injection preview (what context is injected)
- gate results (why it passed/failed)
- next action preview (what the FlowGraph will do)

This document describes the required UI surfaces so planning artifacts compile into a UI that enforces truthfulness and prevents drift.

---

## Core Layout (Three Zones)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Header: Job selector | Mode (PLANNING/EXECUTION/REVIEW) | Automation Cockpit │
└─────────────────────────────────────────────────────────────────────────────┘
┌───────────────┬───────────────────────────────────────────────┬─────────────┐
│ Global Sidebar│ Main Canvas / Execution Surface                │ Run Monitor  │
│ (truth)       │ (StepTemplates + prompts)                      │ (attempts)   │
└───────────────┴───────────────────────────────────────────────┴─────────────┘
```

### 1) Global Sidebar (Truth Surfaces)

Required panes:
- **Job Metadata** (job_id, title, goal, status)
- **Invariants** (editable in planning; always visible in execution)
- **MistakeLedger** (recent + search)
- **Context Blocks** (list/search; attach to steps)
- **Repo Map** (tree + one-line descriptions)
- **Git Panel** (optional): branch, dirty state, diff summary

Trust feature: when an active step references a mistake tag, highlight the matching MistakeLedger entries.

### 2) Main Canvas (Planning Mode)

The planning canvas is a StepTemplate editor:
- list of StepTemplates (reorder, edit, insert, delete)
- per-step prompt editor (`prompt_template` / `instruction_prompt`)
- per-step gates list (type + parameters)
- per-step EvidenceSchema editor (required/optional/checklist)
- per-step FlowGraph fields (`on_fail`, `on_pass`)
- compile/lock action: “Set READY”

### 3) Execution Surface (Execution Mode)

Execution is linear and audit-oriented:
- current StepTemplate focus view
- prompt preview (rendered with injections)
- injection preview (expandable, copyable)
- evidence entry form (driven by EvidenceSchema)
- gate evaluation results (after submit)
- next action preview (advance/retry/diagnose/escalate)

### 4) Run Monitor (Attempts Timeline)

For the current step:
- attempt list (timestamp, claim, accepted/rejected)
- rejection reasons and missing fields
- evidence payload viewer

---

## Required Views by Job Status

- `PLANNING`: show interview + canvas editor.
- `READY`: show “start execution” CTA.
- `EXECUTING`: show active step + evidence submission + attempts.
- `PAUSED`: show “resume” CTA + reason (if available).
- `FAILED`: show failure reason + last rejection reasons + MistakeLedger entry.
- `COMPLETE`: show summary + export bundle CTA.
- `ARCHIVED`: read-only view.

---

## Prompt Preview and Injection Preview (Trust Features)

The UI must let a human answer:
- What exact prompt will be sent next?
- What got injected and from where?
- What gates will be evaluated?

Suggested UI:

```
Prompt Preview
──────────────
[copy]
<rendered prompt text…>

Injection Preview
────────────────
Invariants (N)
MistakeLedger (N)
RepoMap (N entries)
Context Blocks (N)
```

---

## Gate Results and Next Action Preview

After a submission, the UI should render:
- required fields presence
- gate-by-gate status (pass/fail) with details
- FlowGraph next action preview

Example:

```
Gate Results
────────────
✓ tests_passed
✗ changed_files_allowlist (found: vibedev-ui/src/App.tsx)

Next Action Preview
──────────────────
RETRY (max_retries=2)
Remediation prompt: "Undo unrelated changes…"
```

---

## Edit Capability (Planning Authority)

The user must be able to:
- edit StepTemplates directly (the “truth”)
- reorder steps
- insert diagnose/checkpoint steps
- toggle `human_review` per step

All edits persist immediately (Store is the truth source).

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| Sidebar invariants | Job fields | `Job.invariants[]` |
| StepTemplate editor | StepTemplate fields | `StepTemplate.*` |
| Evidence form | EvidenceSchema | `StepTemplate.evidence_schema.*` |
| Gate results view | Gate evaluation | `StepTemplate.gates[]` |
| Next action preview | FlowGraph | `StepTemplate.on_fail/on_pass` |
| Automation cockpit | Runner actions | `RunnerAction.*` |

