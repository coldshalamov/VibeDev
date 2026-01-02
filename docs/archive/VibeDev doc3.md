---

# **Document 3 — Behavioral Contract, Authority Model, and Invariants**

(For Agents Designing VibeDev Itself)

## **Purpose of This Document**

Doc 1 explains what VibeDev is and why it exists.

Doc 2 explains what components and capabilities the MCP provides.

This document defines how the system must behave under all conditions.

It removes ambiguity about:

* who decides what

* when progress is allowed

* what “done” actually means

* how failures are handled

* what must never happen

Agents implementing VibeDev must treat this document as authoritative.

---

## **1\. Authority Model (Non-Negotiable)**

VibeDev enforces a strict hierarchy of authority:

* The MCP is the sole authority on state

  * current phase (planning vs execution)

  * current step

  * whether progression is allowed

  * what context persists across threads

* The LLM is a constrained worker

  * proposes plans only during planning

  * executes one step at a time

  * produces evidence

  * self-reports completion status

* The LLM never decides progression

  * it may claim “criteria met”

  * the MCP alone advances the state machine

Invariant:

Progression is never granted by narrative confidence, explanation quality, or apparent correctness. Only gate evaluation permits advancement.

---

## **2\. Phase Separation (Hard Boundary)**

VibeDev operates in two strictly separated phases:

### **Planning Phase**

* exploratory, verbose, iterative

* allowed to ask questions

* allowed to revise goals, steps, criteria

* allowed to discover unknowns

* writes planning artifacts to /VibeDev/

### **Execution Phase**

* clean, narrow, deterministic

* no new requirements allowed

* no new steps allowed

* no architectural changes allowed

* only executes the compiled plan

Invariant:

Once execution begins, the plan is frozen. Any change requires an explicit plan-revision step that re-enters planning mode.

Agents must never blur these phases.

---

## **3\. Definition of a Step (Atomic Unit)**

A step is the smallest unit of progress.

A valid step must:

* have a single primary objective

* be executable in one clean thread

* have explicit acceptance criteria

* have a defined evidence schema

* resolve to PASS or FAIL unambiguously

If a step cannot meet these conditions, it must be split.

Invariant:

“Almost done,” “mostly works,” or “should be fine” are invalid states.

---

## **4\. Gates Are Binary**

Every step has one or more gates.

* Gates evaluate PASS or FAIL only

* No partial credit

* Missing evidence \= FAIL

* Contradictory evidence \= FAIL

* Ambiguous evidence \= FAIL

Invariant:

Progress is blocked by default. Advancement must be earned.

Gate implementations must err on rejection, not generosity.

---

## **5\. Evidence Is First-Class Data**

Evidence is not explanation.

Evidence must be:

* structured

* explicitly referenced

* persisted outside the model context

* tied to a specific step attempt

Examples:

* test output

* diff summaries

* file lists

* command logs

* boolean invariant checks

Invariant:

If evidence cannot be pointed to later, it does not exist.

---

## **6\. Append-Only History (No Silent Rewrites)**

VibeDev maintains an append-only operational history.

Rules:

* completed steps move from todo/ → done/

* receipts are append-only

* mistake entries are append-only

* reviews add amendments, not edits

Invariant:

The past may be commented on, but never rewritten.

This prevents retroactive justification or quiet correction.

---

## **7\. Failure Is a Valid Outcome**

Failure is expected and supported.

On step failure:

* the step remains active

* failure reason is recorded

* remediation prompt is used

* mistake entry may be recorded

Failure does not:

* advance state

* get hidden

* get overwritten

Invariant:

The system must learn from failure, not erase it.

---

## **8\. Context Discipline**

VibeDev assumes context windows are fragile.

Rules:

* only load context explicitly referenced by the step

* never load completed steps unless reviewing

* never load the entire repo by default

* never rely on memory across threads

Invariant:

Files are memory. Threads are disposable.

---

## **9\. Repo Hygiene Contract**

VibeDev is allowed to be verbose only inside /VibeDev/.

Rules:

* /VibeDev/ may contain large plans, receipts, logs

* main repo must remain minimal and intentional

* /VibeDev/ must be deletable without breaking the project

Invariant:

VibeDev must not permanently pollute the codebase.

---

## **10\. What the System Must Not Assume**

Agents must not assume:

* tests ran unless evidence shows it

* code correctness from inspection alone

* missing information can be guessed

* user wants speed over discipline

* confidence equals correctness

Invariant:

When information is missing, the system must stop and ask — during planning only.

---

## **11\. Escalation Rules**

If progress stalls due to:

* repeated step failure

* contradictory constraints

* missing external information

The MCP must:

* pause execution

* surface the blocking issue explicitly

* request human input

Invariant:

Silent looping is a failure mode.

---

## **12\. Success Condition for VibeDev**

VibeDev is working correctly if and only if:

* the LLM cannot skip steps

* the LLM cannot hand-wave completion

* the LLM cannot forget prior decisions

* the repo remains clean

* the entire process is auditable after completion

This is the standard agents must design toward.

---

