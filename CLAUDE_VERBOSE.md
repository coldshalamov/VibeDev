# VibeDev MCP — Claude Operating Manual (Verbose)

**Version:** 2.0
**Scope:** THIS FILE IS AUTHORITATIVE FOR LLM BEHAVIOR IN THIS REPO.

---

## 0) What You Are Building (One Sentence)

VibeDev MCP is a **prompt compiler + verifier**: it turns planning artifacts into a deterministic prompt-flow (step templates + gates + loops), then executes it with evidence gating and optional autoprompting.

---

## 1) Why This Exists (The Failure Modes It Prevents)

LLMs fail in predictable ways. VibeDev exists to make those failures hard or expensive.

### 1.1 Core LLM Failure Modes (The Enemy List)

| Failure Mode | Description | Why It's Catastrophic |
|--------------|-------------|----------------------|
| **Premature Implementation** | Coding before requirements are stable | Architecture becomes unmaintainable; rework explodes |
| **Implicit Assumptions** | "I assumed X" silently becomes architecture | Hidden constraints surface as bugs weeks later |
| **Scope Creep** | "While I'm here…" changes unrelated things | Diffs become unreviewable; regressions hide |
| **Hand-wavy Completion** | Declaring done without proof | Broken features ship; technical debt compounds |
| **Context Drift** | Forgetting invariants and earlier decisions | Same mistakes repeated; contradictory implementations |
| **Big-bang Diffs** | Huge changes with no checkpoints or rollback | Debugging becomes archaeology; bisection impossible |
| **Cargo-cult Tests** | Claiming tests passed without running them | False confidence; production failures |
| **Undocumented Design** | Correct code that nobody can maintain | Knowledge silos; onboarding hell |
| **Thread Amnesia** | Losing plan rationale across chats and sessions | Reinventing wheels; conflicting approaches |

### 1.2 VibeDev's Counter-Mechanisms

| Mechanism | Counters | How |
|-----------|----------|-----|
| **Two-Thread Separation** | Context drift, thread amnesia | Planning mess stays in planning; execution is clean |
| **Step Templates (Canvas)** | Premature implementation, scope creep | Instructions are explicit; boundaries enforced |
| **Gates (Qualifiers)** | Hand-wavy completion, cargo-cult tests | Must prove criteria met before advancing |
| **Evidence Schemas** | Cargo-cult tests, undocumented design | Structured proof of work required |
| **Flow Graphs with Loops** | Big-bang diffs, scope creep | Retry/diagnose/escalate paths are explicit |
| **Invariant Injection** | Implicit assumptions, context drift | Rules repeated every step |
| **Mistake Ledger** | Repeated failures | Lessons persist and surface |
| **Repo Map** | Thread amnesia, undocumented design | Architecture stays visible |

**You are not here to be clever. You are here to be correct, auditable, and deterministic.**

---

## 2) Behavioral Contract (Hard Rules)

These rules are not "best practices." They are invariants. Violation is system failure.

### 2.1 FORBIDDEN (Never Do)

1. **Do NOT modify code unless explicitly instructed to do so.**
2. **Do NOT claim you ran commands you did not run.**
3. **Do NOT invent evidence** (test output, lint output, file changes).
4. **Do NOT expand scope beyond the current step's objective.**
5. **Do NOT "fix adjacent issues"** unless the plan explicitly includes it.
6. **Do NOT rewrite entire files** when a minimal patch is possible.
7. **Do NOT change any file not allowed by the step template** (when executing).
8. **Do NOT move from PLANNING to EXECUTION** unless the job is READY.
9. **Do NOT guess or hallucinate** file paths, function names, or test results.
10. **Do NOT batch multiple steps into one** unless explicitly designed that way.

### 2.2 MANDATORY (Always Do)

1. **Always identify first**: current goal, deliverables, invariants, "definition of done."
2. **Use small diffs** and checkpoint frequently (per policy).
3. **Provide verifiable outputs**: exact file paths, diff summaries, command lines, outputs.
4. **When uncertain, stop** and route to PLANNING artifacts instead of improvising.
5. **During planning, write artifacts** that compile into deterministic step templates.
6. **During execution, follow the step template exactly**—no creative interpretation.
7. **Record failures immediately** in the mistake ledger.
8. **Update the dev log** after every successful step.
9. **Validate invariants** at every step before claiming completion.
10. **Request clarification** rather than assuming when requirements are ambiguous.

### 2.3 Truthfulness Standard

If a step requires evidence, you must either:
- **Provide that evidence** (verifiable, structured, complete), OR
- **Fail the step** and trigger the loop (retry → diagnose → escalate)

Passing without evidence is treated as a **system failure**. There is no "trust me."

---

## 3) The Core Product: Prompt Pipeline IDE

VibeDev is not merely "a checklist." It is a **programmable prompt machine**.

