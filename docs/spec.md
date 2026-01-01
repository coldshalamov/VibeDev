# Legacy Spec (Historical)

> **Status:** Legacy / historical spec notes (pre-refactor).
>
> The canonical, “compiler-ready” specification now lives in:
> - `docs/00_overview.md` through `docs/07_doc_map.md`
>
> This file is preserved for background, rationale, and additional ideas. It may:
> - Use older terminology (e.g., “VibeOps MCP”) that should now be read as “VibeDev MCP”
> - Describe features that were later redesigned or implemented differently
>
> If something in this file contradicts the structured docs set, treat the structured docs as canonical and log a TODO to reconcile.

---
Document 1 — Concept + User Workflow (Planner → Clean Executor)
Name (working): 
VibeDev
 — a persistent “development process brain” for LLM coding
What it is
This is an MCP server whose main job is not to code, but to force high-quality coding behavior from whatever LLM you’re using (ChatGPT, Claude-in-IDE, Gemini, etc.). It acts like a “procedural supervisor” plus a “project memory” that lives outside the model’s context window.
The core insight is that LLMs often produce better results when they:
* break problems into explicit steps

* research before implementing

* keep a clean execution context (not polluted by messy brainstorming)

* run self-check loops (tests, lint, smoke checks, sanity checks)

* keep short diffs + frequent commits

* write logs and remember what failed so they don’t repeat it

But in practice, models don’t do this consistently because (a) the user doesn’t enforce discipline every time, (b) the context window gets noisy, and (c) “planning” and “doing” are mixed into one sloppy thread. VibeOps MCP separates these modes and enforces a standard process.
High-level behavior
VibeOps MCP has two primary modes, typically in two separate chats/threads:
Mode A — 
Planning Thread (messy sandbox)
In this thread, the LLM is allowed to be messy and expansive: it can brainstorm, run web searches, argue with itself, try approaches, record failures, and refine. The MCP’s job in this phase is to collect and distill the best version of the plan and the execution prompts into structured form, while forcing the model to answer key questions:
   * What exactly is being built?

   * What are the deliverables?

   * What does “done” mean (definition of done / completion criteria)?

   * What invariants must never be violated?

   * What are the major risks, unknowns, and test strategies?

   * What are the steps, and what is the output expected after each step?

   * What information must be gathered (repo structure, existing code constraints, dependencies)?

   * What should be avoided (prior failures, “don’t do that again” list)?

The MCP stores the results as a structured “job” object: not a reusable product feature, but a temporary, task-specific workflow that will be executed cleanly later.
At the end of planning mode, MCP returns a single identifier, e.g. JOB-7F2A.
Mode B — 
Execution Thread (clean runway)
In a new thread, the user provides only the job id (JOB-7F2A). The MCP then drip-feeds the LLM a clean series of prompts/steps that were developed during planning. The LLM executes each step, and the MCP uses a gating loop to decide whether to proceed to the next step, based on explicit criteria.
Because the execution thread is clean, it isn’t littered with:
      * half-baked ideas

      * contradictory plans

      * tool call noise

      * dead-end explorations

      * irrelevant research paragraphs

Instead, it’s a disciplined sequence: do Step 1 → verify Step 1 → do Step 2 → verify Step 2 → etc.
The “keep working” loop you want
The key feature is that the MCP can keep the model “in the loop” by refusing to advance until the criteria are met. This works even without a second LLM, relying on a structured self-evaluation handshake:
         1. MCP delivers Step N prompt, including:

            * required output artifacts

            * explicit check criteria (tests must pass, lint must be clean, etc.)

            * required logging (dev log line, commit message, etc.)

               2. LLM performs the step and responds with:

                  * what it changed

                  * where it changed it

                  * results (tests, outputs, diffs)

                  * a self-check claim: “criteria met / not met”

                     3. MCP asks a “progress checkpoint” question:

                        * “Does this satisfy criteria N exactly? If not, list what fails and fix it.”

                           4. If the model says “not met,” MCP does not advance. It returns a “repair prompt” and optionally supplies additional stored context.

                           5. Only when the model explicitly indicates criteria are met (and provides evidence where possible) does MCP advance to Step N+1.

This creates a persistent, enforced discipline loop. The LLM is never allowed to “hand-wave” completion and move on. The step gating is explicit.
Why the job id matters
The job id is not “reusability”; it’s a context reset mechanism. Planning creates a lot of valuable information but also pollutes the thread. The job id allows you to preserve the distilled plan while discarding the mess.
The job id is like a “compiled task,” derived from messy reasoning but executable cleanly later.
“Gemini Conductor vibe” without paying credits
You want something like a conductor that can:
                              * do an onboarding interview

                              * force high-level planning and architecture

                              * enforce “write a dev log,” “commit frequently,” “record failure lessons”

                              * keep the repo clean

                              * continuously maintain a structured map of the repo

VibeOps MCP provides the conductor behavior through tools and state, not through extra models.
What it stores
A job object typically stores:
                                 * Goal statement: what is being built

                                 * Deliverables: exact expected outputs

                                 * Repo baseline snapshot: file list, key modules, constraints

                                 * Invariants: non-negotiable truths and rules

                                 * Risk ledger: what can go wrong + mitigation steps

                                 * Prompt chain: step-by-step instructions for execution

                                 * Step criteria: what must be true before proceeding

                                 * Dev log requirements: what must be recorded per step

                                 * Mistake ledger: “don’t do that again” notes

                                 * Progress state: current step index, completion flags

“Bad ideas and failures” ledger
You described wanting the system to remember when things went sideways. This is important: LLMs repeat mistakes because they don’t persist episodic memory. VibeOps MCP explicitly captures:
                                    * what approach was tried

                                    * why it failed (error message, broken invariant, wrong assumption)

                                    * what was learned

                                    * what to do instead

                                    * tags (dependency issues, environment issues, test failures, wrong architectural direction)

During later steps, MCP can inject “failure warnings” to prevent repeating those patterns.
Repo anti-bloat behavior
You want the system to fight repo entropy: old planning files, stale modules, abandoned refactors, unused scripts, duplicated versions. VibeOps MCP can enforce periodic “repo hygiene” steps:
                                       * maintain a file index with short descriptions

                                       * track what imports what (approximate call graph)

                                       * identify dead files (never imported/executed)

                                       * mark “deprecated” and propose deletion candidates

                                       * enforce a “cleanup checkpoint” after certain milestones

It doesn’t have to delete automatically; it can propose a list, and the LLM must justify deletions.
Why this helps beginners specifically
If you “don’t really know how to code,” the hard part isn’t typing syntax—it’s:
                                          * selecting architecture

                                          * controlling scope

                                          * maintaining invariants

                                          * tracking what changed

                                          * debugging systematically

                                          * avoiding infinite refactor loops

                                          * remembering what not to do

                                          * keeping a coherent repo over time

