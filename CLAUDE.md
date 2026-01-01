# VibeDev MCP - Development Guide

## Project Overview

VibeDev MCP is a **persistent development process brain** that enforces disciplined LLM coding workflows. It acts as a "procedural supervisor" and "project memory" that lives outside the model's context window.

### Core Philosophy

LLMs produce better results when they:
- Break problems into explicit steps
- Research before implementing
- Keep a clean execution context (not polluted by messy brainstorming)
- Run self-check loops (tests, lint, smoke checks)
- Keep short diffs + frequent commits
- Write logs and remember what failed

VibeDev MCP separates **Planning** (messy, research-heavy) from **Execution** (clean, step-by-step) and enforces evidence-based progress gating.

---

## Architecture

### Module Structure

```
vibedev_mcp/
├── __init__.py      # Package version and exports
├── server.py        # FastMCP server with all tool definitions
├── store.py         # SQLite persistence layer (VibeDevStore)
├── conductor.py     # Planning interview logic (compute_next_questions)
└── repo.py          # Repository utilities (snapshot, stale detection)
```

### Data Model

**Core Entities:**

| Entity | Description | Key Fields |
|--------|-------------|------------|
| `Job` | A task with full lifecycle | `job_id`, `status`, `goal`, `deliverables`, `invariants`, `definition_of_done`, `step_order`, `policies` |
| `Step` | Single execution unit | `step_id`, `title`, `instruction_prompt`, `acceptance_criteria`, `required_evidence` |
| `Attempt` | Submission record | `attempt_id`, `model_claim`, `evidence`, `outcome` |
| `ContextBlock` | Stored context/notes | `context_id`, `block_type`, `content`, `tags` |
| `LogEntry` | Dev log entries | `log_id`, `log_type`, `content`, `step_id` |
| `MistakeEntry` | Failure ledger | `mistake_id`, `what_happened`, `lesson`, `avoid_next_time` |
| `RepoSnapshot` | File tree snapshot | `snapshot_id`, `file_tree`, `key_files` |
| `RepoMapEntry` | File descriptions | `path`, `description` |

**Job State Machine:**
```
PLANNING -> READY -> EXECUTING -> COMPLETE
                  |           |
                  v           v
               PAUSED      FAILED
                  |
                  v
              ARCHIVED
```

### Database Schema

SQLite with tables: `jobs`, `steps`, `attempts`, `context_blocks`, `logs`, `mistakes`, `repo_snapshots`, `repo_map_entries`

Default location: `~/.vibedev/vibedev.sqlite3`
Override: `VIBEDEV_DB_PATH` environment variable

---

## Two-Thread Workflow

### Thread A: Planning (Messy Sandbox)

The planning phase uses a **phased interview** to collect structured artifacts:

| Phase | Purpose | Questions |
|-------|---------|-----------|
| 1 | Intent & Scope | `repo_exists`, `out_of_scope`, `target_environment`, `timeline_priority` |
| 2 | Deliverables | `deliverables`, `definition_of_done`, `tests_expected` |
| 3 | Invariants | `invariants` (non-negotiable rules) |
| 4 | Repo Context | `repo_root`, `key_files`, `entrypoints` |
| 5 | Plan Compilation | `steps` (ordered list with criteria + evidence) |

**Planning Tools:**
- `conductor_init` - Create job, start interview
- `conductor_next_questions` - Get current questions based on state
- `conductor_answer` - Submit answers, progress interview
- `context_add_block` / `context_get_block` / `context_search` - Store/retrieve context
- `plan_set_deliverables` / `plan_set_invariants` / `plan_set_definition_of_done`
- `plan_propose_steps` - Define the step chain
- `job_set_ready` - Validate and transition to READY

### Thread B: Execution (Clean Runway)

User pastes only the `JOB-XXXX` id. The MCP drip-feeds clean prompts.

**Execution Loop:**
1. `job_start(job_id)` - Begin execution
2. `job_next_step_prompt(job_id)` - Get structured step prompt with:
   - Step objective
   - Invariants reminder
   - Required evidence format
   - Relevant mistakes
   - Remediation guidance
3. LLM performs step, collects evidence
4. `job_submit_step_result(...)` - Submit evidence + claim
5. MCP validates and advances (or rejects for retry)
6. Repeat until `JOB_COMPLETE`

---

## Evidence Gating

The system uses **structured evidence** to enforce accountability:

```json
{
  "changed_files": ["path/to/file.py"],
  "diff_summary": "Added validation for X",
  "commands_run": ["pytest tests/"],
  "tests_run": ["test_foo", "test_bar"],
  "tests_passed": true,
  "lint_run": true,
  "lint_passed": true,
  "artifacts_created": ["docs/API.md"],
  "criteria_checklist": {"c1": true, "c2": true},
  "notes": "Implementation notes"
}
```

### Policy Toggles

Set at `conductor_init.policies`:

| Policy | Default | Effect |
|--------|---------|--------|
| `require_devlog_per_step` | true | Reject if no devlog_line |
| `require_commit_per_step` | false | Reject if no commit_hash |
| `allow_batch_commits` | true | Allow deferred commits |
| `require_tests_evidence` | true | Require tests_run + tests_passed |
| `require_diff_summary` | true | Require diff_summary |
| `inject_invariants_every_step` | true | Include invariants in prompts |
| `inject_mistakes_every_step` | true | Include relevant mistakes |
| `evidence_schema_mode` | "loose" | "strict" requires per-criterion checklist |

---

## Tool Reference