### 3.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VibeDev System                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Planning   │───▶│  Compiler   │───▶│ Step Chain  │         │
│  │  Artifacts  │    │             │    │ + Flow Graph│         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                                      │                 │
│        ▼                                      ▼                 │
│  ┌─────────────┐                       ┌─────────────┐         │
│  │   Store     │◀──────────────────────│  Verifier   │         │
│  │  (SQLite)   │                       │   (Gates)   │         │
│  └─────────────┘                       └─────────────┘         │
│        │                                      │                 │
│        ▼                                      ▼                 │
│  ┌─────────────┐                       ┌─────────────┐         │
│  │ Studio UI   │◀─────────────────────▶│   Runner    │         │
│  │  (React)    │                       │(Autoprompt) │         │
│  └─────────────┘                       └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

| Component | Responsibility | Owns |
|-----------|---------------|------|
| **Planning Artifacts** | Capture intent, constraints, structure | Docs, specs, notes |
| **Compiler** | Transform plan into executable steps | Step templates, flow graph |
| **Verifier** | Evaluate gates, validate evidence | Accept/reject decisions |
| **Store** | Persist state across threads | SQLite DB, all entities |
| **Studio UI** | Make the pipeline inspectable | Visualizations, controls |
| **Runner** | Optional autoprompt execution | Keyboard/clipboard automation |

### 3.3 Design Principle (Critical)

- The LLM can help **design** gates and prompts in planning.
- The MCP must be the one that **enforces** gates in execution.
- Where possible, gates must be **machine-checkable** (tests, lint, file existence).

---

## 4) Two-Thread Workflow (Required Separation)

VibeDev enforces **cognitive separation**. This is non-negotiable.

### 4.1 Thread A: PLANNING (Messy Sandbox)

**Purpose:** Produce artifacts stable enough to compile into deterministic execution.

**Allowed:**
- Brainstorming
- Research
- Dead ends
- Verbose reasoning
- Multiple iterations
- Asking questions
- Changing direction

**Required Outputs:**
| Output | Description | Stored As |
|--------|-------------|-----------|
| Scope boundaries | What's in/out | Job.goal, context blocks |
| Deliverables | Exact outputs expected | Job.deliverables[] |
| Invariants | Non-negotiable rules | Job.invariants[] |
| Definition of Done | Success criteria | Job.definition_of_done[] |
| Step Templates | Canvas objects with gates | Steps[] |
| Flow Graph | Transitions + failure loops | Step.on_fail, Step.on_pass |
| Repo Context | Only what execution needs | RepoMap, context blocks |

**End State:** Job ID returned, status = READY

### 4.2 Thread B: EXECUTION (Clean Runway)

**Purpose:** Follow the compiled step templates with minimal discretion.

**Allowed:**
- Receiving step prompt
- Performing step objective
- Collecting evidence
- Submitting result
- Retrying on rejection

**Forbidden:**
- Improvising beyond step scope
- Skipping evidence collection
- Changing the plan
- Adding new steps
- Ignoring invariants

**Input:** Job ID only (plus any policy-allowed context injection)

**Loop:**
```
1. Receive step prompt (template + injections)
2. Perform exactly the step's objective
3. Collect evidence (schema-validated)
4. Submit result
5. Verifier accepts → advance OR rejects → retry/diagnose/escalate
6. Repeat until COMPLETE or FAILED
```

### 4.3 Why Separation Matters

| Without Separation | With Separation |
|-------------------|-----------------|
| Context polluted by brainstorming | Clean prompts, focused execution |
| Contradictory plans in same thread | Plans locked before execution |
| Scope creeps mid-execution | Scope frozen at READY transition |
| Mistakes repeated | Mistakes recorded, injected as warnings |
| No audit trail | Complete attempt history |

---

## 5) Data Model (First-Class Entities)

### 5.1 Core Entities

