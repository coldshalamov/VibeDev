# VibeDev GUI: The "Glass Box" Development Command Center

> **Status:** Legacy / exploratory design notes.
>
> The canonical Studio UI spec is now `docs/05_studio_ui_spec.md` (and the “where is it?” index is `docs/07_doc_map.md`).
>
> Notes on current implementation:
> - The repo includes an HTTP API layer (REST + SSE) intended for the GUI.
> - The repo includes a Vite/React frontend in `vibedev-ui/`.
>
> This document is kept for additional ideas and historical context; it may describe features or deployment approaches that are not (yet) implemented.

## 1. Architectural Philosophy: The Stateful Supervisor UI

The VibeDev GUI is not a simple chat window; it is a **visual state machine representation**. While standard AI interfaces are ephemeral (context disappears), this GUI makes the **Job Object**  a living, editable "Canvas." It serves three primary functions:

1. **Visibility**: Exposing the "hidden" logic of prompts, invariants, and mistake ledgers.
2. **Manipulation**: Allowing the user to act as an "Editor-in-Chief," tweaking the LLM’s plan before execution.
3. **Automation Control**: Managing the "Auto-Prompter" and "Thread Switcher" to maintain flow without manual copy-pasting.

---

## 2. Technical Stack & MCP-UI Integration

The interface is built to be served via the **MCP-UI extension protocol**.

* **Backend**: Python MCP Server using `FastMCP` or `mcp-sdk`.
* **Frontend**: React-based SPA rendered inside an IDE WebView (Cursor/VS Code) or a dedicated Electron window.
* **Communication**: The MCP server exposes a `get_ui_state` tool and a `UIResource` that provides the current job’s JSON state to the React frontend.
* **Persistence**: The UI reflects the **SQLite/JSON database** in real-time. Every edit on the "Canvas" triggers a `job_refine_steps` or `context_add_block` call to the backend.

---

## 3. Core Interface Layout: The "VibeDev" Workspace

The UI is divided into three distinct zones: the **Global Sidebar**, the **Main Canvas**, and the **Automation Cockpit**.

### A. The Global Sidebar (Project Context & Invariants)

This panel remains persistent across both Planning and Execution phases.

* **Job Metadata**: Displays the Job ID (e.g., JOB-7F2A), Title, and high-level Goal.
* **Invariant Repository**: A toggle-able list of "Non-negotiable Truths".
    * *Feature*: Users can add new invariants (e.g., "Always use Tailwind for styling") which are then visually "highlighted" in every execution step prompt.
* **The Mistake Ledger (Failure Memory)**: A list of cards showing prior failures (Title, What Happened, Why, and Lesson).
    * *Visual Indicator*: Mistakes are tagged (e.g., `#DependencyError`). When a step is active that shares a tag with a mistake, the mistake card "glows" in the sidebar to alert the user/model.
* **Repo Map Preview**: A tree-view visualization of the codebase structure, with one-line descriptions for each file.

### B. The Main Canvas (Planning Mode)

In Planning Mode, the UI resembles a **whiteboard or Trello board**.

* **Step Cards**: Each proposed step is an interactive card.
* **Prompt Editor**: A text area showing the `instruction_prompt`. Both the LLM (via tool calls) and the user (via typing) can edit this text.
* **Criteria Checklist**: A list of "Definition of Done" items for that specific step.
* **Context Links**: Visual "pills" showing which research blocks or snippets are attached to this step.
* **The "Interview" Modal**: A popup or dedicated panel for the `conductor_interview_next` loop. It presents the LLM's questions as a structured form, allowing the user to provide context without "chatting."
* **The "Compile & Lock" Button**: Once the user is happy with the cards, they hit this button to trigger `job_set_ready`, transitioning the UI into Execution Mode.

### C. The Execution Dashboard (The "Clean Runway")

In Execution Mode, the UI becomes a **linear progression tracker**.

* **The Active Step Focus**: The current step is enlarged, while completed steps are collapsed into a "History" stack.
* **Evidence Viewer**: When the LLM submits a result, the `evidence_payload` (diff summaries, test logs) is rendered here in formatted blocks.
* **The Gating Console**:
    * **LLM Self-Check**: Shows the model’s `MET/NOT_MET` claim.
    * **User Checkpoint (Manual Override)**: A set of buttons: `[Approve & Advance]`, `[Reject & Repair]`, or `[Manual Pass]`.
    * **Status Indicators**: A traffic light system (Red: Rejected/Failed; Yellow: Pending Evidence; Green: Accepted).