### Initialization / Conductor
- `conductor_init(title, goal, repo_root?, policies?)` -> job_id + first questions
- `conductor_next_questions(job_id, last_answers?)` -> next questions
- `conductor_answer(job_id, answers)` -> ack + follow-up questions

### Context Storage
- `context_add_block(job_id, block_type, content, tags)` -> context_id
- `context_get_block(job_id, context_id)` -> block
- `context_search(job_id, query, limit?)` -> matching blocks

### Plan Compilation
- `plan_set_deliverables(job_id, deliverables[])`
- `plan_set_invariants(job_id, invariants[])`
- `plan_set_definition_of_done(job_id, definition_of_done[])`
- `plan_propose_steps(job_id, steps[])` -> normalized steps
- `job_set_ready(job_id)` -> {ready, missing[]} or {ready, job}

### Execution
- `job_start(job_id)` -> ok
- `job_next_step_prompt(job_id)` -> structured step prompt
- `job_submit_step_result(job_id, step_id, model_claim, summary, evidence, devlog_line?, commit_hash?)` -> {accepted, feedback, next_action, missing_fields, rejection_reasons}

### Logging & Failure Ledger
- `devlog_append(job_id, content, step_id?, commit_hash?)`
- `mistake_record(job_id, title, what_happened, why, lesson, avoid_next_time, tags, related_step_id?)`
- `mistake_list(job_id, limit?)`

### Repo Helpers
- `repo_snapshot(job_id, repo_root, notes?)` -> file tree + key files
- `repo_file_descriptions_update(job_id, {path: description})`
- `repo_map_export(job_id, format?)` -> md or json
- `repo_find_stale_candidates(job_id, max_results?)` -> stale file candidates

### Export / Archive
- `job_export_bundle(job_id, format?)` -> json or md bundle
- `job_archive(job_id)` -> ok

---

## Development

### Setup

```bash
# Install in dev mode
python -m pip install -e .

# Install dev dependencies
python -m pip install -e .[dev]
```

### Running

```bash
# Run server (stdio transport)
vibedev-mcp

# Override DB path
set VIBEDEV_DB_PATH=C:\path\to\vibedev.sqlite3
vibedev-mcp
```

### Testing

```bash
# Run all tests
python -m pytest -v

# Run with coverage
python -m pytest --cov=vibedev_mcp --cov-report=term-missing

# Run specific test file
python -m pytest tests/test_store.py -v
```

### Code Style

- Python 3.11+
- Type hints for all public APIs
- Pydantic models for input validation
- Async/await for all database operations
- JSON serialization for complex fields in SQLite

---

## Key Design Decisions

### Why MCP?

MCP provides:
- Persistent storage and retrieval
- Tool calls that enforce structure
- Cross-thread continuity via job_id
- Deterministic "next step" gating

The LLM cannot reliably own state across threads; the MCP can.

### Why SQLite?

- Zero-config, file-based persistence
- ACID transactions
- Works offline, no external services
- Easy to backup/inspect

### Why Phased Planning?

Phases ensure the model doesn't skip critical planning steps:
1. Scope before deliverables
2. Deliverables before steps
3. Invariants defined explicitly
4. Repo context captured
5. Steps compiled with criteria

### Why Evidence Gating?

Without structured evidence:
- Models "hand-wave" completion
- No audit trail
- Criteria silently skipped

With evidence:
- Explicit accountability
- Verifiable progress
- Mistake ledger grows from failures

---

## Roadmap

The backend now includes job lifecycle tools (`job_pause/resume/fail`), listing (`job_list`), plan editing (`plan_refine_steps`), devlog export/listing, repo hygiene suggestions, git helpers, and an HTTP+SSE API layer for the GUI.

For current next steps and remaining “big rock” features (checkpoint insertion, templates, dependency graph, DAG steps, GUI polish), see `docs/NEXT_STEPS_PROMPT.md`.

---

## Testing Patterns

### Store Tests

Always use temp directories and cleanup:

```python
@pytest.mark.asyncio
async def test_example():
    tmp_dir = tempfile.mkdtemp()
    try:
        store = await VibeDevStore.open(os.path.join(tmp_dir, "vibedev.sqlite3"))
        # ... test code ...
        await store.close()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
```

### Full Workflow Test

Test planning -> ready -> execution -> completion:

```python
job_id = await store.create_job(title="T", goal="G", ...)
await store.plan_set_deliverables(job_id, ["D"])
await store.plan_set_invariants(job_id, [])
await store.plan_set_definition_of_done(job_id, ["Done"])
await store.plan_propose_steps(job_id, [{...}])
result = await store.job_set_ready(job_id)
assert result["ready"] is True

await store.job_start(job_id)
prompt = await store.job_next_step_prompt(job_id)
result = await store.job_submit_step_result(
    job_id=job_id,
    step_id=prompt["step_id"],
    model_claim="MET",
    summary="done",
    evidence={...},
    devlog_line="completed",
    commit_hash=None,
)
assert result["accepted"] is True
```

---

## Debugging Tips

1. **Check job state**: Export bundle to see full state
2. **Missing fields**: Check `rejection_reasons` in submit result
3. **Phase stuck**: Run `conductor_next_questions` to see what's missing
4. **DB inspection**: Open SQLite directly with any SQL browser

---

## Contributing

1. Read `VibeDev.txt` for the full spec
2. Check existing tests for patterns
3. Add tests for new functionality
4. Run `pytest` before committing
5. Keep changes minimal and focused