```
┌─────────────────────────────────────────────────────────────────┐
│                           JOB                                   │
├─────────────────────────────────────────────────────────────────┤
│ job_id          │ string (e.g., JOB-7F2A)                       │
│ status          │ PLANNING|READY|EXECUTING|PAUSED|COMPLETE|     │
│                 │ FAILED|ARCHIVED                               │
│ goal            │ One-sentence objective                        │
│ deliverables[]  │ Exact expected outputs                        │
│ invariants[]    │ Non-negotiable rules                          │
│ definition_of_done[] │ Success criteria                         │
│ step_order[]    │ Ordered step IDs                              │
│ policies        │ Strictness toggles (JSON)                     │
│ repo_root       │ Path to repository (optional)                 │
│ current_step_index │ Pointer to active step                     │
└─────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STEP TEMPLATE (Canvas)                     │
├─────────────────────────────────────────────────────────────────┤
│ step_id         │ string (e.g., S1, S2)                         │
│ title           │ Short name                                    │
│ objective       │ One-sentence goal                             │
│ prompt_template │ The instruction text (may have variables)     │
│ injections      │ { files: [], context_ids: [], repo_map: bool }│
│ tool_policy     │ Allowed tools + max calls                     │
│ evidence_schema │ Required evidence fields                      │
│ gates[]         │ Qualification checks                          │
│ on_fail         │ { max_retries, retry_prompt, diagnose_prompt, │
│                 │   escalate_policy }                           │
│ on_pass         │ Next step ID or JOB_COMPLETE                  │
│ human_review    │ Whether human must approve                    │
│ status          │ PENDING|ACTIVE|DONE                           │
└─────────────────────────────────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                          ATTEMPT                                │
├─────────────────────────────────────────────────────────────────┤
│ attempt_id      │ string                                        │
│ step_id         │ FK to step                                    │
│ model_claim     │ MET|NOT_MET|PARTIAL                           │
│ evidence        │ JSON (validated against schema)               │
│ summary         │ Brief description of work done                │
│ accepted        │ boolean                                       │
│ feedback        │ Verifier's response                           │
│ rejection_reasons[] │ Why rejected (if applicable)              │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Supporting Entities

| Entity | Purpose | Key Fields |
|--------|---------|------------|
| **ContextBlock** | Stored planning notes | block_type, content, tags |
| **LogEntry** | Dev log entries | log_type, content, step_id |
| **MistakeEntry** | Failure memory | what_happened, lesson, avoid_next_time |
| **RepoSnapshot** | File tree at point in time | file_tree, key_files |
| **RepoMapEntry** | File descriptions | path, description, role |

### 5.3 Job State Machine

```
                    ┌──────────────────────────────────────────┐
                    │                                          │
                    ▼                                          │
              ┌─────────┐                                      │
              │PLANNING │                                      │
              └────┬────┘                                      │
                   │ job_set_ready()                           │
                   ▼                                           │
              ┌─────────┐                                      │
              │  READY  │──────────────────┐                   │
              └────┬────┘                  │                   │
                   │ job_start()           │ job_archive()     │
                   ▼                       │                   │
              ┌─────────┐                  │                   │
        ┌────▶│EXECUTING│◀────┐            │                   │
        │     └────┬────┘     │            ▼                   │
        │          │          │       ┌─────────┐              │
        │          ├──────────┼──────▶│ARCHIVED │              │
        │          │          │       └─────────┘              │
        │ resume() │ pause()  │ fail()                         │
        │          ▼          │                                │
        │     ┌─────────┐     │                                │
        └─────│ PAUSED  │     │                                │
              └─────────┘     │                                │
                              ▼                                │
                         ┌─────────┐                           │
                         │ FAILED  │───────────────────────────┘
                         └─────────┘         archive()

              last_step_accepted()
                    │
                    ▼
              ┌─────────┐
              │COMPLETE │
              └─────────┘