VibeOps MCP acts like process scaffolding that an experienced engineer applies automatically. It makes the LLM behave like a disciplined engineer by turning good habits into enforced steps and required artifacts.
The user-facing experience (what you actually do)
A typical usage pattern:
                                             1. In Chat A:

                                                * “Initialize a new job for feature X.”

                                                * Answer MCP-driven onboarding questions.

                                                * Let the model research and refine.

                                                * MCP returns JOB-XXXX.

                                                   2. In Chat B:

                                                      * Paste JOB-XXXX.

                                                      * MCP provides Step 1 prompt.

                                                      * LLM executes.

                                                      * MCP gates progress.

                                                      * Continue until completion.

                                                         3. End:

                                                            * MCP produces a final deliverables summary

                                                            * dev log and commit list are attached

                                                            * mistake ledger updated

                                                            * job can be archived or deleted

This is the whole system: a persistent process brain that turns “vibe coding” into a reliable staged pipeline.
________________


Document 2 — Technical Architecture + MCP Capabilities (State Machine + Tools)
What it is (technical definition)
A single MCP server that exposes process primitives to an LLM: persistent storage, job state machines, step gating, and repo operations (logs, diffs, git integration optionally). The LLM remains the planner/executor, but the MCP controls when it is allowed to advance and what context is carried forward.
Core design principle
The MCP does not “solve the task.” It structures the task. It provides:
                                                               * persistent state across chats

                                                               * a deterministic step sequence (prompt chain)

                                                               * explicit success criteria per step

                                                               * logging and checkpoint enforcement

                                                               * optional repo introspection snapshots and hygiene routines

Data model
You can model a job as:
Job
                                                                  * id

                                                                  * status: PLANNING | READY | EXECUTING | PAUSED | COMPLETE | FAILED | ARCHIVED

                                                                  * created_at / updated_at

                                                                  * goal

                                                                  * deliverables[]

                                                                  * constraints/invariants[]

                                                                  * repo_context: snapshots of file structure, key notes

                                                                  * research_context: citations/notes gathered during planning

                                                                  * steps[]

                                                                  * current_step_index

                                                                  * step_history[] (attempts, outputs, failures, fixes)

                                                                  * logs[] (dev log entries, decision log entries)

                                                                  * mistakes[] (failure ledger)

                                                                  * hygiene[] (cleanup suggestions, stale file flags)

Step
                                                                     * step_id

                                                                     * title

                                                                     * instruction_prompt (the “do this” prompt injected during execution)

                                                                     * expected_outputs (files, commands, docs, tests)

                                                                     * acceptance_criteria (explicit checks)

                                                                     * required_evidence (tests run, output logs, diff summary)

                                                                     * remediation_prompt (used when criteria not met)

                                                                     * optional_context_refs (IDs to stored context blocks)

Attempt
                                                                        * attempt_id

                                                                        * step_id

                                                                        * timestamp

                                                                        * model_claim: met / not met

                                                                        * evidence_payload (strings, file lists, test output excerpts)

                                                                        * outcome: accepted / rejected

                                                                        * rejection_reason (if rejected)

                                                                        * followup_actions

Execution gating without a second LLM
Since you don’t want a second model, gating can be “honor system + structured evidence.” The MCP can still improve reliability by requiring structured evidence fields rather than freeform claims.
Example acceptance policy for a step could be expressed as:
                                                                           * Must include a diff summary of changed files

                                                                           * Must include “tests_run” list

                                                                           * Must include “tests_passed: true/false”

                                                                           * Must include “invariants_checked: true/false”

                                                                           * Must include a short dev log line

The MCP can reject a step if these fields are missing, even if it can’t fully verify correctness. This forces a disciplined reporting format and reduces bullshit.
Two-phase workflow (planning vs execution)
Planning is a loop that repeatedly writes and refines structured objects. Execution is a state machine driven by get_next_prompt() and submit_step_result().
Planning loop tools
                                                                              * job_create(goal, repo_hint?) -> job_id

                                                                              * job_add_context(job_id, block_type, content, tags)

                                                                              * job_add_constraints(job_id, invariants[])

                                                                              * job_add_deliverables(job_id, deliverables[])

                                                                              * job_propose_steps(job_id, steps_draft[])

                                                                              * job_refine_steps(job_id, edits)

                                                                              * job_set_ready(job_id) returns summary + id

Additionally, a “planning interview” function can drive onboarding:
                                                                                 * job_interview_next(job_id, last_answers?) -> questions[]

This allows the MCP to ask clarifying questions back. The LLM can call it repeatedly until enough info is gathered. The MCP stores answers in job context. The LLM uses answers to refine the step chain.

Execution loop tools
                                                                                    * job_start(job_id)

                                                                                    * job_next_step_prompt(job_id) -> step_prompt

                                                                                    * job_submit_step(job_id, step_id, result_payload) -> {accepted?, feedback, next_action}

                                                                                    * job_pause(job_id) / job_resume(job_id)

                                                                                    * job_complete(job_id)

                                                                                    * job_export(job_id) -> bundle (all prompts, logs, summaries)

Repo “process helpers” as tools
These can be local-only (no paid APIs) and can be implemented via filesystem operations and shell commands:
                                                                                       * repo_snapshot(job_id, path) -> file_index

                                                                                       * repo_describe_files(job_id, files[]) (store short descriptions)

                                                                                       * repo_find_stale(job_id) -> candidates (heuristic: old files, unused, duplicates)

                                                                                       * repo_hygiene_suggest(job_id) -> cleanup_plan

                                                                                       * repo_record_decision(job_id, decision_text)

                                                                                       * repo_record_failure(job_id, failure_text, tags)

Git enforcement tools (optional but central to your idea)
If you want “force git discipline,” you can include:
                                                                                          * git_status()

                                                                                          * git_diff_summary()

                                                                                          * git_commit(message)

                                                                                          * git_branch(name)

                                                                                          * git_tag(tag)

                                                                                          * git_log(n)

The MCP can require that each accepted step includes either:
                                                                                             * a commit hash, or

                                                                                             * a stated reason why commit is deferred (batch commits allowed)

A strict mode can refuse to accept step completion unless commit evidence is provided.
Dev log + mistake ledger enforcement
A core feature is that every step must produce a dev log line. The MCP can implement:
                                                                                                * devlog_append(job_id, line)

                                                                                                * devlog_export(job_id)

                                                                                                * mistake_append(job_id, lesson)

                                                                                                * mistake_list(job_id)

During execution, job_next_step_prompt can automatically include a “reminder block” containing relevant mistake ledger items (“do not repeat X”) based on tags.
The “conductor init” function (your Gemini Conductor vibe)
You described an init function that sets the overall flow and collects a large-scale plan. That can be:
                                                                                                   * conductor_init(goal, repo_path) -> job_id + first_questions

This tool does:
                                                                                                      * create job

                                                                                                      * take repo snapshot

                                                                                                      * ask structured onboarding questions

                                                                                                      * seed default best-practice policies

                                                                                                      * initialize logs and invariants templates

                                                                                                      * return job id

The LLM then continues planning through repeated calls.
Preventing repo bloat by maintaining a living repo map
Add a persistent “Repo Map” object:
RepoMap
                                                                                                         * files: { path -> description, role, owner_module }

                                                                                                         * dependencies: approximate import graph

                                                                                                         * entrypoints: scripts/commands

                                                                                                         * deprecated_candidates: list + reasons

                                                                                                         * conventions: style rules, naming, folder structure

