 a todo/ folder and a done/ folder with one file per “task chunk” is basically the cleanest possible way to make LLM work feel like a deterministic build system instead of a séance. 🧙‍♂️📦

And your idea of “each file contains the optimal chunk of context for a new thread, plus pointers to other context files” is exactly how you get long-horizon coherence without stuffing the model’s brain until it leaks.

Here’s the design I’d recommend.

---

## **Folder model: task packets as files**

### **Structure**

* plan/todo/STEP-\#\#\#-short-name.md  ← “work packets”

* plan/done/STEP-\#\#\#-short-name.md  ← completed packets (append-only / immutable)

* plan/context/                      ← stable reference docs (architecture, contracts, glossary, schemas)

* plan/receipts/STEP-\#\#\#/            ← evidence outputs (logs, diffs, screenshots, summaries)

* plan/index.md                      ← queue \+ current priority \+ dependencies graph

Each STEP file is a self-contained instruction capsule.

---

## **What goes inside a STEP packet (the important part)**

A packet should be ruthlessly structured so the model doesn’t freestyle.

Minimum fields:

* Goal (one sentence)

* Scope (what files can change / cannot change)

* Inputs (links/pointers to context files)

* Output requirements (what artifacts must be produced)

* Gates (qualifying criteria; pass/fail)

* Evidence schema (what “proof” looks like: test log, diff summary, UI screenshot, etc.)

* Execution rules (e.g., “no code changes” / “patch-only” / “no new deps”)

Example skeleton:

\# STEP-042: Add ACTIVE/DONE packet workflow to docs

\#\# Goal  
Document the packet workflow so agents reliably advance work without resurrecting history.

\#\# Scope  
Allowed: docs/\*.md only  
Forbidden: any code changes

\#\# Inputs  
\- context/system\_overview.md  
\- context/gates\_spec.md  
\- context/studio\_ui\_spec.md

\#\# Required outputs  
\- Updated CLAUDE.md section "Packet Workflow"  
\- New docs/packet\_format.md

\#\# Gates (must pass)  
\- Gate: contains explicit folder paths \+ move rules  
\- Gate: includes 1 worked example packet  
\- Gate: explains review cycle and amendments

\#\# Evidence  
\- receipt: summary of changes \+ file list  
\- receipt: snippet examples included

This makes the model’s job boring in the best way. 😈

---

## **“Move whole files between folders when done”**

That’s optimal. ✅

Why?

* It creates a hard executable boundary: only todo/ is eligible work.

* It’s easy for tooling: mv plan/todo/STEP-042\*.md plan/done/

* It preserves history without the model “seeing” it as active instructions (unless you explicitly load it during review).

Key rule: done/ is review-only. Never used for “next step selection.”

---

## **Threads: new thread per file?**

### **Not per edit. Per packet.**

New thread every time there’s a new edit is overkill and will slow you down, because you’ll spend half your life reloading context.

The sweet spot is:

* One thread per STEP packet (one coherent unit of work)

* Within that thread, do a small batch of edits that satisfy the gates for that packet

* Then finish, produce receipts, move packet to done/

Think “git commits”: you don’t open a new IDE session for every line, you do an atomic change-set that can be reviewed. Same idea.

### **When to split into multiple threads**

Split when:

* The packet would need too many reference files to load

* The step has multiple independent sub-goals

* You expect multiple iterations (design → implement → integrate)

* The gates are fundamentally different (e.g., “spec writeup” vs “UI build”)

So: chunked edits at once is usually best, as long as the chunk is “atomic and gate-checkable.”

---

## **Your “optimal chunk of context” idea: do it with a “Thread Seed”**

This is 🔥 and very implementable.

Each STEP packet is essentially a Thread Seed: the minimum context to execute the step.

Inside it, you include pointers to deeper context files rather than pasting them inline.

Then your runner (or manual process) does:

1. Open STEP file

2. Load only the referenced context files

3. Generate the prompt bundle for that thread

4. Execute step

5. Write receipts

6. Move STEP to done/

7. Optionally create a REVIEW packet

This prevents context bloat and keeps threads crisp.

---

## **Review cycles: review done steps without resurrecting them**

Do reviews as their own packets.

Example:

* todo/REVIEW-006-audit-last-5-steps.md

That review packet is allowed to read done/STEP-\* files and receipts, but it is not allowed to move done steps back.

Instead it can:

* Append an amendment file to done/ (or create a new “FIX” step in todo/)

* Mark review status in a separate ledger file (so you don’t edit done history)

This gives you auditability without rewriting history like a dictator with an eraser. 🧼

---

## **The simplest “planner loop” for VibeDev**

* Selection rule: pick the highest-priority packet in plan/todo/ (or index.md)

* Execution: run it in a fresh thread with its declared context

* Completion: write receipts, then move packet file to done/

* Follow-up: optionally enqueue a review packet every N steps

This becomes a workflow engine where the LLM is the worker, and your file system is the source of truth.

---

## **Practical recommendation**

Do this:

* ✅ plan/todo/ \+ plan/done/ with one packet per chunk

* ✅ One thread per packet (not per edit)

* ✅ Keep packets small enough to finish in one thread

* ✅ Review via dedicated REVIEW packets, not by reopening old work

* ✅ Evidence lives in plan/receipts/STEP-\#\#\#/ and is referenced by the packet

That architecture will feel weirdly powerful because it makes “agentic dev” behave like… engineering.

The universe hates vibes; it respects receipts. 🧾✨