```

---

## 6) Step Canvas Specification (The Heart of the System)

A step is not a paragraph. It is a **structured object** with required parts.

### 6.1 StepTemplate Fields (Complete Schema)

```json
{
  "step_id": "S1",
  "title": "Implement authentication middleware",
  "objective": "Add JWT validation to all protected routes",

  "prompt_template": "Implement JWT authentication middleware for the Express server.\n\nRequirements:\n- Verify tokens using the secret from env.JWT_SECRET\n- Extract user_id and attach to req.user\n- Return 401 for invalid/expired tokens\n- Skip validation for routes in UNPROTECTED_ROUTES\n\nTouch only: src/middleware/auth.ts, src/routes/index.ts\nDo NOT modify: src/db/*, package.json",

  "injections": {
    "files": ["src/middleware/auth.ts", "src/types/express.d.ts"],
    "globs": ["src/routes/*.ts"],
    "context_ids": ["CTX-auth-design", "CTX-jwt-notes"],
    "repo_map_sections": ["middleware", "routes"],
    "include_invariants": true,
    "include_relevant_mistakes": true
  },

  "tool_policy": {
    "allowed_tools": ["read_file", "edit_file", "run_tests", "run_lint"],
    "forbidden_tools": ["delete_file", "run_arbitrary_shell"],
    "max_tool_calls": 20
  },

  "evidence_schema": {
    "required": ["changed_files", "diff_summary", "tests_run", "tests_passed"],
    "optional": ["lint_run", "lint_passed", "artifacts_created", "notes"],
    "criteria_checklist": {
      "jwt_verification_implemented": "JWT tokens are validated on protected routes",
      "user_attached_to_request": "req.user contains decoded user_id",
      "401_on_invalid": "Invalid tokens return 401 status",
      "unprotected_routes_skip": "Routes in UNPROTECTED_ROUTES bypass auth"
    }
  },

  "gates": [
    {
      "type": "command_exit_0",
      "command": "npm test -- --grep 'auth middleware'",
      "description": "Auth middleware tests pass"
    },
    {
      "type": "file_exists",
      "path": "src/middleware/auth.ts",
      "description": "Auth middleware file exists"
    },
    {
      "type": "changed_files_allowlist",
      "allowed": ["src/middleware/auth.ts", "src/routes/index.ts", "src/types/express.d.ts"],
      "description": "Only allowed files were modified"
    },
    {
      "type": "forbid_paths",
      "paths": ["package.json", "package-lock.json", "src/db/*"],
      "description": "Protected files not touched"
    },
    {
      "type": "diff_max_lines",
      "max": 200,
      "description": "Changes are reasonably scoped"
    }
  ],

  "on_fail": {
    "max_retries": 3,
    "retry_prompt": "The previous attempt failed validation. Review the rejection reasons and fix the issues. Focus only on the failed criteria.",
    "diagnose_prompt": "Multiple retries have failed. Before attempting again:\n1. List what you've tried\n2. Identify why each attempt failed\n3. Propose a different approach\n4. Get approval before implementing",
    "escalate_policy": "PAUSE_FOR_HUMAN"
  },

  "on_pass": "S2",

  "human_review": false,
  "checkpoint": false,
  "status": "PENDING"
}
```

### 6.2 Gate Types (Comprehensive Reference)

| Gate Type | Parameters | What It Checks |
|-----------|------------|----------------|
| `command_exit_0` | command | Shell command returns exit code 0 |
| `command_output_contains` | command, contains | Output includes substring |
| `command_output_regex` | command, pattern | Output matches regex |
| `file_exists` | path | File exists at path |
| `file_not_exists` | path | File does NOT exist |
| `json_schema_valid` | path, schema_id | JSON file validates against schema |
| `changed_files_allowlist` | allowed[] | Only listed files were changed |
| `changed_files_minimum` | paths[], min_count | At least N of listed files changed |
| `forbid_paths` | paths[] | None of these paths were touched |
| `diff_max_lines` | max | Total diff lines ≤ max |
| `diff_min_lines` | min | Total diff lines ≥ min |
| `patch_applies_cleanly` | patch | Provided patch applies without conflict |
| `no_uncommitted_changes` | - | Git working tree is clean |
| `tests_passed` | - | evidence.tests_passed == true |
| `lint_passed` | - | evidence.lint_passed == true |
| `criteria_checklist_complete` | - | All criteria_checklist items are true |
| `human_approval` | - | Human clicked approve in UI |

### 6.3 Evidence Schema (Detailed)

```json
{
  "changed_files": {
    "type": "array",
    "items": "string",
    "description": "List of file paths that were modified",
    "required": true
  },
  "diff_summary": {
    "type": "string",
    "description": "Brief description of what changed and why",
    "required": true,
    "min_length": 20
  },
  "commands_run": {
    "type": "array",
    "items": "string",
    "description": "Exact command lines executed",
    "required": false
  },
  "command_outputs": {
    "type": "object",
    "description": "Map of command -> output (may be truncated)",
    "required": false
  },
  "tests_run": {
    "type": "array",
    "items": "string",
    "description": "List of test names/files executed",
    "required": true
  },
  "tests_passed": {
    "type": "boolean",
    "description": "Did all tests pass?",
    "required": true
  },
  "test_output": {
    "type": "string",
    "description": "Test runner output (may be truncated)",
    "required": false
  },
  "lint_run": {
    "type": "boolean",
    "description": "Was linter executed?",
    "required": false
  },
  "lint_passed": {
    "type": "boolean",
    "description": "Did lint pass?",
    "required": false
  },
  "artifacts_created": {
    "type": "array",
    "items": "string",
    "description": "New files created (docs, configs, etc.)",
    "required": false
  },
  "criteria_checklist": {
    "type": "object",
    "description": "Map of criterion_id -> boolean",
    "required": "when evidence_schema_mode=strict"
  },
  "notes": {
    "type": "string",
    "description": "Additional context or observations",
    "required": false
  }
}
```

### 6.4 Example Step Templates

#### Example 1: Repo Reconnaissance Step

```json
{
  "step_id": "S1",
  "title": "Repository reconnaissance and mapping",
  "objective": "Understand the codebase structure and document key components",

  "prompt_template": "Scan the repository and produce a comprehensive repo map.\n\nFor each significant file/directory:\n1. Identify its purpose\n2. Note its dependencies\n3. Flag any concerns (stale, duplicated, poorly named)\n\nOutput a structured REPO_MAP context block.",

  "injections": {
    "files": [],
    "globs": [],
    "context_ids": [],
    "include_invariants": true,
    "include_relevant_mistakes": false
  },

  "tool_policy": {
    "allowed_tools": ["list_directory", "read_file", "grep"],
    "forbidden_tools": ["edit_file", "delete_file"],
    "max_tool_calls": 50
  },

  "evidence_schema": {
    "required": ["files_scanned", "repo_map_created"],
    "optional": ["concerns_flagged", "notes"]
  },

  "gates": [
    {
      "type": "command_exit_0",
      "command": "test -f REPO_MAP.md || echo 'missing' && exit 1",
      "description": "REPO_MAP.md was created"
    }
  ],

  "on_fail": {
    "max_retries": 2,
    "retry_prompt": "The repo map was not created properly. Ensure REPO_MAP.md exists and contains the required structure.",
    "diagnose_prompt": "Unable to create repo map. Explain what's blocking you.",
    "escalate_policy": "PAUSE_FOR_HUMAN"
  },

  "on_pass": "S2",
  "human_review": false,
  "checkpoint": false
}
```

#### Example 2: Implementation + Tests Step

```json
{
  "step_id": "S3",
  "title": "Implement CSV export with tests",
  "objective": "Add CSV export functionality to the reporting module with full test coverage",

  "prompt_template": "Implement CSV export for the Report model.\n\nRequirements:\n- Add `to_csv()` method to Report class\n- Support configurable column selection\n- Handle special characters (quotes, commas, newlines)\n- Add unit tests covering:\n  - Basic export\n  - Column filtering\n  - Special character escaping\n  - Empty report handling\n\nFiles to modify: src/models/report.py, tests/test_report.py\nDo NOT add new dependencies.",

  "injections": {
    "files": ["src/models/report.py", "tests/test_report.py"],
    "context_ids": ["CTX-csv-spec"],
    "include_invariants": true,
    "include_relevant_mistakes": true
  },

  "tool_policy": {
    "allowed_tools": ["read_file", "edit_file", "run_tests"],
    "forbidden_tools": ["run_arbitrary_shell"],
    "max_tool_calls": 30
  },

  "evidence_schema": {
    "required": ["changed_files", "diff_summary", "tests_run", "tests_passed"],
    "optional": ["lint_passed", "notes"],
    "criteria_checklist": {
      "method_added": "to_csv() method exists on Report class",
      "column_selection": "Column selection parameter works",
      "escaping_works": "Special characters are properly escaped",
      "tests_comprehensive": "All four test scenarios are covered"
    }
  },

  "gates": [
    {
      "type": "command_exit_0",
      "command": "pytest tests/test_report.py -v",
      "description": "Report tests pass"
    },
    {
      "type": "changed_files_allowlist",
      "allowed": ["src/models/report.py", "tests/test_report.py"],
      "description": "Only allowed files modified"
    },
    {
      "type": "forbid_paths",
      "paths": ["requirements.txt", "pyproject.toml"],
      "description": "No new dependencies added"
    },
    {
      "type": "criteria_checklist_complete",
      "description": "All implementation criteria met"
    }
  ],

  "on_fail": {
    "max_retries": 3,
    "retry_prompt": "Tests are failing or criteria not met. Review the error output and fix the implementation.",
    "diagnose_prompt": "After 3 failed attempts, analyze:\n1. What's the root cause of failures?\n2. Is there a design issue?\n3. Do we need to revise the approach?",
    "escalate_policy": "ROUTE_TO_PLANNING"
  },

  "on_pass": "S4",
  "human_review": false,
  "checkpoint": false
}
```

---

## 7) Flow Graph (Explicit Loops, Not Improvised)

Steps are nodes. Transitions are edges. **All paths must be explicit.**

### 7.1 Standard Flow Patterns

```
                    ┌─────────────────┐
                    │   Step Active   │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Execute + Submit│
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ Verifier Checks │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
       │   ACCEPT    │ │  REJECT   │ │ NEEDS HUMAN │
       └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
              │              │              │
       ┌──────▼──────┐       │       ┌──────▼──────┐
       │  Next Step  │       │       │   PAUSED    │
       │  OR DONE    │       │       └─────────────┘
       └─────────────┘       │
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
       │ retries < N │ │retries = N│ │retries > N  │
       └──────┬──────┘ └─────┬─────┘ └──────┬──────┘
              │              │              │
       ┌──────▼──────┐ ┌─────▼─────┐ ┌──────▼──────┐
       │   RETRY     │ │ DIAGNOSE  │ │  ESCALATE   │
       │  (loop up)  │ └─────┬─────┘ └──────┬──────┘
       └─────────────┘       │              │
                             │       ┌──────▼──────┐
                      ┌──────▼──────┐│PAUSE or FAIL│
                      │  Propose    ││ or PLANNING │
                      │  New Approach│└─────────────┘
                      └──────┬──────┘
                             │
                      ┌──────▼──────┐
                      │   RETRY     │
                      └─────────────┘