Tools:
                                                                                                            * repomap_update(job_id)

                                                                                                            * repomap_query(job_id, question)

                                                                                                            * repomap_export(job_id)

This gives the model a stable reference so it doesn’t have to re-rediscover architecture each session.
Typical minimal implementation stack (local, free)
                                                                                                               * Python MCP server

                                                                                                               * SQLite or JSON files for persistence

                                                                                                               * Optional: ripgrep / tree / git CLI

                                                                                                               * Optional: simple dependency graph heuristic via parsing imports

                                                                                                               * Optional: lint/test runners via subprocess

No paid APIs required.
Why this works as MCP specifically
Because MCP provides the interface for:
                                                                                                                  * persistent storage and retrieval

                                                                                                                  * tool calls that can enforce structure

                                                                                                                  * cross-thread continuity via job id

                                                                                                                  * deterministic “next step” gating

MCP is the right shape for a “stateful supervisor” because it can own the state machine. The LLM cannot reliably own state across threads; the MCP can.
________________


Document 3 — Operational Protocol (Best-Practice Loops + Invariants + Self-Checks)
What the MCP forces the model to do (behavior contract)
This system is fundamentally a behavior enforcement layer. It turns “vibe coding” from chaotic improvisation into a repeatable protocol.
The MCP’s rules are mostly about:
                                                                                                                     * separating planning and execution

                                                                                                                     * forcing explicit definitions of done

                                                                                                                     * forcing evidence-based progress

                                                                                                                     * forcing small controlled changes

                                                                                                                     * forcing reflection and logging

                                                                                                                     * recording failures as durable lessons

                                                                                                                     * maintaining repo hygiene over time

The planning protocol (Thread A)
Planning is not “one prompt.” It’s a structured, iterative onboarding pipeline. The MCP can drive it with a fixed checklist.
Planning stage 1 — Problem definition
Required outputs:
                                                                                                                        * a single-sentence goal

                                                                                                                        * a scope boundary (“in scope / out of scope”)

                                                                                                                        * deliverables list

                                                                                                                        * dependencies and constraints

                                                                                                                        * known unknowns

MCP prompts the model to ask for missing information. Examples:
                                                                                                                           * what environment is assumed?

                                                                                                                           * what file(s) currently exist?

                                                                                                                           * what should not change?

                                                                                                                           * what “correctness” looks like: tests, outputs, UI behavior, performance

Planning stage 2 — Architecture sketch
Required outputs:
                                                                                                                              * recommended structure (modules, folders, entrypoints)

                                                                                                                              * minimal viable path to completion

                                                                                                                              * failure modes and mitigations

                                                                                                                              * adoption of conventions (logging, error handling, style)

MCP stores architecture notes and triggers a “fault-finding loop”:
                                                                                                                                 * “List 10 ways this plan can fail.”

                                                                                                                                 * “Where are the hidden dependencies?”

                                                                                                                                 * “What is the smallest demo that proves correctness?”

                                                                                                                                 * “What would you regret not deciding up front?”

Planning stage 3 — Prompt chain compilation
The system converts the plan into steps where each step has:
                                                                                                                                    * an instruction prompt

                                                                                                                                    * acceptance criteria

                                                                                                                                    * evidence required

                                                                                                                                    * remediation prompt

Example shape of a compiled step:
                                                                                                                                       * Step 1: “Scan repo and produce repo map + invariants list”

Criteria: repo map created, invariants stored

                                                                                                                                       * Step 2: “Implement feature X behind flag; add unit tests”

Criteria: tests pass, diff limited, logs updated

                                                                                                                                       * Step 3: “Refactor; remove flag; document usage”

Criteria: docs updated, cleanup complete, commit tagged

Planning stage 4 — Ready gate
Before a job can move to execution mode, MCP requires:
                                                                                                                                          * deliverables list exists

                                                                                                                                          * step chain exists

                                                                                                                                          * acceptance criteria exist for each step

                                                                                                                                          * invariants exist

                                                                                                                                          * dev log policy exists

                                                                                                                                          * “don’t do that again” ledger initialized

                                                                                                                                          * repo baseline snapshot stored

Only then does MCP return the job id as “ready.”
The execution protocol (Thread B)
Execution is intentionally “clean.” Each step is delivered one at a time, and the MCP enforces a strict handshake.
Step handshake
For each step:
                                                                                                                                             1. MCP provides:

                                                                                                                                                * Step instruction prompt

                                                                                                                                                * Constraints reminder

                                                                                                                                                * Required evidence list

                                                                                                                                                * Logging requirements

                                                                                                                                                * Prior mistakes relevant to this step

                                                                                                                                                   2. LLM does work and returns a structured report containing:

                                                                                                                                                      * files changed

                                                                                                                                                      * summary of edits

                                                                                                                                                      * commands run

                                                                                                                                                      * outputs observed

                                                                                                                                                      * tests run + result

                                                                                                                                                      * invariant checks claimed

                                                                                                                                                      * dev log line

                                                                                                                                                      * commit evidence (if required)

                                                                                                                                                         3. MCP validates the report format and gating conditions. If missing, it rejects and asks for corrections. If present, it asks the model to self-evaluate directly against criteria.

                                                                                                                                                         4. If not met, MCP returns a remediation prompt that:

                                                                                                                                                            * restates criteria

                                                                                                                                                            * highlights missing evidence

                                                                                                                                                            * recommends narrowing changes

                                                                                                                                                            * optionally injects stored context blocks

                                                                                                                                                            * requires a new attempt report

                                                                                                                                                               5. MCP only advances when the step is accepted.

This loop can run indefinitely. MCP keeps state.
Invariants (your “truths” the model must not violate)
You described “invariant truths you establish.” The system should treat invariants as a first-class object with hard enforcement.
Examples:
                                                                                                                                                                  * “Do not overwrite entire files; only patch changes.”

                                                                                                                                                                  * “Never change public API signatures without updating docs/tests.”

                                                                                                                                                                  * “Do not introduce new dependencies without explicit approval.”

                                                                                                                                                                  * “Keep changes minimal per step.”

                                                                                                                                                                  * “Always add tests for bug fixes.”

                                                                                                                                                                  * “Prefer deterministic behavior, no hidden randomness.”

                                                                                                                                                                  * “If uncertain, ask questions during planning mode; do not guess.”

During execution, MCP injects invariants into each step prompt and requires the LLM to explicitly report whether it upheld them.
Dev log policy
You want a forced “dev log” of brief summaries of edits. That can be:
                                                                                                                                                                     * one line per step

                                                                                                                                                                     * appended to DEVLOG.md or a job-specific log

                                                                                                                                                                     * includes timestamp, step id, summary, tests run, commit hash

MCP can enforce that a dev log line is provided in the attempt report and saved persistently.
Mistake ledger policy
You want durable memory of “don’t do that again.” This should be collected automatically by the MCP whenever:
                                                                                                                                                                        * a step is rejected

                                                                                                                                                                        * a test fails

                                                                                                                                                                        * a refactor produces regressions

                                                                                                                                                                        * an approach is abandoned

