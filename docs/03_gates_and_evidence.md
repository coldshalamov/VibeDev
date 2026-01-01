# VibeDev MCP — Gates and EvidenceSchema

## Purpose

This document defines:
- **Gate** types (what the Verifier can require).
- **EvidenceSchema** (the proof format the model must submit).
- How the Verifier evaluates gates and rejects/advances deterministically.

If a gate is not implemented yet, it is marked as TODO. This is planning documentation; no code changes are made here.

---

## EvidenceSchema (Core)

### Canonical EvidenceSchema (JSON)

```json
{
  "changed_files": ["path/to/file.py"],
  "diff_summary": "One paragraph summary of what changed and why.",
  "commands_run": ["python -m pytest -q"],
  "tests_run": ["python -m pytest -q"],
  "tests_passed": true,
  "lint_run": false,
  "lint_passed": null,
  "artifacts_created": ["docs/07_doc_map.md"],
  "criteria_checklist": { "c1": true, "c2": true },
  "notes": "Anything that matters for review/debugging."
}
```

### Required vs optional fields

The StepTemplate defines:
- `evidence_schema.required[]`
- `evidence_schema.optional[]`
- `evidence_schema.criteria_checklist` (optional map of criteria IDs → text)

The Verifier rejects the submission if any required field is missing (or false where applicable).

---

## Gate Types (Catalog)

Each Gate has:
- `type`
- `parameters`
- `description`

### Command gates

1. `command_exit_0`
   - parameters: `{ "command": "…" }`
   - passes if command exits 0.
   - TODO if not implemented as a first-class gate.

2. `command_output_contains`
   - parameters: `{ "command": "…", "contains": "…" }`
   - passes if stdout contains substring.
   - TODO if not implemented as a first-class gate.

3. `command_output_regex`
   - parameters: `{ "command": "…", "pattern": "…" }`
   - passes if stdout matches regex.
   - TODO if not implemented as a first-class gate.

### File system gates

4. `file_exists`
   - parameters: `{ "path": "…" }`
   - passes if file exists.
   - TODO if not implemented as a first-class gate.

5. `file_not_exists`
   - parameters: `{ "path": "…" }`
   - passes if file does not exist.
   - TODO if not implemented as a first-class gate.

### Change control gates

6. `changed_files_allowlist`
   - parameters: `{ "allowed": ["…"] }`
   - passes if every changed file is within allowlist patterns.
   - TODO if not implemented as a first-class gate.

7. `changed_files_minimum`
   - parameters: `{ "paths": ["…"], "min_count": 1 }`
   - passes if at least `min_count` of the `paths` were changed.
   - TODO if not implemented.

8. `forbid_paths`
   - parameters: `{ "paths": ["…"] }`
   - passes if none of the forbidden paths were touched.
   - TODO if not implemented.

9. `diff_max_lines`
   - parameters: `{ "max": 200 }`
   - passes if the diff is not too large.
   - TODO if not implemented.

10. `diff_min_lines`
   - parameters: `{ "min": 1 }`
   - passes if the diff is non-empty.
   - TODO if not implemented.

### Schema / structured proof gates

11. `json_schema_valid`
   - parameters: `{ "path": "…", "schema_id": "…" }`
   - passes if JSON file validates against known schema.
   - TODO if not implemented.

12. `criteria_checklist_complete`
   - parameters: `{ }`
   - passes if every criteria item is explicitly present and `true` in `criteria_checklist`.
   - Partially implemented in many systems via strict evidence mode (implementation-dependent).

### Git hygiene gates

13. `patch_applies_cleanly`
   - parameters: `{ "patch": "…" }`
   - passes if patch applies without conflicts.
   - TODO if not implemented.

14. `no_uncommitted_changes`
   - parameters: `{ }`
   - passes if `git status` is clean.
   - TODO if not implemented as a first-class gate.

### Test/lint gates

15. `tests_passed`
   - parameters: `{ }`
   - passes if EvidenceSchema indicates tests passed and (optionally) command output supports it.
   - Often implemented as “required evidence keys” + policy toggles.

16. `lint_passed`
   - parameters: `{ }`
   - passes if EvidenceSchema indicates lint passed.
   - TODO if not implemented as a first-class gate.

### Human gate

17. `human_approval`
   - parameters: `{ }`
   - passes only when a human approves in the Studio UI (or via tool call).
   - TODO if not implemented (policy-dependent).

---

## Gate Evaluation Semantics

### Deterministic evaluation

Given:
- StepTemplate.gates[]
- StepTemplate.evidence_schema.required[]
- Job.policies (e.g., require tests evidence)

The Verifier evaluates in a stable order and produces:
- `accepted: true/false`
- `missing_fields[]`
- `rejection_reasons[]`
- `next_action` (FlowGraph transition)

### “Truthfulness” rule

If a gate depends on command output, the EvidenceSchema must include:
- the exact command in `commands_run[]`
- and enough output context to verify results (at minimum: “exit 0” and key lines)

If evidence is absent, the Verifier rejects and routes to retry/diagnose.

---

## Evidence Examples (Good vs Bad)

### Good (tests gate)

```json
{
  "diff_summary": "Fix HTTP endpoint mismatch; align UI client paths.",
  "commands_run": ["python -m pytest -q"],
  "tests_run": ["python -m pytest -q"],
  "tests_passed": true,
  "changed_files": ["vibedev_mcp/http_server.py", "vibedev-ui/src/lib/api.ts"],
  "devlog_line": "Aligned REST API paths and added HTTP smoke tests."
}
```

### Bad (hand-wave)

```json
{
  "diff_summary": "Fixed everything.",
  "tests_passed": true
}
```

Reasons: missing `tests_run`, missing `commands_run`, missing changed files list, not verifiable.

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| EvidenceSchema | StepTemplate fields | `StepTemplate.evidence_schema.*` |
| Gate types | StepTemplate fields | `StepTemplate.gates[]` |
| Truthfulness semantics | Verifier behavior | (Verifier policy) |
| Human approval | FlowGraph transition | `RunnerAction.PAUSE_FOR_HUMAN` / UI |