```

### 7.2 Diagnose Step Template

When retries exhaust, inject a **structured diagnose step**:

```json
{
  "diagnose_prompt": "Multiple attempts have failed. Before trying again:\n\n1. ANALYZE: List each attempt and why it failed\n2. IDENTIFY: What's the root cause?\n3. PROPOSE: Describe a different approach\n4. VALIDATE: Does this approach respect all invariants?\n5. CONFIRM: Wait for approval before implementing\n\nDo NOT start implementing until your proposal is accepted."
}
```

### 7.3 Escalation Policies

| Policy | Behavior |
|--------|----------|
| `RETRY` | Return retry_prompt, increment attempt counter |
| `DIAGNOSE` | Return diagnose_prompt, require structured analysis |
| `PAUSE_FOR_HUMAN` | Set job to PAUSED, wait for human approval |
| `ROUTE_TO_PLANNING` | Return to PLANNING phase for plan revision |
| `FAIL_JOB` | Set job to FAILED, record in mistake ledger |

---

## 8) Studio UI Specification (What Humans Must See)

The UI must make the pipeline **inspectable and trustworthy**.

### 8.1 Minimum Required Views

| View | Purpose | Shows |
|------|---------|-------|
| **Flow View** | Graph visualization | Nodes (steps), edges (pass/fail), current state, completion % |
| **Step Canvas View** | Single step detail | Prompt preview, injection preview, gates, retry/diagnose prompts |
| **Run Monitor** | Execution tracking | Model output, evidence JSON, gate results, next action |
| **Sidebar** | Persistent context | Job metadata, invariants, mistakes, repo map |

### 8.2 Critical UI Elements

#### Step Canvas View
```
┌─────────────────────────────────────────────────────────────┐
│ Step S3: Implement CSV export with tests            [ACTIVE]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ PROMPT PREVIEW (Rendered)                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Implement CSV export for the Report model.              │ │
│ │                                                         │ │
│ │ Requirements:                                           │ │
│ │ - Add `to_csv()` method to Report class                 │ │
│ │ - Support configurable column selection                 │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ INJECTIONS                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Files: [src/models/report.py] [tests/test_report.py]    │ │
│ │ Context: [CTX-csv-spec]                                 │ │
│ │ Invariants: ✓ (3 rules injected)                        │ │
│ │ Mistakes: ✓ (1 relevant warning injected)               │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ GATES                                                       │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ☐ pytest tests/test_report.py -v (exit 0)               │ │
│ │ ☐ Only allowed files modified                           │ │
│ │ ☐ No new dependencies                                   │ │
│ │ ☐ All criteria checklist items true                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ON FAILURE                                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Retry: "Tests are failing or criteria not met..."       │ │
│ │ Diagnose: "After 3 failed attempts, analyze..."         │ │
│ │ Escalate: ROUTE_TO_PLANNING                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Copy Prompt] [Edit Step] [Run Gates Manually]              │
└─────────────────────────────────────────────────────────────┘
```

#### Run Monitor View
```
┌─────────────────────────────────────────────────────────────┐
│ RUN MONITOR - Job JOB-7F2A                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ CURRENT STEP: S3 (Attempt 2/3)                              │
│                                                             │
│ MODEL OUTPUT                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ I've implemented the to_csv() method with the           │ │
│ │ following changes...                                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ EXTRACTED EVIDENCE                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ {                                                       │ │
│ │   "changed_files": ["src/models/report.py", ...],       │ │
│ │   "tests_passed": true,                                 │ │
│ │   "criteria_checklist": { "method_added": true, ... }   │ │
│ │ }                                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ GATE RESULTS                                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✅ pytest exit 0                                        │ │
│ │ ✅ Only allowed files modified                          │ │
│ │ ✅ No new dependencies                                  │ │
│ │ ❌ criteria_checklist incomplete (escaping_works=false) │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ NEXT ACTION: RETRY (attempt 3/3)                            │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Tests are failing or criteria not met. The              │ │
│ │ escaping_works criterion is false...                    │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Accept Override] [Reject + Retry] [Pause Job]              │
└─────────────────────────────────────────────────────────────┘
```

### 8.3 Trust Features (Non-Negotiable)

The UI must enable humans to **verify**, not just observe:

1. **Prompt Preview**: Show exact text that will be sent
2. **Injection Preview**: Show what files/context are included
3. **Gate Results**: Show pass/fail for each gate with details
4. **Evidence Display**: Show structured evidence, highlight missing fields
5. **Attempt History**: Show all attempts for current step with rejection reasons
6. **Manual Override**: Allow human to accept/reject despite gate results
7. **Edit Capability**: Allow editing step templates during planning

---

## 9) Autoprompt Runner Specification (Optional "Let It Rip" Mode)

The runner is split into two responsibilities to maintain safety.

### 9.1 MCP Responsibility (Brain)

The MCP determines what happens next. It is **purely decision-making**:

| Situation | MCP Output |
|-----------|------------|
| Step accepted, more steps | `{ action: "NEXT_STEP", step_id: "S4", prompt: "..." }` |
| Step accepted, no more steps | `{ action: "JOB_COMPLETE" }` |
| Step rejected, retries left | `{ action: "RETRY", prompt: "...", attempt: 2 }` |
| Step rejected, retries exhausted | `{ action: "DIAGNOSE", prompt: "..." }` |
| Diagnose failed | `{ action: "ESCALATE", policy: "PAUSE_FOR_HUMAN" }` |
| Human review required | `{ action: "AWAIT_HUMAN" }` |

The MCP **never** interacts with UI, clipboard, or keyboard.

### 9.2 Runner Responsibility (Hands)

A separate local agent performs UI automation:

```
┌──────────────────────────────────────────────────────────┐
│                    RUNNER ACTIONS                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ 1. PASTE_PROMPT                                          │
│    - Focus LLM input area                                │
│    - Paste prompt from clipboard                         │
│    - (Do not send yet)                                   │
│                                                          │
│ 2. SEND_PROMPT                                           │
│    - Press Enter / click Send                            │
│                                                          │
│ 3. NEW_THREAD                                            │
│    - Open new chat thread                                │
│    - Paste job context                                   │
│                                                          │
│ 4. COPY_TO_CLIPBOARD                                     │
│    - Copy specified text to clipboard                    │
│                                                          │
│ 5. WAIT_FOR_RESPONSE                                     │
│    - Monitor for LLM response                            │
│    - Extract structured output                           │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 9.3 Implementation Options

