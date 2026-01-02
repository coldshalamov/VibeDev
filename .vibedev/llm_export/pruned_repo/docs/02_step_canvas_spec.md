# VibeDev MCP — StepTemplate (“Step Canvas”) Spec

## Purpose

This document defines the **StepTemplate** schema as the primary “compiler input” of VibeDev planning. A StepTemplate is what the planning thread produces and the execution thread follows.

If the current implementation stores fewer fields, this doc remains the intended compilation target; differences are captured as TODOs (no code changes here).

---

## StepTemplate Schema (Conceptual)

### Required fields

```json
{
  "step_id": "S1",
  "title": "Repo recon",
  "objective": "Create a minimal, accurate map of the repo and identify entrypoints.",
  "prompt_template": "…",
  "injections": { "repo_root": "…", "context_ids": ["…"] },
  "tool_policy": { "allowed": ["…"], "forbidden": ["…"], "max_calls": 50 },
  "evidence_schema": {
    "required": ["changed_files", "diff_summary", "commands_run", "tests_run", "tests_passed", "devlog_line"],
    "optional": ["lint_run", "lint_passed", "artifacts_created", "notes"],
    "criteria_checklist": { "c1": "…", "c2": "…" }
  },
  "gates": [
    { "type": "tests_passed", "parameters": {}, "description": "Tests evidence must indicate pass." }
  ],
  "on_fail": {
    "max_retries": 2,
    "retry_prompt": "Fix only what failed the gates, then resubmit evidence.",
    "diagnose_prompt": "If failing twice, produce a diagnosis and propose a safe repair plan.",
    "escalate_policy": "ROUTE_TO_PLANNING"
  },
  "on_pass": { "next_step_id": "S2" },
  "human_review": false,
  "checkpoint": false
}
```

### Field definitions

- `step_id`: stable identifier (`S1..Sn`).
- `title`: short human-readable name.
- `objective`: what success means, in one sentence.
- `prompt_template`: the compiled prompt body (may contain variables).
- `injections`: what gets injected into the prompt (repo map, invariants, mistakes, context blocks, etc.).
- `tool_policy`: tool constraints for the executor model (allowed/forbidden/max).
- `evidence_schema`: the shape the model must submit.
- `gates[]`: typed checks evaluated by the Verifier.
- `on_fail`: retry/diagnose/escalate behavior.
- `on_pass`: next transition in the FlowGraph.
- `human_review`: whether the human must approve before advancing.
- `checkpoint`: whether this step is a formal checkpoint (often includes “run tests”, “commit”, “summarize”).

---

## StepTemplate Prompt Composition

The Verifier should construct a step prompt as:

1. Step Objective (step_id + title + objective)
2. Invariants (always injected)
3. Prompt Preview (rendered `prompt_template` + injections)
4. Gate Summary (what must pass)
5. EvidenceSchema Template (exact keys required)
6. FlowGraph Next Actions (on_pass/on_fail)

---

## Example 1 — Repo Recon StepTemplate (Full)

```json
{
  "step_id": "S1",
  "title": "Repo recon",
  "objective": "Produce a RepoMap and identify key entrypoints + tests.",
  "prompt_template": "You are in EXECUTION mode. Do NOT implement features.\\n\\nObjective: Build a repo map and locate entrypoints/tests.\\n\\nInvariants:\\n- No feature work\\n- No refactors\\n- Be truthful about commands run\\n\\nTasks:\\n1) Create a repo snapshot\\n2) Update RepoMap file descriptions for key files\\n3) Summarize entrypoints and test commands\\n\\nReturn EvidenceSchema JSON only.",
  "injections": {
    "repo_root": "C:/path/to/repo",
    "include_repo_snapshot": true,
    "include_repo_map": true,
    "include_mistakes": true
  },
  "tool_policy": {
    "allowed": ["repo_snapshot", "repo_file_descriptions_update", "repo_map_export", "devlog_append"],
    "forbidden": ["job_submit_step_result"],
    "max_calls": 25
  },
  "evidence_schema": {
    "required": ["diff_summary", "commands_run", "artifacts_created", "devlog_line"],
    "optional": ["notes"],
    "criteria_checklist": {
      "c1": "Repo snapshot created",
      "c2": "RepoMap updated for key files",
      "c3": "Entrypoints identified"
    }
  },
  "gates": [
    { "type": "command_exit_0", "parameters": { "command": "python -m pytest -q" }, "description": "Sanity check: tests pass after repo-map metadata updates." }
  ],
  "on_fail": {
    "max_retries": 1,
    "retry_prompt": "Undo unrelated changes; keep only repo-map metadata; rerun checks.",
    "diagnose_prompt": "If the repo is not runnable, explain why and route to planning.",
    "escalate_policy": "ROUTE_TO_PLANNING"
  },
  "on_pass": { "next_step_id": "S2" },
  "human_review": true,
  "checkpoint": true
}
```

---

## Example 2 — Patch + Tests StepTemplate (Full)

```json
{
  "step_id": "S2",
  "title": "Implement targeted change + tests",
  "objective": "Make the minimal code change required and prove it with tests.",
  "prompt_template": "You are in EXECUTION mode. Implement ONLY the described change.\\n\\nScope:\\n- Modify only allowlisted paths\\n- Keep diff minimal\\n\\nAfter changes:\\n- Run tests\\n- Provide evidence JSON\\n",
  "injections": {
    "invariants": ["No unrelated refactors", "Evidence must be truthful"],
    "repo_map": "…",
    "context_ids": ["CTX-…"]
  },
  "tool_policy": {
    "allowed": ["repo_snapshot", "git_diff_summary", "devlog_append"],
    "forbidden": [],
    "max_calls": 50
  },
  "evidence_schema": {
    "required": ["changed_files", "diff_summary", "commands_run", "tests_run", "tests_passed", "devlog_line"],
    "optional": ["lint_run", "lint_passed", "artifacts_created", "notes"],
    "criteria_checklist": {
      "c1": "Change implemented",
      "c2": "Tests added/updated",
      "c3": "All tests pass"
    }
  },
  "gates": [
    { "type": "changed_files_allowlist", "parameters": { "allowed": ["vibedev_mcp/**", "tests/**"] }, "description": "No changes outside allowlist." },
    { "type": "tests_passed", "parameters": {}, "description": "Tests evidence must indicate pass." }
  ],
  "on_fail": {
    "max_retries": 2,
    "retry_prompt": "Fix the failing gate only; do not expand scope.",
    "diagnose_prompt": "Explain what is blocked (env, dependency, unclear spec) and propose a planning update.",
    "escalate_policy": "PAUSE_FOR_HUMAN"
  },
  "on_pass": { "next_step_id": "JOB_COMPLETE" },
  "human_review": true,
  "checkpoint": false
}
```

---

## TODOs (Implementation Gaps)

- Typed `gates[]` are described here but may not exist as first-class objects in the current implementation.
- Variable rendering in `prompt_template` and structured `injections` may be partially implemented (or implemented as plain prompt composition).

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| Schema fields | StepTemplate fields | `StepTemplate.*` |
| EvidenceSchema | StepTemplate fields | `StepTemplate.evidence_schema.*` |
| Gates | StepTemplate fields | `StepTemplate.gates[]` |
| on_fail/on_pass | FlowGraph transitions | `FlowGraph.*` |
| tool_policy | Verifier policy / executor constraints | `StepTemplate.tool_policy.*` |

