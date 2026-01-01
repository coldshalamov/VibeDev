# VibeDev MCP — One-Shot Documentation Refactor Prompt

**Copy/paste this entire block into Claude Code / Claude CLI / Claude extension as a one-shot instruction.**

---

```text
You are working inside the VibeDev MCP repository.

================================================================================
MISSION
================================================================================

Refactor and upgrade ONLY the PLANNING DOCUMENTATION and text/spec files so that the project's purpose and build plan are unmissable and compile-ready.

Do NOT modify any code files.
Do NOT change Python modules, package configs, or runtime logic.
This is a docs-only refactor.

================================================================================
DEFINITION OF "PLANNING DOCS"
================================================================================

You MAY edit or create files that are:
- *.md, *.txt, *.rst
- docs/* (any text documentation)
- README* (markdown/text)
- specs/* (if exists and text-based)
- Any "VibeDev.txt" style spec files
- CLAUDE.md or similar LLM instruction files

You MUST NOT modify:
- *.py, *.js, *.ts, *.json, *.yaml, *.toml, *.lock, package files, build files
- anything in src/ or vibedev_mcp/ (or equivalent) except for text docs if they exist there
- anything in vibedev-ui/src/
- test files (*.test.ts, *_test.py, etc.) unless they are markdown

================================================================================
ABSOLUTE CONSTRAINTS
================================================================================

1. NO CODE CHANGES. If you touch code, you failed.

2. VERIFY at the end via git status / diff that only docs/text files changed.

3. If you find inconsistencies requiring code changes, document them as TODOs in the docs; do not implement.

4. PRESERVE existing functionality descriptions—do not remove information, only reorganize and enhance.

5. When in doubt, ASK rather than assume.

================================================================================
GOAL STATE (WHAT "DONE" LOOKS LIKE)
================================================================================

After your docs refactor, a new contributor (or an LLM) should be able to answer, with confidence:

1) What VibeDev MCP is (one sentence).
2) Why it exists (LLM failure modes it prevents).
3) What it outputs (step templates + gates + flow graph + optional runner).
4) How planning compiles into execution (two-thread workflow).
5) What the Step Canvas schema is (fields + examples).
6) What the gate types are and how evidence is validated.
7) What the UI ("Studio") must show (prompt preview, injection preview, gate results).
8) How autoprompt ("runner") works at a boundary layer (MCP decides, runner types).
9) What the behavioral contract is for models using this system.
10) Where each of these topics lives in the docs (doc map).

================================================================================
WORKFLOW (DO THIS IN ORDER)
================================================================================

PHASE 0 — INVENTORY
--------------------

1. List all existing planning docs/text files relevant to defining the project and build plan:
   - README.md
   - CLAUDE.md
   - docs/spec.md
   - docs/gui_spec.md
   - docs/roadmap.md
   - docs/NEXT_STEPS_PROMPT.md
   - Any VibeDev.txt or similar

2. For each file, summarize:
   - Purpose
   - Key sections
   - Gaps (what's missing)
   - Contradictions (what conflicts with other docs)
   - Outdated parts (what no longer matches the codebase)

3. Output your inventory as a structured list before proceeding.


PHASE 1 — EXTRACT THE "TRUE SPEC"
---------------------------------

1. Extract the core intended product concept:
   - VibeDev as prompt compiler + verifier (step canvas + gates + flow graph)
   - Studio UI for inspectable prompt pipeline
   - Optional runner autoprompt boundary
   - Two-thread planning/execution separation
   - Persistent store (SQLite) for cross-thread continuity

2. Identify missing conceptual pieces. These MUST be added:
   - Explicit failure modes and "enemy" list (what VibeDev prevents)
   - Behavioral contract (forbidden/mandatory rules for LLMs)
   - Step canvas as first-class schema (not just prose)
   - Concrete gate types with parameters
   - Evidence schema with required/optional fields
   - Flow graph with explicit loops (retry/diagnose/escalate)
   - "Trust features" in UI (prompt previews, injection previews, gate results)
   - Runner brain/hands separation

3. Identify redundancies across docs and note what can be consolidated.


PHASE 2 — DESIGN THE NEW DOCS LAYOUT
------------------------------------

Propose and implement a docs layout like this:

```
docs/
├── 00_overview.md              # What/why/mental model/failure modes
├── 01_architecture.md          # Components + boundaries; store vs compiler vs verifier vs UI vs runner
├── 02_step_canvas_spec.md      # Schema + examples; what step templates look like
├── 03_gates_and_evidence.md    # Gate types; evidence JSON schemas; verifier behavior
├── 04_flow_graph_and_loops.md  # Pass/fail/retry/diagnose/escalate; thread policies
├── 05_studio_ui_spec.md        # UI panes; previews; run monitor
├── 06_runner_autoprompt_spec.md # Runner actions; safety interlocks; start new thread rules
└── 07_doc_map.md               # Concept → File#Section mapping
```

You may adjust names but MUST cover all topics above.


PHASE 3 — REFACTOR / CREATE THE DOCS
------------------------------------

When writing, follow these rules:

A) STYLE
- Prefer examples and schemas to abstract prose
- Define terms once and reuse them consistently:
  - "StepTemplate" (not "step definition" or "step object")
  - "Gate" (not "check" or "validation")
  - "EvidenceSchema" (not "proof structure")
  - "FlowGraph" (not "state machine" unless explaining)
  - "RunnerAction" (not "automation step")
- Make "done" criteria explicit and checkable
- Where possible, express schemas in JSON with required fields
- Keep cross-file references consistent
- Keep the writing direct, not marketing fluff

B) REQUIRED CONTENT TO INCLUDE

The following MUST appear in the new docs:

1. ONE-SENTENCE DEFINITION (in 00_overview.md)
   Example: "VibeDev MCP is a prompt compiler + verifier that turns planning artifacts into deterministic step templates with gates, then executes them with evidence gating."

2. LLM FAILURE MODES LIST (in 00_overview.md)
   - Premature implementation
   - Implicit assumptions
   - Scope creep
   - Hand-wavy completion
   - Context drift
   - Big-bang diffs
   - Cargo-cult tests
   - Undocumented design
   - Thread amnesia

   For each: name, description, why catastrophic, how VibeDev prevents it.

3. BEHAVIORAL CONTRACT (in 00_overview.md or separate file)
   - Forbidden actions (list of 10+)
   - Mandatory actions (list of 10+)
   - Truthfulness standard

4. STEP CANVAS SCHEMA (in 02_step_canvas_spec.md)
   Fields:
   - step_id, title, objective
   - prompt_template (with variable support)
   - injections (files, globs, context_ids, repo_map, invariants, mistakes)
   - tool_policy (allowed, forbidden, max_calls)
   - evidence_schema (required, optional, criteria_checklist)
   - gates[] (type, parameters, description)
   - on_fail (max_retries, retry_prompt, diagnose_prompt, escalate_policy)
   - on_pass (next step or JOB_COMPLETE)
   - human_review (boolean)
   - checkpoint (boolean)

   Include at least 2 full examples:
   - (1) Repo Recon step
   - (2) Patch+Tests step

5. GATE TYPES AND EVIDENCE (in 03_gates_and_evidence.md)
   Gate types with parameters:
   - command_exit_0 (command)
   - command_output_contains (command, contains)
   - command_output_regex (command, pattern)
   - file_exists (path)
   - file_not_exists (path)
   - json_schema_valid (path, schema_id)
   - changed_files_allowlist (allowed[])
   - changed_files_minimum (paths[], min_count)
   - forbid_paths (paths[])
   - diff_max_lines (max)
   - diff_min_lines (min)
   - patch_applies_cleanly (patch)
   - no_uncommitted_changes
   - tests_passed
   - lint_passed
   - criteria_checklist_complete
   - human_approval

   Evidence schema examples with required fields and example payloads.

6. FLOW GRAPH / LOOPS (in 04_flow_graph_and_loops.md)
   - Standard retry → diagnose → escalate pattern (with ASCII diagram)
   - Escalation policies: RETRY, DIAGNOSE, PAUSE_FOR_HUMAN, ROUTE_TO_PLANNING, FAIL_JOB
   - How transitions are chosen deterministically
   - Diagnose step template
   - Thread reset policy

7. STUDIO UI SPEC (in 05_studio_ui_spec.md)
   - Flow view + step canvas + run monitor (with ASCII mockups)
   - Prompt preview, injection preview, gate results, next action preview
   - Trust features that make the pipeline verifiable
   - Edit capability for step templates

8. RUNNER AUTOPROMPT SPEC (in 06_runner_autoprompt_spec.md)
   - MCP is brain (decides next action)
   - Runner is hands (pastes, types, sends)
   - Runner actions: PASTE_PROMPT, SEND_PROMPT, NEW_THREAD, COPY_TO_CLIPBOARD, WAIT_FOR_RESPONSE
   - Implementation options (browser extension, VS Code extension, OS automation, clipboard-only)
   - Safety interlocks (default off, manual enable, pause on human review)

9. DOC MAP (in 07_doc_map.md)
   A table that maps concepts → file + section heading:

   | Concept | File | Section |
   |---------|------|---------|
   | One-sentence definition | 00_overview.md | #what-vibedev-is |
   | LLM failure modes | 00_overview.md | #failure-modes |
   | ... | ... | ... |


PHASE 4 — UPDATE CLAUDE.md
--------------------------

Replace or refactor CLAUDE.md so it becomes the authoritative "LLM operating manual":

1. Start with one-sentence definition
2. List failure modes (the enemy)
3. State behavioral contract (forbidden + mandatory)
4. Define key entities (Job, StepTemplate, Gate, Evidence, FlowGraph)
5. Explain two-thread workflow
6. Reference the detailed docs for schemas
7. Include "docs-only refactor done criteria"
8. Ensure CLAUDE.md instructs LLMs to:
   - Be truthful about command execution
   - Avoid code edits when not allowed
   - Provide structured evidence
   - Record mistakes

The new CLAUDE.md should be substantial (500+ lines) and serve as both:
- A quick reference for key concepts
- An authoritative behavioral contract


PHASE 5 — UPDATE README.md
--------------------------

Update README.md to be user-facing:
1. One-sentence description
2. Why it exists (brief, 2-3 sentences)
3. Installation instructions
4. Quick start (how to run)
5. Core concepts (link to detailed docs)
6. Pointer to CLAUDE.md for LLM usage
7. Contributing guidelines


PHASE 6 — VALIDATION (MUST DO)
------------------------------

Before finishing, you MUST:

1. Show a "Changed Files" list
2. Confirm only docs/text files were changed (no code)
3. Provide a short diff summary per file
4. Provide the completed Doc Map (Concept → File#Section)
5. List any contradictions that remain unresolved as TODOs
6. List any code changes needed as TODOs (but do NOT implement)


================================================================================
OUTPUT FORMAT
================================================================================

Return your work in this structure:

```markdown
# VibeDev Documentation Refactor Results