| Option | Pros | Cons |
|--------|------|------|
| **Browser Extension** | Best control, works with any chat UI | Browser-specific |
| **VS Code Extension** | Integrated with IDE chat | VS Code only |
| **OS Automation** (AutoHotkey/AppleScript) | Universal | Fragile, requires permissions |
| **Clipboard Only** | Simplest, no automation | Requires manual paste/send |

### 9.4 Safety Interlocks

| Setting | Default | Effect |
|---------|---------|--------|
| `autoprompt_enabled` | false | Master on/off |
| `auto_send` | false | If false, paste but don't send |
| `pause_on_human_review` | true | Stop when human_review step reached |
| `pause_on_diagnose` | true | Stop when diagnose mode entered |
| `max_consecutive_retries` | 3 | Stop after N retries without progress |
| `new_thread_on_step_N` | 5 | Start new thread every N steps |

---

## 10) Policy Configuration (Strictness Toggles)

### 10.1 Complete Policy Reference

```json
{
  "require_devlog_per_step": {
    "type": "boolean",
    "default": true,
    "effect": "Reject submission if devlog_line is missing"
  },
  "require_commit_per_step": {
    "type": "boolean",
    "default": false,
    "effect": "Reject submission if commit_hash is missing"
  },
  "allow_batch_commits": {
    "type": "boolean",
    "default": true,
    "effect": "Allow deferring commits to checkpoint steps"
  },
  "require_tests_evidence": {
    "type": "boolean",
    "default": true,
    "effect": "Reject if tests_run and tests_passed are missing"
  },
  "require_diff_summary": {
    "type": "boolean",
    "default": true,
    "effect": "Reject if diff_summary is missing or too short"
  },
  "diff_summary_min_length": {
    "type": "integer",
    "default": 20,
    "effect": "Minimum characters for diff_summary"
  },
  "inject_invariants_every_step": {
    "type": "boolean",
    "default": true,
    "effect": "Include invariants in every step prompt"
  },
  "inject_mistakes_every_step": {
    "type": "boolean",
    "default": true,
    "effect": "Include relevant mistakes in every step prompt"
  },
  "evidence_schema_mode": {
    "type": "enum",
    "values": ["loose", "strict"],
    "default": "loose",
    "effect": "Strict requires per-criterion checklist"
  },
  "max_retries_per_step": {
    "type": "integer",
    "default": 3,
    "effect": "Number of retries before diagnose mode"
  },
  "auto_checkpoint_interval": {
    "type": "integer",
    "default": 0,
    "effect": "Insert checkpoint step every N steps (0 = disabled)"
  },
  "require_repo_snapshot_on_init": {
    "type": "boolean",
    "default": false,
    "effect": "Take repo snapshot when job is created"
  }
}
```

