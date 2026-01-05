# VibeDev MCP

**The first conversational workflow orchestrator for AI agents.**

VibeDev is a Model Context Protocol (MCP) server that doesn't just provide context or call APIs—it actively shapes how an AI agent works across multiple conversation threads to complete complex, multi-step projects.

## Why VibeDev is Different

Most MCP servers fall into two categories:

- **Outward MCPs**: Call external APIs (weather, databases, search engines)
- **Inward MCPs**: Pull in context (filesystem, documentation, memory)

**VibeDev is bidirectional.** It engages with the model *throughout* a conversation and *persistently across threads* to guide behavior toward a specific goal. Think of it as a workflow state machine that the AI collaborates with in real-time.

## What Makes This Possible

VibeDev introduces a new paradigm: **collaborative prompt construction**. You and the AI build a workflow together using a visual canvas, then execute it step-by-step across multiple threads while maintaining perfect continuity.

### The Workflow Canvas

Build your workflow visually with three primitives:

1. **Prompts** — Structured prompt boxes with fields for:
   - Role (who the AI should be)
   - Context (what it needs to know)
   - Task (what to do)
   - Guardrails (constraints)
   - Deliverables (expected outputs)
   - Log Instructions (what to record when done)

2. **Conditions** — Decision points that check if work meets standards:
   - **Soft conditions**: LLM judges the quality ("Does this meet the spec?")
   - **Hard conditions**: Scripts verify objective criteria (tests pass, build succeeds)
   - Both can loop back to fix-it prompts if they fail

3. **Breakpoints** — Thread reset points that:
   - Compile a memory block of findings
   - Start a fresh conversation thread
   - Inject the memory block into the next step
   - Keep context focused and prevent drift

### The Execution Model

Once your workflow is designed:

1. Call `/vd-next` skill to execute the next step
2. The MCP injects the step's prompt into your conversation
3. AI completes the work and logs a summary
4. Conditions evaluate automatically (soft or hard checks)
5. On pass: advance to next step
6. On fail: loop to fix-it prompts
7. On breakpoint: memory block saved, new thread required
8. Repeat until complete

Each completed step shows in the UI as a locked green box. Your entire project's progress is visible at a glance.

## Why This Matters

Traditional AI development conversations drift. Context gets lost. The same mistakes repeat. Work happens in bursts without continuity.

VibeDev makes AI development **deterministic**:

- ✅ Pre-plan entire workflows (research → planning → implementation → review)
- ✅ Enforce quality gates at every step
- ✅ Maintain findings and mistake ledgers across threads
- ✅ Never lose track of what's been done
- ✅ Resume multi-day projects without context loss
- ✅ Collaborate with the AI to build the workflow itself using natural language

## Quick Start

### Installation

Prereqs: Python 3.11+

```bash
python -m pip install -e .
```

### Run the MCP Server

For AI agents (stdio):
```bash
vibedev-mcp
```

For the GUI (HTTP + REST):
```bash
vibedev-mcp serve
```

### Run the Visual Workflow Studio

Terminal 1:
```bash
vibedev-mcp serve
```

Terminal 2:
```bash
cd vibedev-ui
npm install
npm run dev
```

Open `http://localhost:3000` to see the workflow canvas.

### Configure Your AI Agent

Add to your MCP config (e.g., Claude Desktop, Cline, etc.):

```json
{
  "mcpServers": {
    "vibedev": {
      "command": "vibedev-mcp"
    }
  }
}
```

Then create a skill that calls the MCP's `job_next_step_prompt` tool to advance through steps.

## Configuration

- Default DB path: `%USERPROFILE%\.vibedev\vibedev.sqlite3`
- Override DB path: `set VIBEDEV_DB_PATH=C:\path\to\vibedev.sqlite3`
- Override HTTP port: `set VIBEDEV_HTTP_PORT=8765`

## Architecture

VibeDev maintains three types of state across conversation threads:

### 1. Workflow State
- Current step position
- Completion status for each step
- Condition evaluation results
- Loop counters and retry logic

### 2. Memory Blocks
- Research findings
- Key decisions made
- Mistake ledger (what went wrong, why, how to avoid)
- Development log (summary of each step)

### 3. Context Injection
- Repo snapshots
- File descriptions
- Invariants (rules that never change)
- Custom context blocks

All of this persists in SQLite and gets injected into the right conversations at the right time.

## Use Cases

### Multi-day Development Projects
Plan a feature with 20+ steps spanning research, design, implementation, testing, and documentation. Work on it across multiple sessions without losing your place.

### Quality-gated Development
Set hard conditions (tests must pass, lint must succeed) and soft conditions (code review by AI, architecture sanity checks) at key points. No step advances until conditions pass.

### Research-to-Implementation Pipelines
Build workflows that start with research prompts, compile findings into memory blocks, then inject those findings into implementation prompts. The AI remembers what it learned.

### Team Collaboration
Multiple developers can see the workflow canvas and understand exactly where the AI is in the process. The development log shows what's been completed.

## MCP Tools

VibeDev exposes tools for:

- **Workflow construction**: Create prompts, conditions, breakpoints
- **Execution control**: Advance steps, evaluate conditions, handle failures
- **Memory management**: Store findings, record mistakes, update context
- **Repo integration**: Snapshots, file maps, git status, hygiene checks

See `docs/` for complete tool reference.

## Docs

- `docs/00_overview.md` — Core concepts and behavioral contract
- `docs/02_step_canvas_spec.md` — Prompt, condition, and breakpoint schemas
- `docs/05_studio_ui_spec.md` — Visual workflow canvas spec
- `docs/07_doc_map.md` — Complete concept index
- `CLAUDE.md` — Developer instructions for working on VibeDev itself

## The Bigger Picture

VibeDev proves that MCP can be more than a data pipe. It can be a **conversational framework** that actively shapes agent behavior over time.

This opens up entirely new possibilities:
- Workflow orchestrators that guide multi-agent systems
- Training frameworks that enforce learning patterns
- Quality systems that won't let agents cut corners
- Memory systems that grow more intelligent with each project

We're just getting started.

## Contributing

Run tests:
```bash
python -m pytest -v
```

Update generated TypeScript API types:
```bash
cd vibedev-ui
npm run gen:api
```

Keep diffs small and focused. See `CLAUDE.md` for development workflow guidelines.

## License

MIT

---

**VibeDev**: Because AI development shouldn't feel like herding cats.
