# VibeDev MCP — Gates and EvidenceSchema

## Implementation Status

**Gate System: 94% Complete**  
**Implemented: 16 of 17 gate types (40 test cases passing)**

| Gate Category | Implemented | Total | Status |
|---------------|-------------|-------|--------|
| Command gates | 3 | 3 | ✅ 100% |
| File system gates | 5 | 5 | ✅ 100% |
| Change control gates | 4 | 4 | ✅ 100% |
| Schema gates | 1 | 2 | ⚠️ 50% |
| Git hygiene gates | 3 | 3 | ✅ 100% |
| Test/lint gates | 2 | 2 | ✅ 100% |
| Human gates | 1 | 1 | ✅ 100% |

**Missing:** `json_schema_valid` gate (planned for v1.1)

## Purpose

This document defines:
- **Gate** types (what the Verifier can require).
- **EvidenceSchema** (the proof format the model must submit).
- How the Verifier evaluates gates and rejects/advances deterministically.

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
   - Implemented in backend verifier (`vibedev_mcp/store.py`).
   - Safety: execution is **opt-in** via `Job.policies.enable_shell_gates=true` and allowlisted by `Job.policies.shell_gate_allowlist[]`.

2. `command_output_contains`
   - parameters: `{ "command": "…", "contains": "…" }`
   - passes if stdout contains substring.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).
   - Safety: execution is **opt-in** via `Job.policies.enable_shell_gates=true` and allowlisted by `Job.policies.shell_gate_allowlist[]`.

3. `command_output_regex`
   - parameters: `{ "command": "…", "pattern": "…" }` 
   - passes if stdout matches regex.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).
   - Safety: execution is **opt-in** via `Job.policies.enable_shell_gates=true` and allowlisted by `Job.policies.shell_gate_allowlist[]`.

### File system gates

4. `file_exists`
   - parameters: `{ "path": "…" }`
   - passes if file exists.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

5. `file_not_exists`
   - parameters: `{ "path": "…" }`
   - passes if file does not exist.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

### Change control gates

6. `changed_files_allowlist`
   - parameters: `{ "allowed": ["…"] }`
   - passes if every changed file is within allowlist patterns.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

7. `changed_files_minimum`
   - parameters: `{ "paths": ["…"], "min_count": 1 }`
   - passes if at least `min_count` of the `paths` were changed.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

8. `forbid_paths`
   - parameters: `{ "paths": ["…"] }`
   - passes if none of the forbidden paths were touched.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

9. `diff_max_lines`
   - parameters: `{ "max": 200 }`
   - passes if the diff is not too large.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

10. `diff_min_lines`
   - parameters: `{ "min": 1 }`
   - passes if the diff is non-empty.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

### Schema / structured proof gates

11. `json_schema_valid`
   - parameters: `{ "path": "…", "schema": {…} }`
   - passes if JSON file matches a simple schema (minimal type + required keys).
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

12. `criteria_checklist_complete`
   - parameters: `{ }`
   - passes if every criteria item is explicitly present and `true` in `criteria_checklist`.
   - Partially implemented in many systems via strict evidence mode (implementation-dependent).

### Git hygiene gates

13. `patch_applies_cleanly`
   - parameters: `{ "patch": "…" }`
   - passes if patch applies without conflicts.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

14. `no_uncommitted_changes`
   - parameters: `{ }`
   - passes if `git status` is clean.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

### Test/lint gates

15. `tests_passed`
   - parameters: `{ }`
   - passes if EvidenceSchema indicates tests passed and (optionally) command output supports it.
   - Often implemented as “required evidence keys” + policy toggles.

16. `lint_passed`
   - parameters: `{ }`
   - passes if EvidenceSchema indicates lint passed.
   - Implemented in backend verifier (`vibedev_mcp/store.py`).

### Human gate

17. `human_approval`
   - parameters: `{ }`
   - passes only when a human approves in the Studio UI (or via tool call).     
   - Implemented in backend verifier (`vibedev_mcp/store.py`) via step approval flag.

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

## Policy Validation and Combinations

**Important:** Certain policy combinations are contradictory and will prevent jobs from completing. VibeDev uses the following defaults to avoid contradictions:

### Default Policy Settings

```python
require_tests_evidence: False      # Don't require test evidence (safe default)
enable_shell_gates: False          # Shell command gates disabled (security)
shell_gate_allowlist: []           # Empty allowlist (security)
```

### Why These Defaults?

If `require_tests_evidence=True` but `enable_shell_gates=False`, the job cannot proceed because:
1. VibeDev requires `tests_run` and `tests_passed` fields in evidence
2. But it cannot verify tests actually ran without shell gates
3. All evidence submissions will be rejected as "unverifiable"

### Recommended Policy Combinations

**1. Permissive Mode (Default)**
```python
require_tests_evidence=False
enable_shell_gates=False
```
Good for: Exploration, prototyping, research tasks

**2. Strict Mode with Test Verification**
```python
require_tests_evidence=True
enable_shell_gates=True
shell_gate_allowlist=["*pytest*", "*npm test*", "*npm run test*"]
```
Good for: Production features, TDD workflows, CI/CD integration

**3. Audit Mode**
```python
require_tests_evidence=True
require_diff_summary=True
enable_shell_gates=True
shell_gate_allowlist=["*pytest*", "*npm test*", "*npm run lint*", "*npm run build*"]
evidence_schema_mode="strict"
```
Good for: Regulated environments, compliance requirements

### Validation Rules

When creating a job, VibeDev checks:
- If `require_tests_evidence=True`, warn if `enable_shell_gates=False`
- If `enable_shell_gates=True` and `shell_gate_allowlist` is empty, warn that no commands can run
- If any `command_exit_0` gates exist, ensure `enable_shell_gates=True` and allowlist is non-empty

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| EvidenceSchema | StepTemplate fields | `StepTemplate.evidence_schema.*` |
| Gate types | StepTemplate fields | `StepTemplate.gates[]` |
| Truthfulness semantics | Verifier behavior | (Verifier policy) |
| Human approval | FlowGraph transition | `RunnerAction.PAUSE_FOR_HUMAN` / UI |
| Policy validation | Job creation | `Policies` model in `models.py` |