Each mistake entry has:
                                                                                                                                                                           * what happened

                                                                                                                                                                           * why it happened

                                                                                                                                                                           * what to do next time

                                                                                                                                                                           * tags (dependency, tests, architecture, environment, tool misuse)

During later steps, MCP surfaces relevant mistakes.
Checkpoints and self-evaluation loops
You want the system to continually ask the model to evaluate progress and quality. Add explicit checkpoint steps such as:
                                                                                                                                                                              * “Checkpoint: verify repo map still accurate”

                                                                                                                                                                              * “Checkpoint: run full test suite and summarize”

                                                                                                                                                                              * “Checkpoint: review design against invariants”

                                                                                                                                                                              * “Checkpoint: confirm deliverables are met”

                                                                                                                                                                              * “Checkpoint: identify cleanup candidates”

The MCP can insert checkpoint steps automatically after N steps or after certain “high-risk” operations (dependency changes, refactor, new modules).
Repo hygiene protocol
The system can periodically require:
                                                                                                                                                                                 * file descriptions for new files

                                                                                                                                                                                 * identification of unused files

                                                                                                                                                                                 * identification of duplicate scripts

                                                                                                                                                                                 * marking deprecated code paths

                                                                                                                                                                                 * minimizing “planning junk” in repo

                                                                                                                                                                                 * keeping docs close to code

A hygiene cycle might produce:
                                                                                                                                                                                    * REPO_MAP.md updated

                                                                                                                                                                                    * DEPRECATED.md updated

                                                                                                                                                                                    * a list of deletion candidates with justification

You can enforce that deletion only happens after review or after a dedicated “cleanup step.”
“Learning best practices” without paying APIs
You proposed having LLMs research vibe coding best practices and incorporate them. The MCP can store “process patterns” over time:
                                                                                                                                                                                       * process templates (step chains for common tasks)

                                                                                                                                                                                       * checklists (pre-merge checklist, debug checklist)

                                                                                                                                                                                       * conventions (commit message style, file naming)

                                                                                                                                                                                       * guardrails (don’t refactor while debugging, etc.)

Even if you don’t want workflows to be reusable per task, you can reuse process scaffolds—lightweight templates that improve planning quality.
How the system prevents context-window failure modes
This system addresses the major failure modes of LLM coding:
                                                                                                                                                                                          1. Context pollution

Planning is messy. Execution is clean. The id bridges them.

                                                                                                                                                                                          2. Scope creep

Deliverables and acceptance criteria are explicit; MCP refuses progress without them.

                                                                                                                                                                                          3. Vague success

Each step has criteria; the LLM must prove or admit failure.

                                                                                                                                                                                          4. Non-versioned chaos

Git discipline and logs turn changes into auditable increments.

                                                                                                                                                                                          5. Repeating mistakes

Mistake ledger is injected back into the loop.

                                                                                                                                                                                          6. Repo entropy

Repo map + hygiene routines keep the codebase navigable.

Minimal viable first version (what Codex would build first)
If you want a clean MVP scope, the smallest “useful” version is:
                                                                                                                                                                                             * persistent job store

                                                                                                                                                                                             * planning interview loop

                                                                                                                                                                                             * step chain storage

                                                                                                                                                                                             * execution step gating

                                                                                                                                                                                             * dev log enforcement

                                                                                                                                                                                             * mistake ledger

                                                                                                                                                                                             * repo snapshot and file listing

Then later:
                                                                                                                                                                                                * git enforcement

                                                                                                                                                                                                * repo map and dependency graph heuristics

                                                                                                                                                                                                * cleanup suggestions

                                                                                                                                                                                                * automatic checkpoint insertion

This MVP already achieves your main goal: LLMs that behave like disciplined engineers and can continue a complex task across threads with a clean runway.




Document 4 — 
Codex-Ready Implementation Spec (Tool Contracts, Schemas, State Machine, Responses)
Working name: 
VibeOps MCP
 (Persistent Prompt-Chain Conductor + Dev Process Enforcer)
Objective
Implement an MCP server that enables a single LLM to run a long, structured planning loop in one thread, store the distilled results (plan + prompt chain + criteria + invariants + repo snapshots + process logs), then later execute the plan in a clean thread by pasting an id. The MCP enforces a gating protocol so the LLM cannot advance to the next step until required evidence and self-evaluation criteria have been produced.
Non-goals
                                                                                                                                                                                                   * No “reusable automation marketplace” required. A job can be disposable.

                                                                                                                                                                                                   * No second LLM required for validation. The system relies on structured evidence and self-evaluation.

                                                                                                                                                                                                   * No requirement to run external paid APIs. Everything is local or uses free tools already present.

________________


High-Level Model
The MCP server is a stateful service with persistent storage (SQLite preferred; JSON is acceptable). It manages Jobs. Each Job contains Steps and a State Machine. The MCP exposes tools (functions) that the LLM calls.
Key idea: “Compiled Prompt Chain”
Planning produces a “compiled chain” of prompts: each step includes (a) the actual instruction prompt for the model, (b) acceptance criteria, (c) required evidence fields, (d) remediation prompt, (e) optional context refs.
Execution returns only the next step prompt and refuses advancement unless submission includes required evidence + explicit criteria check.
________________


Data Storage
Recommended persistence
                                                                                                                                                                                                      * SQLite database with tables: jobs, steps, attempts, context_blocks, logs, mistakes, repo_snapshots, repo_map, policies.

                                                                                                                                                                                                      * Alternate: a folder per job with JSON files (job.json, steps.json, attempts.jsonl, etc.).

Identifiers
                                                                                                                                                                                                         * job_id: short string, e.g. JOB-7F2A (base32 or base36).

                                                                                                                                                                                                         * step_id: S1, S2, etc. or UUID.

                                                                                                                                                                                                         * context_id: CTX-...

                                                                                                                                                                                                         * attempt_id: ATT-...

________________


Core Entities (Schema Definitions)
Job
Fields (conceptual; store as columns or JSON):
                                                                                                                                                                                                            * job_id (string, unique)

                                                                                                                                                                                                            * title (string)

                                                                                                                                                                                                            * goal (string)

                                                                                                                                                                                                            * status (enum: PLANNING, READY, EXECUTING, PAUSED, COMPLETE, FAILED, ARCHIVED)

                                                                                                                                                                                                            * created_at, updated_at (timestamps)

                                                                                                                                                                                                            * deliverables (array of strings)

                                                                                                                                                                                                            * invariants (array of strings) — “must never violate”

                                                                                                                                                                                                            * constraints (array of strings) — “must follow”

                                                                                                                                                                                                            * assumptions (array of strings)

                                                                                                                                                                                                            * definition_of_done (array of strings)

                                                                                                                                                                                                            * repo_root (string path, optional)

                                                                                                                                                                                                            * current_step_index (int)

                                                                                                                                                                                                            * step_order (array of step_ids)

                                                                                                                                                                                                            * policies (object) — toggles for strictness (git, logs, evidence)

                                                                                                                                                                                                            * tags (array of strings)

