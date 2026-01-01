# VibeDev MCP — Runner / Autoprompt Spec

## Purpose

VibeDev separates **decision-making** from **automation**:

- MCP (Store + Compiler + Verifier) is the **brain**: it decides what happens next.
- Runner is the **hands**: it performs **RunnerActions** safely and predictably.

This document defines RunnerActions, safety interlocks, and thread reset behavior.

---

## RunnerActions (Catalog)

RunnerActions are the only things the “hands” can do:

- `COPY_TO_CLIPBOARD(text)`
- `PASTE_PROMPT(text)`
- `SEND_PROMPT()`
- `WAIT_FOR_RESPONSE(timeout_ms?)`
- `NEW_THREAD(seed_text)`
- `FOCUS_TARGET(target)` (optional; IDE window / browser tab)

**Rule:** Runner never decides transitions; it only executes actions requested by the Verifier/UI.

---

## Runner Interlocks (Safety)

Runner defaults MUST be:
- **off** by default
- require explicit opt-in per job
- pause on `human_review=true` steps
- provide a visible “STOP” button that disables Runner immediately

Recommended interlocks:
- rate limit actions (max N per minute)
- require confirmation before `NEW_THREAD`
- require confirmation before `SEND_PROMPT` when context includes file modifications

---

## Thread Reset (“New Thread”) Policy

A thread reset is a FlowGraph transition, not just a convenience button.

### Inputs to NEW_THREAD

`NEW_THREAD(seed_text)` should include:
- `job_id`
- current job status
- current step_id + title
- invariants summary
- last rejection reasons (if any)
- a short “what to do next” instruction (from the Verifier)

### Why this exists

It preserves the clean execution runway by:
- discarding messy planning context
- rehydrating state from the Store via `job_id`

---

## Runner Implementation Options

Pick one (or multiple):

1. Clipboard-only (lowest risk)
   - Runner only copies prompts; user pastes manually.

2. IDE extension (VS Code/Cursor)
   - Can paste into chat panel and manage tabs.

3. Browser extension
   - Automates web-based chat UIs.

4. OS automation (highest risk)
   - e.g., keyboard/mouse scripting.

---

## Minimal Runner Contract

Runner must:
- execute the provided RunnerAction exactly
- report success/failure (with error messages)
- never fabricate “sent”/“pasted” claims

Runner must not:
- rewrite prompts
- reorder actions
- skip interlocks

---

## Compilation Surface

| Doc Section | Maps To | Field/Policy |
|-------------|---------|--------------|
| RunnerActions catalog | Runner | `RunnerAction.*` |
| Safety interlocks | Verifier policies + UI settings | (policy + UI) |
| Thread reset policy | FlowGraph transitions | `FlowGraph.*` |