---

## 4. Feature Deep-Dive: The "Auto-Prompter" System

This is the "mechanical heart" of the VibeDev GUI, enabling the "keep working" loop without user fatigue.

### The Automation Settings Panel

* **Prompt Injection Mode**:
    * *Option 1: Clipboard Bridge*: The GUI automatically copies the next step's "Distilled Prompt" to the system clipboard as soon as the previous step is approved.
    * *Option 2: Cursor Control (Python Scripting)*: A toggle that enables a local Python worker to use `pyautogui` or IDE-specific APIs to:
        1. Wait for the user's focus to land on the LLM's text box.
        2. Paste the prompt and press "Enter."
* **Thread Manager Trigger**:
    * A visual notification appears when context limits are approaching: *"Context High: Recommended Thread Reset."*
    * A "New Thread" button that copies the **Job ID + Current State Summary** to the clipboard, ready to be pasted into a fresh chat window to clear the "mess".
* **The "Go Time" Signal**: A master "Play" button that initiates the sequence. Once active, the MCP server manages the handshake: `Prompt` -> `Execute` -> `Submit` -> `Validate` -> `Auto-Prompt Next`.

---

## 5. Interaction Patterns & "Honor System" Gating

The GUI enforces the "back-and-forth" protocol through interactive feedback loops.

### A. The "Evidence Handshake" UI

When the model calls `job_submit_step_result`, the GUI doesn't just show text; it displays an **Evidence Checklist**.

* If the model claims a step is done but the `test_logs` field is empty, the GUI highlights that field in **Red**.
* The "Accept" button is disabled until the Python backend returns `accepted: true`.
* A "Repair" interface appears if the submission is rejected, showing the `rejection_reasons` and the `remediation_prompt` in a high-visibility box.

### B. The "Canvas" Editability

Unlike a standard agent, the user can **live-edit** the "Truth".

* If the LLM's plan for Step 4 is slightly wrong, the user double-clicks the card on the Canvas and rewrites the instruction.
* The GUI immediately updates the backend SQLite database.
* When the "Auto-Prompter" triggers Step 4, it sends the **user-edited version**, ensuring the LLM stays on the human's intended path.

---

## 6. Visual Language & UX Design

To assist the "Vibe Coder" who may not be an expert, the UI uses strong visual cues to prevent "Spec Drift".

* **Entropy Monitor**: A "health bar" for the repository. If the `repo_find_stale` tool finds more than 5 unused files, the bar turns orange, and a "Cleanup Recommended" button appears.
* **Consistency Highlighting**: If a prompt in Step 3 mentions a variable or module that isn't in the **Repo Map**, the GUI underlines it in purple, suggesting the user verify the architectural naming.
* **Process Ghosting**: Completed steps are shown in semi-transparent "ghost" cards. This keeps the execution thread visually focused on the *now*, while allowing the user to scroll back and see the "Hard-won lessons" from Step 1.

---

## 7. Operational Workflow for Agents

When an AI agent is tasked with building this GUI, it should follow this phased implementation:

1. **Phase 1: State Sync**: Implement the `get_ui_state` tool in Python and a React hook that polls this state to display the current Job status and Step list.
2. **Phase 2: The Step Canvas**: Build the "Planning" view where cards can be created, edited, and reordered. Link this to `plan_propose_steps` and `plan_refine_steps`.
3. **Phase 3: The Execution Gating UI**: Build the "Pilot View" that displays incoming `evidence_payloads` and provides the "Accept/Reject" manual overrides.
4. **Phase 4: Automation Layer**: Implement the clipboard and cursor automation toggles to handle the "Auto-Prompter" logic.
5. **Phase 5: Global Context Views**: Add the Sidebar for Invariants, Mistakes, and Repo Mapping.

This GUI transforms VibeDev from a "background process" into an **Interactive IDE Extension** that treats the LLM as a powerful engine and the user as the expert pilot.

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| This document | Informational | (Legacy UI ideas; not compiler input) |

