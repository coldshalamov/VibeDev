# VibeDev MCP — Overview

## Implementation Status

**Overall: 85% Complete**  
**Production Ready: Core v1.0**  
**Test Coverage: 140/140 passing (100%)**

| Feature | Status | Notes |
|---------|--------|-------|
| Two-Thread Workflow | ✅ 100% | PLANNING → READY → EXECUTING → COMPLETE |
| Step Templates | ✅ 100% | Full CRUD, compilation, execution |
| Gate System | ✅ 94% | 16 of 17 gate types implemented |
| Evidence Validation | ✅ 90% | Required fields, types, policies enforced |
| FlowGraph | ✅ 85% | Retry, next, completion working |
| Repository Integration | ✅ 90% | Git, snapshots, maps functional |
| Studio UI | ⚠️ 70% | Core works, missing trust panels |
| E2E Tests | ❌ 0% | Unit tests excellent, no workflow tests |

## What VibeDev Is

**VibeDev MCP is a prompt compiler + verifier that turns planning artifacts into deterministic step templates with gates, then executes them with evidence gating.**

It is a persistent development process brain that:
1. Separates messy planning from clean execution
2. Converts instructions into structured StepTemplates
3. Enforces evidence-based progress through Gates
4. Maintains memory across threads via SQLite persistence

---

## Why VibeDev Exists (The Enemy List)

LLMs fail in predictable ways. VibeDev exists to make those failures hard or expensive.

### Core LLM Failure Modes

| # | Failure Mode | Description | Why Catastrophic | How VibeDev Prevents It |
|---|--------------|-------------|------------------|------------------------|
| 1 | **Premature Implementation** | Coding before requirements are stable | Architecture becomes unmaintainable; rework explodes | Two-Thread separation: must complete Planning before Execution |
| 2 | **Implicit Assumptions** | "I assumed X" silently becomes architecture | Hidden constraints surface as bugs weeks later | Invariants captured explicitly; injected every step |
| 3 | **Scope Creep** | "While I'm here…" changes unrelated things | Diffs become unreviewable; regressions hide | Step boundaries enforced; `changed_files_allowlist` gate |
| 4 | **Hand-wavy Completion** | Declaring done without proof | Broken features ship; technical debt compounds | Evidence gating: must provide structured proof |
| 5 | **Context Drift** | Forgetting invariants and earlier decisions | Same mistakes repeated; contradictory implementations | Invariants + MistakeLedger injected per step |
| 6 | **Big-bang Diffs** | Huge changes with no checkpoints or rollback | Debugging becomes archaeology; bisection impossible | Step-by-step execution; checkpoint policies |
| 7 | **Cargo-cult Tests** | Claiming tests passed without running them | False confidence; production failures | Evidence requires `commands_run` + actual output |
| 8 | **Undocumented Design** | Correct code that nobody can maintain | Knowledge silos; onboarding hell | RepoMap + DevLog capture decisions |
| 9 | **Thread Amnesia** | Losing plan rationale across chats and sessions | Reinventing wheels; conflicting approaches | SQLite persistence; Job ID carries state |

### The Counter-Mechanism Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    VibeDev Prevention Layer                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   Failure Mode          │   VibeDev Counter-Mechanism          │
│   ──────────────────────┼────────────────────────────────────  │
│   Premature Impl.       │   Two-Thread Workflow                │
│   Implicit Assumptions  │   Invariant Injection                │
│   Scope Creep           │   StepTemplate Boundaries + Gates    │
│   Hand-wavy Completion  │   EvidenceSchema Validation          │
│   Context Drift         │   Persistent Store + Injection       │
│   Big-bang Diffs        │   Checkpoint Steps + `diff_max_lines`│
│   Cargo-cult Tests      │   `command_exit_0` Gate              │
│   Undocumented Design   │   RepoMap + DevLog                   │
│   Thread Amnesia        │   SQLite + Job ID Continuity         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Behavioral Contract

### Forbidden Actions (LLMs MUST NOT)

