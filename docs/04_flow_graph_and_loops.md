# VibeDev MCP — FlowGraph and Loops

## Purpose

This document defines the **FlowGraph**: the deterministic transitions that connect StepTemplates, and the explicit failure loops (retry → diagnose → escalate).

This is planning documentation. If the current implementation supports only a subset of these transitions, the difference is recorded as TODO.

---

## Canonical FlowGraph Loop

### High-level ASCII diagram

```
          ┌────────────────────────────────────────────┐
          │                StepTemplate N              │
          │        (prompt + injections + gates)       │
          └────────────────────────────────────────────┘
                              │
                              v
                    ┌──────────────────┐
                    │ Submit Evidence  │
                    │ (EvidenceSchema) │
                    └──────────────────┘
                              │
                              v
                    ┌──────────────────┐
                    │ Verifier checks  │
                    │ gates + schema   │
                    └──────────────────┘
                      │            │
               PASS   │            │   FAIL
                      │            │
                      v            v
          ┌─────────────────┐   ┌────────────────────┐
          │ Advance         │   │ Retry (bounded)     │
          │ next_step_id    │   │ fix failing gates   │
          └─────────────────┘   └────────────────────┘
                                    │
                                    v
                             ┌───────────────┐
                             │ Diagnose step │
                             │ (if repeats)  │
                             └───────────────┘
                                    │
                                    v
                             ┌───────────────┐
                             │ Escalate      │
                             └───────────────┘
```

---

## Escalation Policies (Deterministic)

The Verifier chooses escalation actions from:

- `RETRY` — resubmit with corrected evidence.
- `DIAGNOSE` — produce a diagnosis artifact (what failed, why, next safe plan).
- `PAUSE_FOR_HUMAN` — require explicit human approval to proceed.
- `ROUTE_TO_PLANNING` — exit execution mode; update StepTemplates/invariants/DoD.
- `FAIL_JOB` — mark job failed; record in MistakeLedger.

Selection should be deterministic based on:
- attempt count vs `on_fail.max_retries`
- error classification (missing evidence vs failing tests vs forbidden changes)
- policy strictness

---

## Diagnose StepTemplate (Pattern)

Diagnose is itself a StepTemplate pattern:

```json
{
  "step_id": "D1",
  "title": "Diagnose failure",
  "objective": "Explain why the gates failed and propose a minimal safe fix or planning update.",
  "prompt_template": "Diagnose ONLY. Do not implement fixes unless explicitly allowed.\\n\\nOutput: diagnosis + proposed repair plan + risk list.",
  "evidence_schema": {
    "required": ["diff_summary", "notes", "devlog_line"],
    "optional": ["commands_run", "artifacts_created"],
    "criteria_checklist": { "c1": "Failure explained", "c2": "Repair plan proposed" }
  },
  "gates": [
    { "type": "criteria_checklist_complete", "parameters": {}, "description": "Diagnosis must cover all required criteria." }
  ],
  "on_fail": { "max_retries": 0, "escalate_policy": "PAUSE_FOR_HUMAN" },
  "on_pass": { "next_step_id": "ROUTE_TO_PLANNING" },
  "human_review": true,
  "checkpoint": true
}
```

---

## Thread Reset Policy

Thread resets are part of the FlowGraph, not a user whim.

Triggers (examples):
- Context is bloated / contradictory.
- The LLM is repeating failure modes (MistakeLedger match).
- A planning update is required but execution thread is polluted.

RunnerAction sequence (example):
- `COPY_TO_CLIPBOARD` (job_id + short state summary)
- `NEW_THREAD`
- `PASTE_PROMPT`
- `SEND_PROMPT`

---

## TODOs (Implementation Gaps)

- A first-class “diagnose” step insertion may not exist yet.
- Explicit escalation policy selection may be simplified to accept/reject.
- Thread reset actions may be partially implemented (e.g., clipboard-only).

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| FlowGraph loop | Verifier behavior | (Verifier policy) |
| Escalation policies | StepTemplate fields | `StepTemplate.on_fail.escalate_policy` |
| Diagnose step pattern | StepTemplate templates | (Template library) |
| Thread reset policy | Runner actions | `RunnerAction.*` |