### 10.2 Policy Presets

| Preset | Use Case | Key Settings |
|--------|----------|--------------|
| **Relaxed** | Learning, exploration | loose evidence, no commits required |
| **Standard** | Normal development | strict evidence, batch commits allowed |
| **Strict** | Production, compliance | per-step commits, all gates required |
| **Paranoid** | Safety-critical | human review on every step, no autoprompt |

---

## 11) Planning Documents (Source of Truth)

Planning docs must be written so they **compile into executable artifacts**.

### 11.1 Required Documentation Structure

| Document | Purpose | Compiles To |
|----------|---------|-------------|
| `docs/00_overview.md` | What/why/mental model | Job.goal, context blocks |
| `docs/01_architecture.md` | Components + boundaries | RepoMap, invariants |
| `docs/02_step_canvas_spec.md` | Step template schema | Step validation rules |
| `docs/03_gates_and_evidence.md` | Gate types + schemas | Verifier configuration |
| `docs/04_flow_graph_and_loops.md` | Transitions + escalation | Step.on_fail, Step.on_pass |
| `docs/05_studio_ui_spec.md` | UI layout + features | UI implementation |
| `docs/06_runner_autoprompt_spec.md` | Runner actions + safety | Runner configuration |

### 11.2 Documentation Requirements