1. **Modify code without explicit instruction** to do so
2. **Claim commands were run** that were not actually run
3. **Invent evidence** (test output, lint output, file changes)
4. **Expand scope** beyond the current step's objective
5. **Fix adjacent issues** unless the plan explicitly includes them
6. **Rewrite entire files** when a minimal patch is possible
7. **Change files not allowed** by the step template
8. **Move from PLANNING to EXECUTION** unless job is READY
9. **Guess or hallucinate** file paths, function names, or test results
10. **Batch multiple steps** into one unless explicitly designed that way
11. **Skip evidence collection** when gates require it
12. **Ignore invariants** even if they seem inconvenient

### Mandatory Actions (LLMs MUST)

1. **Identify first**: goal, deliverables, invariants, definition of done
2. **Use small diffs** and checkpoint frequently (per policy)
3. **Provide verifiable outputs**: exact paths, diff summaries, command outputs
4. **When uncertain, stop** and route to PLANNING instead of improvising
5. **During planning, write artifacts** that compile into step templates
6. **During execution, follow the step template exactly**
7. **Record failures immediately** in the MistakeLedger
8. **Update the DevLog** after every successful step
9. **Validate invariants** at every step before claiming completion
10. **Request clarification** rather than assuming when ambiguous
11. **Collect evidence** in the required schema format
12. **Submit honest self-assessments** (MET/NOT_MET/PARTIAL)

### Truthfulness Standard

If a step requires evidence, you must either:
- **Provide that evidence** (verifiable, structured, complete), OR
- **Fail the step** and trigger the loop (retry → diagnose → escalate)

Passing without evidence is treated as a **system failure**.

---

## Core Concepts (Quick Reference)

| Concept | Definition | See Also |
|---------|------------|----------|
| **Job** | A task with full lifecycle (PLANNING → READY → EXECUTING → COMPLETE) | [01_architecture.md](01_architecture.md) |
| **StepTemplate** | A structured instruction object with gates and evidence requirements | [02_step_canvas_spec.md](02_step_canvas_spec.md) |
| **Gate** | A qualification check that must pass before advancing | [03_gates_and_evidence.md](03_gates_and_evidence.md) |
| **EvidenceSchema** | The required proof structure for a step | [03_gates_and_evidence.md](03_gates_and_evidence.md) |
| **FlowGraph** | Step transitions + failure paths (retry/diagnose/escalate) | [04_flow_graph_and_loops.md](04_flow_graph_and_loops.md) |
| **Invariant** | A non-negotiable rule injected into every step | [01_architecture.md](01_architecture.md) |
| **MistakeLedger** | Persistent failure memory | [01_architecture.md](01_architecture.md) |
| **DevLog** | Per-step progress log | [01_architecture.md](01_architecture.md) |
| **RunnerAction** | Automation command (paste, send, new thread) | [06_runner_autoprompt_spec.md](06_runner_autoprompt_spec.md) |

---

## Doc Map

For the canonical “where is the answer?” index, see: [07_doc_map.md](07_doc_map.md).

## Two-Thread Workflow (Overview)

VibeDev enforces cognitive separation between planning and execution.

### Thread A: PLANNING (Messy Sandbox)

**Purpose:** Produce artifacts stable enough to compile into deterministic execution.

**Allowed:** Brainstorming, research, dead ends, multiple iterations, changing direction.

**Outputs Required:**
- Scope boundaries
- Deliverables list
- Invariants list
- Definition of done
- StepTemplates with gates
- Repo context (optional)

**End State:** Job status = READY

### Thread B: EXECUTION (Clean Runway)

**Purpose:** Follow the compiled step templates with minimal discretion.

**Allowed:** Performing step objective, collecting evidence, submitting results.

**Forbidden:** Improvising, skipping evidence, changing the plan.

**Input:** Job ID only

**Loop:**
```
1. Receive step prompt (template + injections)
2. Perform exactly the step's objective
3. Collect evidence (schema-validated)
4. Submit result
5. Verifier accepts → advance OR rejects → retry/diagnose/escalate
6. Repeat until COMPLETE or FAILED
```

---

## Compilation Surface

This document provides conceptual grounding. It maps to system behavior as follows:

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| Failure Modes | Informational | (Design rationale) |
| Behavioral Contract - Forbidden | LLM instructions | (Enforced by prompts) |
| Behavioral Contract - Mandatory | LLM instructions | (Enforced by prompts) |
| Two-Thread Workflow | Job state machine | `Job.status` |
| Invariants | Job field | `Job.invariants[]` |
| Definition of Done | Job field | `Job.definition_of_done[]` |