Step
                                                                                                                                                                                                               * job_id

                                                                                                                                                                                                               * step_id

                                                                                                                                                                                                               * title

                                                                                                                                                                                                               * instruction_prompt (string)

                                                                                                                                                                                                               * acceptance_criteria (array of strings)

                                                                                                                                                                                                               * required_evidence (object schema keys)

                                                                                                                                                                                                               * remediation_prompt (string)

                                                                                                                                                                                                               * context_refs (array of context_ids)

                                                                                                                                                                                                               * checkpoint (bool) — if it’s a forced review step

                                                                                                                                                                                                               * strict_git (bool) — if commit required on completion

                                                                                                                                                                                                               * max_attempts (int, optional; default unlimited)

                                                                                                                                                                                                               * status (enum: PENDING, ACTIVE, DONE)

Attempt (a submission for a step)
                                                                                                                                                                                                                  * attempt_id

                                                                                                                                                                                                                  * job_id

                                                                                                                                                                                                                  * step_id

                                                                                                                                                                                                                  * timestamp

                                                                                                                                                                                                                  * model_claim (enum: MET, NOT_MET, PARTIAL)

                                                                                                                                                                                                                  * evidence (object) — keys per required_evidence

                                                                                                                                                                                                                  * summary (string) — brief “what I did”

                                                                                                                                                                                                                  * accepted (bool)

                                                                                                                                                                                                                  * feedback (string) — MCP response

                                                                                                                                                                                                                  * rejection_reasons (array of strings)

ContextBlock
                                                                                                                                                                                                                     * context_id

                                                                                                                                                                                                                     * job_id

                                                                                                                                                                                                                     * block_type (enum: RESEARCH, NOTES, PLAN, REPO_MAP, DECISION, CONSTRAINTS, SNIPPET, OUTPUT)

                                                                                                                                                                                                                     * content (string; can be large)

                                                                                                                                                                                                                     * tags (array)

                                                                                                                                                                                                                     * created_at

LogEntry
                                                                                                                                                                                                                        * log_id

                                                                                                                                                                                                                        * job_id

                                                                                                                                                                                                                        * log_type (enum: DEVLOG, DECISION, POSTMORTEM, CHECKPOINT, SYSTEM)

                                                                                                                                                                                                                        * content

                                                                                                                                                                                                                        * created_at

                                                                                                                                                                                                                        * step_id (optional)

                                                                                                                                                                                                                        * commit_hash (optional)

MistakeEntry
                                                                                                                                                                                                                           * mistake_id

                                                                                                                                                                                                                           * job_id

                                                                                                                                                                                                                           * title (string)

                                                                                                                                                                                                                           * what_happened (string)

                                                                                                                                                                                                                           * why (string)

                                                                                                                                                                                                                           * lesson (string)

                                                                                                                                                                                                                           * avoid_next_time (string)

                                                                                                                                                                                                                           * tags (array)

                                                                                                                                                                                                                           * created_at

                                                                                                                                                                                                                           * related_step_id (optional)

RepoSnapshot (optional, local-only)
                                                                                                                                                                                                                              * snapshot_id

                                                                                                                                                                                                                              * job_id

                                                                                                                                                                                                                              * timestamp

                                                                                                                                                                                                                              * file_tree (string or JSON)

                                                                                                                                                                                                                              * key_files (array)

                                                                                                                                                                                                                              * notes (string)

RepoMap (optional)
                                                                                                                                                                                                                                 * job_id

                                                                                                                                                                                                                                 * entries (array of {path, purpose, called_by?, calls?, status})

                                                                                                                                                                                                                                 * updated_at

________________


Tool Contract (MCP Functions)
1) Initialization / Conductor
conductor_init
Input:
                                                                                                                                                                                                                                    * title (string)

                                                                                                                                                                                                                                    * goal (string)

                                                                                                                                                                                                                                    * repo_root (string, optional)

                                                                                                                                                                                                                                    * policies (object, optional)

Output:
                                                                                                                                                                                                                                       * job_id

                                                                                                                                                                                                                                       * status

                                                                                                                                                                                                                                       * next_questions (array of strings) — onboarding interview questions

                                                                                                                                                                                                                                       * instructions (string) — how to proceed (LLM should answer then call conductor_answer)

Behavior:
Creates a job in PLANNING. Seeds default policies. Optionally takes initial repo snapshot if repo_root provided.
________________


2) Planning Interview Loop
conductor_next_questions
Input: job_id, last_answers (optional object)
Output: list of next questions + rationale + required fields
conductor_answer
Input: job_id, answers (object)
Output: ack, plus optional follow-up questions
Behavior:
This tool pair is how the MCP “asks questions back.” The MCP maintains an internal planning checklist, and returns new questions until required info is collected: deliverables, invariants, constraints, baseline repo info, definition of done, etc.
________________


3) Context & Notes Storage
context_add_block
Input: job_id, block_type, content, tags[]
Output: context_id
context_get_block
Input: job_id, context_id
Output: block
context_search
Input: job_id, query
Output: matching blocks (ids + excerpts)
________________


4) Plan Compilation
plan_set_deliverables
Input: job_id, deliverables[]
Output: ack
plan_set_invariants
Input: job_id, invariants[]
Output: ack
plan_set_definition_of_done
Input: job_id, definition_of_done[]
Output: ack
plan_propose_steps
Input: job_id, steps[] (each includes title, instruction_prompt, criteria, required_evidence, remediation_prompt, context_refs)
Output: ack + normalized step list + warnings for missing fields
plan_refine_steps
Input: job_id, patch (structured edits)
Output: updated steps summary
job_set_ready
Input: job_id
Output: job_summary + job_id
Behavior:
job_set_ready refuses unless minimum planning artifacts exist.
Minimum planning artifacts required:
                                                                                                                                                                                                                                          * goal present

                                                                                                                                                                                                                                          * deliverables non-empty

                                                                                                                                                                                                                                          * invariants present (or explicit empty)

                                                                                                                                                                                                                                          * definition of done present

                                                                                                                                                                                                                                          * at least 1 step exists

                                                                                                                                                                                                                                          * each step has instruction_prompt + acceptance_criteria + required_evidence keys defined

                                                                                                                                                                                                                                          * policies seeded

________________


5) Execution (Clean Thread)
job_start
Input: job_id
Output: current step summary + “call job_next_step_prompt”
job_next_step_prompt
Input: job_id
Output:
                                                                                                                                                                                                                                             * step_id

                                                                                                                                                                                                                                             * prompt (string) — instruction + reminders + required evidence format

                                                                                                                                                                                                                                             * acceptance_criteria

                                                                                                                                                                                                                                             * required_evidence_schema

                                                                                                                                                                                                                                             * relevant_mistakes (optional excerpts)

                                                                                                                                                                                                                                             * invariants (injected)

Behavior:
Sets job status to EXECUTING if READY. Marks current step ACTIVE. Returns prompt only for the current step.
________________