## 1. Inventory Summary

[Summary of Phase 0 findings]

## 2. Changed Files

| File | Action | Summary |
|------|--------|---------|
| docs/00_overview.md | Created | Overview and failure modes |
| ... | ... | ... |

## 3. Doc Map

| Concept | File | Section |
|---------|------|---------|
| One-sentence definition | docs/00_overview.md | #what-vibedev-is |
| ... | ... | ... |

## 4. Per-File Summary

### docs/00_overview.md
[Summary of what this file contains]

### docs/01_architecture.md
[Summary of what this file contains]

... (continue for all files)

## 5. TODOs / Future Work

### Documentation TODOs
- [ ] [item]

### Code Changes Needed (NOT IMPLEMENTED)
- [ ] [item]

## 6. Verification

- [ ] Only docs/text files modified
- [ ] No code files touched
- [ ] All required content included
- [ ] Doc map complete
- [ ] No contradictions between docs
```


================================================================================
ADDITIONAL GUIDANCE
================================================================================

COMPILATION SURFACE REQUIREMENT
-------------------------------

Every new doc must include a "Compilation Surface" section at the end that explicitly lists:
- Which parts of this doc map to stored `Job` fields
- Which parts map to `StepTemplate` fields
- Which parts map to verifier policies
- Which parts are informational only

Example:

```markdown
## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| Gate Types | StepTemplate.gates | gates[] |
| Evidence Schema | StepTemplate.evidence_schema | evidence_schema |
| Policy Defaults | Job.policies | policies |
```

This makes the planning docs literally *compiler input*, not just explanation.


TERM CONSISTENCY
----------------

Use these exact terms throughout all docs:

| Term | Definition | Do NOT Use |
|------|------------|------------|
| StepTemplate | A step canvas object | step definition, step spec, step object |
| Gate | A qualification check | validation, check, test (when meaning gate) |
| EvidenceSchema | Required proof structure | evidence format, proof schema |
| FlowGraph | Step transitions + failure paths | state machine (unless explaining) |
| RunnerAction | Automation command | automation step, robot action |
| Invariant | Non-negotiable rule | constraint (when meaning invariant) |
| MistakeLedger | Failure memory store | error log, failure list |
| DevLog | Per-step progress log | changelog, activity log |


DO NOT
------

- Do not touch code
- Do not mention that you "ran tests" if you didn't
- Do not add vague motivational prose—this is a build spec
- Do not use marketing language ("revolutionary", "game-changing")
- Do not leave concepts undefined—every term must be explained once
- Do not create circular references between docs
- Do not duplicate content across docs (reference instead)


================================================================================
BEGIN NOW
================================================================================

Start by inventorying the repo docs/text files (Phase 0), then proceed through phases 1–6.

Remember: Your goal is to make the documentation so clear that:
1. A new developer can understand the system in 30 minutes
2. An LLM can operate correctly by reading CLAUDE.md
3. The docs compile into actual system behavior (they're not just explanatory)

Good luck.
```

---

## Usage Notes

1. **Copy the entire block** above (from the opening ``` to the closing ```).

2. **Paste into Claude Code** or your Claude interface.

3. **Wait for Claude to complete all 6 phases** before reviewing.

4. **Review the output** for:
   - Completeness (all required content present)
   - Consistency (terms used correctly)
   - No code changes (verification check)

5. **Iterate if needed** by asking Claude to fix specific issues.

## Expected Outcome

After running this prompt, you should have:

- `docs/00_overview.md` — System purpose, failure modes, behavioral contract
- `docs/01_architecture.md` — Component boundaries, data flow
- `docs/02_step_canvas_spec.md` — StepTemplate schema with examples
- `docs/03_gates_and_evidence.md` — Gate types, evidence schemas
- `docs/04_flow_graph_and_loops.md` — Transitions, retry/diagnose/escalate
- `docs/05_studio_ui_spec.md` — UI layout, trust features
- `docs/06_runner_autoprompt_spec.md` — Runner actions, safety
- `docs/07_doc_map.md` — Concept → location mapping
- Updated `CLAUDE.md` — Authoritative LLM operating manual
- Updated `README.md` — User-facing overview

All documentation will have "Compilation Surface" sections that map directly to system entities.