Each doc must include:

1. **Compilation Surface** section listing:
   - Which parts map to Job fields
   - Which parts map to StepTemplate fields
   - Which parts map to verifier policies

2. **Examples** (concrete, not abstract)

3. **Schemas** (JSON where applicable)

4. **Checklists** (actionable items)

### 11.3 Style Requirements

- Prefer **examples and schemas** over abstract prose
- Define terms **once** and use consistently
- Keep "**what**" separate from "**how**" and "**why**"
- Make "done" criteria **explicit and checkable**
- No marketing fluff—this is a build spec

---

## 12) Output Requirements (What You Must Produce)

### 12.1 When Making Changes

Every change set must include:

```markdown
## Changes Made

### Files Modified
- `path/to/file1.py`: [brief description]
- `path/to/file2.py`: [brief description]

### Diff Summary
[2-3 sentence summary of what changed and why]

### Commands Run
- `pytest tests/test_foo.py -v` → [result]
- `ruff check src/` → [result]

### Tests Affected
- Added: test_new_feature, test_edge_case
- Modified: test_existing_behavior
- All tests passing: Yes/No

### Invariants Verified
- [ ] No full-file overwrites
- [ ] No new dependencies added
- [ ] Only allowed files modified

### Notes
[Any additional context]
```

### 12.2 When Proposing Changes (Docs-Only Mode)

If instructed to not edit code:

```markdown
## Proposed Changes

### TODO List
1. [ ] [file]: [what needs to change]
2. [ ] [file]: [what needs to change]

### Implementation Notes
[Technical details for future implementation]

### Suggested Step Template
[Draft step template for future execution]

### Open Questions
- [question 1]
- [question 2]
```

---

## 13) Definition of "Done" (Completion Criteria)

### 13.1 Documentation Refactor Done When

- [ ] System purpose stated in one sentence at top-level
- [ ] Failure modes and behavioral contract are explicit
- [ ] Step canvas spec exists with schema + examples
- [ ] Gates + evidence are concrete and enforceable
- [ ] Flow graph and loops are explicit
- [ ] Studio UI spec is coherent and minimal
- [ ] Runner spec has clear brain/hands separation
- [ ] No contradictions across docs
- [ ] All terms defined consistently
- [ ] Doc map exists (concept → file#section)

### 13.2 Feature Implementation Done When

- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Evidence collected (structured format)
- [ ] Invariants verified
- [ ] Dev log updated
- [ ] Mistake ledger updated (if applicable)
- [ ] No scope creep beyond step objective

### 13.3 Job Complete When

- [ ] All steps in DONE status
- [ ] All deliverables produced
- [ ] Definition of done satisfied
- [ ] Final dev log entry made
- [ ] Export bundle generated
- [ ] Job transitioned to COMPLETE

---

## 14) Appendix: Quick Reference

### 14.1 Job Statuses

| Status | Meaning | Can Transition To |
|--------|---------|-------------------|
| PLANNING | Collecting artifacts | READY |
| READY | Plan compiled, awaiting execution | EXECUTING, ARCHIVED |
| EXECUTING | Steps being performed | PAUSED, COMPLETE, FAILED |
| PAUSED | Temporarily halted | EXECUTING |
| COMPLETE | All steps done successfully | ARCHIVED |
| FAILED | Explicitly failed | ARCHIVED |
| ARCHIVED | Stored for reference | (terminal) |

### 14.2 Step Statuses

| Status | Meaning |
|--------|---------|
| PENDING | Not yet started |
| ACTIVE | Currently being worked on |
| DONE | Completed successfully |

### 14.3 Model Claims

| Claim | Meaning | Verifier Response |
|-------|---------|-------------------|
| MET | All criteria satisfied | Evaluate gates |
| NOT_MET | Some criteria not satisfied | Reject, return retry prompt |
| PARTIAL | Some criteria met, some unclear | Evaluate gates, may accept or reject |

### 14.4 Key Tool Commands

| Phase | Tool | Purpose |
|-------|------|---------|
| Planning | `conductor_init` | Create job |
| Planning | `conductor_answer` | Answer interview questions |
| Planning | `plan_propose_steps` | Define step chain |
| Planning | `job_set_ready` | Transition to READY |
| Execution | `job_start` | Begin execution |
| Execution | `job_next_step_prompt` | Get current step |
| Execution | `job_submit_step_result` | Submit evidence |
| Both | `mistake_record` | Log failure |
| Both | `devlog_append` | Log progress |

---

**END OF CLAUDE OPERATING MANUAL**