6) Submission / Gating
job_submit_step_result
Input:
                                                                                                                                                                                                                                                * job_id

                                                                                                                                                                                                                                                * step_id

                                                                                                                                                                                                                                                * model_claim (MET/NOT_MET/PARTIAL)

                                                                                                                                                                                                                                                * summary

                                                                                                                                                                                                                                                * evidence (object)

                                                                                                                                                                                                                                                * devlog_line (string, optional but may be required)

                                                                                                                                                                                                                                                * commit_hash (string, optional but may be required)

Output:
                                                                                                                                                                                                                                                   * accepted (bool)

                                                                                                                                                                                                                                                   * feedback (string)

                                                                                                                                                                                                                                                   * next_action (enum: RETRY, NEXT_STEP_AVAILABLE, JOB_COMPLETE)

                                                                                                                                                                                                                                                   * missing_fields (array)

                                                                                                                                                                                                                                                   * rejection_reasons (array)

Acceptance logic (no second model):
                                                                                                                                                                                                                                                      * Reject if required evidence keys missing.

                                                                                                                                                                                                                                                      * Reject if devlog missing when policy requires.

                                                                                                                                                                                                                                                      * Reject if commit hash missing when strict_git for step or job policy.

                                                                                                                                                                                                                                                      * Otherwise: ask model for a self-check in the tool feedback text (the model will read it), e.g.

“If any criterion is not satisfied, set model_claim NOT_MET and resubmit with fixes.”

But since the submission already came, MCP can do a “soft accept” only if the model’s claim is MET and evidence is present.

Optionally require: criteria_checklist boolean map in evidence to force explicit criterion-level assertion.

Advancement:
If accepted, mark step DONE, increment index, record attempt accepted, append devlog, update mistakes if failure occurred. If last step, set job COMPLETE.
________________


7) Logging & Failure Ledger
devlog_append
Input: job_id, content, optional step_id, commit_hash
Output: ack
mistake_record
Input: job_id, title, what_happened, why, lesson, avoid_next_time, tags
Output: ack
mistake_list
Input: job_id, optional filter
Output: list
________________


8) Repo Helpers (optional, local)
repo_snapshot
Input: job_id, repo_root
Output: snapshot id + file tree excerpt
repo_file_descriptions_update
Input: job_id, {path: description}
Output: ack
repo_find_stale_candidates
Input: job_id
Output: list of candidates with heuristic reasons (old, unused, duplicate)
repo_map_export
Input: job_id
Output: markdown or JSON repo map
________________


9) Export / Archive
job_export_bundle
Input: job_id, format (json, md, zip_manifest)
Output: large text bundle or reference pointer
job_archive
Input: job_id
Output: ack
________________


Policies (Strictness Toggles)
Default recommended policies object:
                                                                                                                                                                                                                                                         * require_devlog_per_step (bool)

                                                                                                                                                                                                                                                         * require_commit_per_step (bool)

                                                                                                                                                                                                                                                         * allow_batch_commits (bool)

                                                                                                                                                                                                                                                         * require_tests_evidence (bool)

                                                                                                                                                                                                                                                         * require_diff_summary (bool)

                                                                                                                                                                                                                                                         * require_repo_snapshot_on_init (bool)

                                                                                                                                                                                                                                                         * inject_invariants_every_step (bool)

                                                                                                                                                                                                                                                         * inject_mistakes_every_step (bool)

                                                                                                                                                                                                                                                         * evidence_schema_mode (loose | strict)

________________


Step Evidence Schema (example)
A step may define required evidence keys like:
                                                                                                                                                                                                                                                            * changed_files (array of strings)

                                                                                                                                                                                                                                                            * diff_summary (string)

                                                                                                                                                                                                                                                            * commands_run (array)

                                                                                                                                                                                                                                                            * tests_run (array)

                                                                                                                                                                                                                                                            * tests_passed (bool)

                                                                                                                                                                                                                                                            * lint_run (bool)

                                                                                                                                                                                                                                                            * lint_passed (bool)

                                                                                                                                                                                                                                                            * artifacts_created (array)

                                                                                                                                                                                                                                                            * criteria_checklist (object of {criterion_index: bool})

The MCP should store the schema per step and validate that evidence includes required keys.
________________


State Machine Summary
                                                                                                                                                                                                                                                               * PLANNING: collecting context, steps, criteria

                                                                                                                                                                                                                                                               * READY: compiled chain exists, can be executed

                                                                                                                                                                                                                                                               * EXECUTING: step gating loop running

                                                                                                                                                                                                                                                               * PAUSED: manual pause

                                                                                                                                                                                                                                                               * COMPLETE: all steps accepted

                                                                                                                                                                                                                                                               * FAILED: explicit failure state (optional)

                                                                                                                                                                                                                                                               * ARCHIVED: job stored but not active

Transitions:
                                                                                                                                                                                                                                                                  * PLANNING → READY via job_set_ready

                                                                                                                                                                                                                                                                  * READY → EXECUTING via job_start

                                                                                                                                                                                                                                                                  * EXECUTING → COMPLETE when last step accepted

                                                                                                                                                                                                                                                                  * EXECUTING → PAUSED via job_pause

                                                                                                                                                                                                                                                                  * PAUSED → EXECUTING via job_resume

________________


Minimal MVP Tool Set (to ship first)
If you want a compact first release:
                                                                                                                                                                                                                                                                     * conductor_init

                                                                                                                                                                                                                                                                     * conductor_next_questions / conductor_answer

                                                                                                                                                                                                                                                                     * context_add_block / context_get_block

                                                                                                                                                                                                                                                                     * plan_set_deliverables, plan_set_invariants, plan_set_definition_of_done

                                                                                                                                                                                                                                                                     * plan_propose_steps

                                                                                                                                                                                                                                                                     * job_set_ready

                                                                                                                                                                                                                                                                     * job_start, job_next_step_prompt, job_submit_step_result

                                                                                                                                                                                                                                                                     * devlog_append, mistake_record, mistake_list

                                                                                                                                                                                                                                                                     * job_export_bundle

Everything else can be layered later.
________________


Document 5 — 
Prompting Protocol (Planner Mode, Executor Mode, Self-Check Loops, Evidence Discipline)
Goal
Define how the MCP shapes LLM behavior using prompts and structured required outputs. This document describes the “behavioral contract” between the MCP and the model. Codex can implement it as static prompt templates plus policy-driven injection blocks.
________________


Two Roles (same model, different mode)
You want the same LLM to behave like two different minds:
                                                                                                                                                                                                                                                                        1. Planner (messy but disciplined)

                                                                                                                                                                                                                                                                        2. Executor (clean, stepwise, evidence-based)

MCP enforces the role via the tool prompts it returns.
________________


Planner Mode Template (Thread A)
Planner Prime Directive
Planner must do the following before allowing job readiness:
                                                                                                                                                                                                                                                                           * extract invariants and hard constraints

                                                                                                                                                                                                                                                                           * define deliverables + definition of done

                                                                                                                                                                                                                                                                           * choose a minimal path to completion

                                                                                                                                                                                                                                                                           * enumerate risks and failure modes

                                                                                                                                                                                                                                                                           * compile steps with acceptance criteria & evidence requirements

                                                                                                                                                                                                                                                                           * build remediation prompts for likely failures

                                                                                                                                                                                                                                                                           * keep a “bad ideas / errors” ledger

                                                                                                                                                                                                                                                                           * take repo snapshot if a repo exists

Planner is allowed to be verbose and exploratory, but must continuously distill outcomes into stored artifacts.
The Planning Interview Loop
The MCP provides question sets in phases. The LLM responds, then stores results using MCP tools.
Phase 1: Intent & Scope
Ask for:
                                                                                                                                                                                                                                                                              * single-sentence goal

                                                                                                                                                                                                                                                                              * what is explicitly out of scope

                                                                                                                                                                                                                                                                              * user’s current ability/constraints (“I don’t know how to code; I need guardrails”)

                                                                                                                                                                                                                                                                              * target environment (OS, runtime, language, repo exists or not)

                                                                                                                                                                                                                                                                              * timeline/priority (MVP vs robust)

Phase 2: Deliverables
Ask for:
                                                                                                                                                                                                                                                                                 * exact outputs: files, endpoints, UI, docs, scripts

                                                                                                                                                                                                                                                                                 * what “done” looks like

                                                                                                                                                                                                                                                                                 * what tests are expected

Phase 3: Invariants
Ask for:
                                                                                                                                                                                                                                                                                    * “must never break” truths

                                                                                                                                                                                                                                                                                    * style conventions

                                                                                                                                                                                                                                                                                    * constraints like “patches only; no full file overwrites”

                                                                                                                                                                                                                                                                                    * dependency constraints

Phase 4: Repo Context
Ask for:
                                                                                                                                                                                                                                                                                       * repo root path

                                                                                                                                                                                                                                                                                       * key files

                                                                                                                                                                                                                                                                                       * known modules and entrypoints

If available, call repo_snapshot and store a REPO_MAP block.

Phase 5: Plan Compilation
The LLM must create step objects. Each step must be small enough that success can be evidenced.
________________


Step Design Rules (for the Planner)
To stop vibe-coding chaos, the planner must compile steps that are:
                                                                                                                                                                                                                                                                                          * atomic: one main objective per step

                                                                                                                                                                                                                                                                                          * verifiable: criteria can be stated clearly

                                                                                                                                                                                                                                                                                          * evidence-driven: required evidence fields are explicit

                                                                                                                                                                                                                                                                                          * repairable: remediation prompt exists for likely failure

Example: Step format (human-readable)
Step title: “Add X feature behind a flag”
Instruction prompt: “Implement feature X behind flag Y. Touch only files A/B/C. Add tests. Update docs.”
Acceptance criteria:
                                                                                                                                                                                                                                                                                             * tests pass

                                                                                                                                                                                                                                                                                             * docs updated

                                                                                                                                                                                                                                                                                             * no invariant violations

Evidence required:

                                                                                                                                                                                                                                                                                             * changed_files list

                                                                                                                                                                                                                                                                                             * diff summary

                                                                                                                                                                                                                                                                                             * tests_run list and results

                                                                                                                                                                                                                                                                                             * devlog line

                                                                                                                                                                                                                                                                                             * commit hash (if policy)

Remediation prompt:
                                                                                                                                                                                                                                                                                                * “If tests fail, revert unrelated changes, isolate failing tests, fix minimal patch, rerun tests, update devlog.”

________________


Executor Mode Template (Thread B)
Executor Prime Directive
Executor must:
                                                                                                                                                                                                                                                                                                   * perform only the current step

                                                                                                                                                                                                                                                                                                   * produce evidence in required schema

                                                                                                                                                                                                                                                                                                   * explicitly self-check against acceptance criteria

                                                                                                                                                                                                                                                                                                   * refuse to proceed if criteria not met

                                                                                                                                                                                                                                                                                                   * update dev log

                                                                                                                                                                                                                                                                                                   * record mistakes when failure occurs

                                                                                                                                                                                                                                                                                                   * keep changes minimal and controlled

                                                                                                                                                                                                                                                                                                   * run checkpoints when instructed

MCP enforces this by including a required response format in every step prompt.
Step Prompt Construction (MCP output)
The job_next_step_prompt should include sections in this order:
                                                                                                                                                                                                                                                                                                      1. Step Objective (one paragraph)

                                                                                                                                                                                                                                                                                                      2. Non-Negotiable Invariants (bulleted)

                                                                                                                                                                                                                                                                                                      3. What to Produce (deliverable within the step)

                                                                                                                                                                                                                                                                                                      4. Acceptance Criteria (bulleted)

                                                                                                                                                                                                                                                                                                      5. Required Evidence Format (a JSON-like template the model must fill)

                                                                                                                                                                                                                                                                                                      6. Reminder of Relevant Mistakes (optional injections)

                                                                                                                                                                                                                                                                                                      7. If Stuck (remediation strategy)

________________


Required Evidence Response Format (critical)
To avoid hand-waving, every step completion must be submitted with a standardized payload. The MCP can require the model to paste a JSON object in its assistant message and then call job_submit_step_result with it.
Recommended evidence payload template:
{
  "changed_files": ["..."],
  "diff_summary": "…",
  "commands_run": ["…"],
  "tests_run": ["…"],
  "tests_passed": true,
  "lint_run": false,
  "lint_passed": null,
  "artifacts_created": ["…"],
  "criteria_checklist": {
    "c1": true,
    "c2": true,
    "c3": true
  },
  "notes": "…"
}
Even if the MCP cannot verify tests truly ran, this structure forces accountability and makes it harder for the model to “forget” essentials.
________________


The Self-Evaluation Loop (no second LLM)
Since you’re not using a validator model, the MCP must induce honest self-evaluation by:
                                                                                                                                                                                                                                                                                                         * making the model explicitly mark each criterion true/false

                                                                                                                                                                                                                                                                                                         * refusing advancement if any criterion false

                                                                                                                                                                                                                                                                                                         * reminding the model that advancement requires honesty

                                                                                                                                                                                                                                                                                                         * logging failures and their causes

Example self-check injection text (inside MCP prompt)
“Before submitting: set criteria_checklist entries. If any are false, do not claim MET. Instead, fix and retry.”
________________


Recording “Bad Ideas” and Errors
When a step fails or is rejected, the MCP should instruct the model to produce a MistakeEntry:
                                                                                                                                                                                                                                                                                                            * what happened

                                                                                                                                                                                                                                                                                                            * why it happened

                                                                                                                                                                                                                                                                                                            * what to do next time

                                                                                                                                                                                                                                                                                                            * what to avoid next time

This can be forced by policy: “On any NOT_MET submission, also call mistake_record.”
________________


Checkpoint Steps
The planner can include checkpoint steps such as:
                                                                                                                                                                                                                                                                                                               * “Run full tests and summarize; update devlog”

                                                                                                                                                                                                                                                                                                               * “Update repo map; list stale candidates; propose cleanup plan”

Checkpoint steps are used to keep long tasks from drifting.
________________


“Repo Bloat Avoidance” Prompts
The MCP can periodically inject a hygiene prompt:
                                                                                                                                                                                                                                                                                                                  * list new files created since last snapshot

                                                                                                                                                                                                                                                                                                                  * require each file to have a one-line description stored in repo map

                                                                                                                                                                                                                                                                                                                  * propose deletions only after justification

________________


A Minimal “Don’t Know How to Code” Safety Rail
Without moralizing, the system should enforce:
                                                                                                                                                                                                                                                                                                                     * small edits

                                                                                                                                                                                                                                                                                                                     * patch-only approach

                                                                                                                                                                                                                                                                                                                     * mandatory summary of changes

                                                                                                                                                                                                                                                                                                                     * mandatory tests evidence (when applicable)

                                                                                                                                                                                                                                                                                                                     * explicit “I am unsure” flags when the model lacks certainty

This keeps the model from confidently bulldozing the repo.
________________


Document 6 — 
End-to-End Example Run (From Empty Repo to Finished Feature), Plus Extensions
This document shows how the whole system behaves in practice. It also specifies optional expansions like git enforcement, repo map generation, and periodic cleanup.
________________


Example Scenario
User wants: “Add a feature to an existing Python repo: a CLI command that exports a report to CSV, with tests.”
The user struggles with coding, wants process discipline, and wants to avoid repo chaos.
________________


Phase A: Planning Thread (messy sandbox)
1) User message
“Build a job for adding CLI export command + tests.”
2) LLM calls 
conductor_init
Input: title, goal, repo_root, policies (require devlog, require tests evidence, allow batch commits).
MCP returns:
                                                                                                                                                                                                                                                                                                                        * job_id JOB-7F2A

                                                                                                                                                                                                                                                                                                                        * next_questions (e.g. target CLI name, output columns, where data comes from)

3) LLM asks user questions; user answers
LLM calls conductor_answer.
MCP stores answers.
4) LLM calls 
repo_snapshot
MCP stores file tree. LLM reads and writes a REPO_MAP context block describing entrypoints and modules.
5) LLM compiles deliverables/invariants/DoD
Calls:
                                                                                                                                                                                                                                                                                                                           * plan_set_deliverables

                                                                                                                                                                                                                                                                                                                           * plan_set_invariants (e.g., “patches only”, “tests must pass”, “no new deps”)

                                                                                                                                                                                                                                                                                                                           * plan_set_definition_of_done

6) LLM proposes steps
Calls plan_propose_steps with steps like:
                                                                                                                                                                                                                                                                                                                              * Step 1: Update repo map + identify where CLI commands are registered

                                                                                                                                                                                                                                                                                                                              * Step 2: Implement new command skeleton; add help text

                                                                                                                                                                                                                                                                                                                              * Step 3: Implement CSV export logic; integrate with existing data source

                                                                                                                                                                                                                                                                                                                              * Step 4: Add unit tests; ensure deterministic outputs

                                                                                                                                                                                                                                                                                                                              * Step 5: Checkpoint: run full tests; update docs; cleanup suggestions

Each step includes acceptance criteria and required evidence.
7) MCP 
job_set_ready
MCP validates planning artifacts; if missing criteria/evidence, it refuses and returns what’s missing. LLM refines until accepted.
Finally: MCP returns JOB-7F2A READY.
________________


Phase B: Execution Thread (clean runway)
1) User pastes only 
JOB-7F2A
LLM calls job_start, then job_next_step_prompt.
2) Step 1 prompt delivered
It includes:
                                                                                                                                                                                                                                                                                                                                 * objective

                                                                                                                                                                                                                                                                                                                                 * invariants

                                                                                                                                                                                                                                                                                                                                 * evidence schema template

LLM performs Step 1 tasks, then submits:
                                                                                                                                                                                                                                                                                                                                    * job_submit_step_result(job_id, step_id, claim, evidence, devlog_line)

If evidence missing, MCP rejects and returns missing_fields, requiring resubmission.
If accepted, MCP advances.
3) On Step failure
If tests fail or model admits NOT_MET:
                                                                                                                                                                                                                                                                                                                                       * MCP instructs to record mistake entry

                                                                                                                                                                                                                                                                                                                                       * LLM calls mistake_record

                                                                                                                                                                                                                                                                                                                                       * LLM retries until criteria met

4) Completion
When last step accepted, MCP returns JOB_COMPLETE and suggests export bundle. The final export bundle includes:
                                                                                                                                                                                                                                                                                                                                          * the compiled prompt chain

                                                                                                                                                                                                                                                                                                                                          * all dev logs

                                                                                                                                                                                                                                                                                                                                          * mistakes ledger

                                                                                                                                                                                                                                                                                                                                          * step attempts

                                                                                                                                                                                                                                                                                                                                          * final deliverables summary

so the user can feed it into another tool or keep it as a “project memory”.

________________


Optional Expansions (the “godsend” layer)
A) Git Discipline
Add tools that call git via subprocess. Enforce per-step commit hash.
Rules:
                                                                                                                                                                                                                                                                                                                                             * each accepted step must include commit hash OR a batch-commit token

                                                                                                                                                                                                                                                                                                                                             * batch commit token expires after N steps

                                                                                                                                                                                                                                                                                                                                             * commit messages must follow a template (step_id + summary)

This makes the model’s work auditable and reversible.
B) Repo Map / File Descriptions
On every new file creation:
                                                                                                                                                                                                                                                                                                                                                * model must store a one-line description

                                                                                                                                                                                                                                                                                                                                                * MCP rejects step completion if new files appear without descriptions

                                                                                                                                                                                                                                                                                                                                                * store in repo_map table or a REPO_MAP.md generated artifact

C) Cleanup Cycles
Every K steps or at checkpoints:
                                                                                                                                                                                                                                                                                                                                                   * MCP asks model to list stale candidates

                                                                                                                                                                                                                                                                                                                                                   * requires justification for keeping or deleting

                                                                                                                                                                                                                                                                                                                                                   * stores cleanup plan in context

                                                                                                                                                                                                                                                                                                                                                   * optionally creates a cleanup step with criteria (“remove unused file X, tests still pass”)

D) “Best Practice” Research Injection
During planning mode only, allow the model to store “best practices” context blocks (research notes). The MCP can compress them into a short “Process Rules” block that is injected during execution.
This avoids execution thread bloat.
E) “Invariant Tests”
For invariants, add a “validator checklist step” periodically:
                                                                                                                                                                                                                                                                                                                                                      * “Confirm no full-file overwrites”

                                                                                                                                                                                                                                                                                                                                                      * “Confirm no new dependencies”

                                                                                                                                                                                                                                                                                                                                                      * “Confirm tests evidence exists”

This is mostly procedural but keeps the model from drifting.
________________


What Codex Needs to Build Next
If you feed these docs to Codex, the build plan should be:
                                                                                                                                                                                                                                                                                                                                                         1. Implement persistence + job schema

                                                                                                                                                                                                                                                                                                                                                         2. Implement planning tools + readiness validation

                                                                                                                                                                                                                                                                                                                                                         3. Implement execution gating: next step + submission validation

                                                                                                                                                                                                                                                                                                                                                         4. Implement logs + mistakes ledger

                                                                                                                                                                                                                                                                                                                                                         5. Add export bundle

                                                                                                                                                                                                                                                                                                                                                         6. Add optional repo snapshot + git integration

That yields a real system with the behavior you described.
________________
