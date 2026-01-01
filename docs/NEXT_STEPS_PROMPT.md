# VibeDev MCP - Next Development Phase Prompt

> **Status update (repo reality check):** As of 2026-01-01, this repo already includes:
> - A FastAPI HTTP layer with REST endpoints + SSE events (`vibedev_mcp/http_server.py`)
> - A CLI entry for HTTP serving via `vibedev-mcp serve`
> - A React/Vite frontend wired to the `/api` endpoints (see `vibedev-ui/src/lib/api.ts`)
> - An SSE hook for live updates (`vibedev-ui/src/hooks/useJobEvents.ts`)
>
> This document is preserved as a roadmap prompt; sections below may describe work that is already implemented. Treat “Priority 3+” as the real remaining backlog unless otherwise noted.

## Context

You are continuing development on **VibeDev MCP**, a persistent development process brain that enforces disciplined LLM coding workflows. The project separates Planning (messy, research-heavy) from Execution (clean, step-by-step) and uses evidence-based progress gating.

### Current State Summary

**Backend (Python MCP Server):**
- 47 tests passing
- Core workflow implemented: Planning interview → Ready transition → Execution loop → Completion
- SQLite persistence with full CRUD for jobs, steps, attempts, context blocks, logs, mistakes
- New features added: `job_pause/resume/fail`, `job_list`, `plan_refine_steps`, `devlog_list/export`, `git_status/diff_summary/log`, `repo_hygiene_suggest`, `get_ui_state`

**Frontend (React + TypeScript + Vite):**
- Skeleton UI built and compiling successfully
- Components: GlobalSidebar, MainCanvas, ExecutionDashboard, AutomationCockpit, JobSelector
- Zustand store + React Query hooks configured
- Tailwind CSS with shadcn-style theming
- API client wired to the real backend endpoints; validate the full workflow end-to-end

---

## Priority 1 (DONE): Backend HTTP/SSE Transport Layer

The MCP server originally only supported stdio transport. The GUI needs HTTP endpoints.

**Implementation note:** This repo now includes `vibedev_mcp/http_server.py`, including REST endpoints under `/api/*` and an SSE stream at `GET /api/jobs/{job_id}/events`.

### Tasks

1. **Add FastAPI/Starlette HTTP layer** alongside the existing MCP stdio server
   - Create `vibedev_mcp/http_server.py` with REST endpoints
   - Map all existing MCP tools to HTTP POST endpoints
   - Add SSE endpoint for real-time state updates: `GET /jobs/{job_id}/events`

2. **Endpoint structure:**
   ```
   POST /api/jobs                           # conductor_init
   GET  /api/jobs                           # job_list
   GET  /api/jobs/{job_id}                  # get job details
   GET  /api/jobs/{job_id}/ui-state         # get_ui_state (primary GUI endpoint)
   GET  /api/jobs/{job_id}/events           # SSE stream for real-time updates

   POST /api/jobs/{job_id}/questions        # conductor_answer
   GET  /api/jobs/{job_id}/questions        # conductor_next_questions

   POST /api/jobs/{job_id}/deliverables     # plan_set_deliverables
   POST /api/jobs/{job_id}/invariants       # plan_set_invariants
   POST /api/jobs/{job_id}/definition-of-done
   POST /api/jobs/{job_id}/steps            # plan_propose_steps
   PATCH /api/jobs/{job_id}/steps           # plan_refine_steps

   POST /api/jobs/{job_id}/ready            # job_set_ready
   POST /api/jobs/{job_id}/start            # job_start
   POST /api/jobs/{job_id}/pause            # job_pause
   POST /api/jobs/{job_id}/resume           # job_resume
   POST /api/jobs/{job_id}/fail             # job_fail
   POST /api/jobs/{job_id}/archive          # job_archive

   GET  /api/jobs/{job_id}/step-prompt      # job_next_step_prompt
   POST /api/jobs/{job_id}/steps/{step_id}/submit  # job_submit_step_result

   POST /api/jobs/{job_id}/context          # context_add_block
   GET  /api/jobs/{job_id}/context/{id}     # context_get_block
   GET  /api/jobs/{job_id}/context/search   # context_search

   POST /api/jobs/{job_id}/devlog           # devlog_append
   GET  /api/jobs/{job_id}/devlog           # devlog_list
   GET  /api/jobs/{job_id}/devlog/export    # devlog_export

   POST /api/jobs/{job_id}/mistakes         # mistake_record
   GET  /api/jobs/{job_id}/mistakes         # mistake_list

   GET  /api/jobs/{job_id}/git/status       # git_status
   GET  /api/jobs/{job_id}/git/diff         # git_diff_summary
   GET  /api/jobs/{job_id}/git/log          # git_log

   POST /api/jobs/{job_id}/repo/snapshot    # repo_snapshot
   GET  /api/jobs/{job_id}/repo/map         # repo_map_export
   PATCH /api/jobs/{job_id}/repo/map        # repo_file_descriptions_update
   GET  /api/jobs/{job_id}/repo/hygiene     # repo_hygiene_suggest

   GET  /api/jobs/{job_id}/export           # job_export_bundle
   ```

3. **SSE Event Types:**
   ```typescript
   type SSEEvent =
     | { type: 'job_updated', data: Job }
     | { type: 'step_started', data: { step_id: string } }
     | { type: 'step_completed', data: { step_id: string, outcome: string } }
     | { type: 'attempt_submitted', data: Attempt }
     | { type: 'mistake_recorded', data: Mistake }
     | { type: 'devlog_appended', data: LogEntry }
     | { type: 'phase_changed', data: PhaseInfo }
   ```

4. **Add CORS middleware** for local development

5. **Create `vibedev-mcp serve` CLI command** that starts HTTP server on configurable port (default 8765)

---

## Priority 2 (MOSTLY DONE): Connect Frontend to Backend

### Tasks

1. **Update `vibedev-ui/src/lib/api.ts`:**
   - Change `API_BASE_URL` to configurable (env var or runtime config)
   - Ensure all fetch calls match the new HTTP endpoint structure
   - Add error handling with typed error responses

2. **Add SSE hook `useJobEvents`:**
   ```typescript
   function useJobEvents(jobId: string | null) {
     useEffect(() => {
       if (!jobId) return;
       const eventSource = new EventSource(`${API_BASE_URL}/jobs/${jobId}/events`);
       eventSource.onmessage = (event) => {
         const data = JSON.parse(event.data);
         // Invalidate relevant queries based on event type
         queryClient.invalidateQueries(['jobs', jobId]);
       };
       return () => eventSource.close();
     }, [jobId]);
   }
   ```

3. **Wire up all mutations** to call real API endpoints

4. **Add loading/error states** to all components

5. **Test full workflow:**
   - Create job via GUI
   - Answer planning questions
   - Define deliverables, invariants, steps
   - Transition to READY
   - Start execution
   - Submit step results
   - Complete job

---

## Priority 3: Missing Backend Features

These features are documented in CLAUDE.md but not yet implemented:

### High Priority

1. **Automatic checkpoint step insertion**
   - After N steps or on phase transition, auto-insert a "checkpoint" step
   - Checkpoint steps require: git commit, test run, and summary

2. **Process templates / reusable scaffolds**
   - Allow saving a completed job as a template
   - `template_save(job_id, template_name)`
   - `template_list()`
   - `template_instantiate(template_name, title, goal)` → new job with pre-filled steps

3. **RepoMap dependency graph**
   - Track which files depend on which
   - When a file changes, flag dependent files as potentially stale
   - `repo_map_add_dependency(job_id, from_path, to_path, dependency_type)`
   - Visualize in GUI

### Medium Priority

4. **Smarter evidence validation**
   - Parse `tests_run` to verify test names match project structure
   - Validate `changed_files` paths exist
   - Check `diff_summary` isn't too vague

5. **Step dependencies**
   - Allow steps to declare dependencies on other steps
   - Block execution until dependencies complete
   - Visualize as DAG in GUI

6. **Batch operations**
   - `jobs_bulk_archive(job_ids[])`
   - `steps_bulk_update(job_id, step_ids[], updates)`

---

## Priority 4: GUI Enhancements

### MainCanvas (Planning Mode)

1. **Drag-and-drop step reordering**
   - Use dnd-kit or similar
   - Call `plan_refine_steps` on drop

2. **Step templates library**
   - Pre-built step templates (e.g., "Write tests", "Update docs", "Run lint")
   - Quick-add from library

3. **AI-assisted step generation**
   - Button: "Suggest steps from goal"
   - Sends goal + deliverables to backend
   - Backend uses heuristics or external LLM to propose steps

4. **Rich text for instruction prompts**
   - Markdown editor with preview
   - Code block support

### ExecutionDashboard

1. **Evidence form builder**
   - Dynamic form based on `required_evidence`
   - File picker for `changed_files`
   - Command runner integration for `commands_run`

2. **Diff viewer**
   - Show actual git diff inline
   - Highlight relevant changes

3. **Test output viewer**
   - Parse and display test results
   - Link to specific test files

4. **Step history timeline**
   - All attempts for current step
   - Expandable rejection reasons

### AutomationCockpit

1. **Thread manager**
   - Show "Planning Thread" and "Execution Thread" status
   - Quick-copy prompts for each thread
   - Thread sync indicator

2. **Auto-prompter**
   - When clipboard bridge enabled:
     - Detect when user pastes response
     - Parse structured output
     - Auto-fill evidence form
     - One-click submit

3. **Keyboard shortcuts**
   - `Ctrl+Enter`: Submit current step
   - `Ctrl+P`: Pause/Resume
   - `Ctrl+N`: Copy next step prompt
   - `Esc`: Close modals

### GlobalSidebar

1. **Mistake search/filter**
   - Filter by tags
   - Full-text search in lessons

2. **Context block browser**
   - List all context blocks
   - Quick view/edit
   - Tag-based filtering

3. **Git integration panel**
   - Show current branch
   - Uncommitted changes count
   - Quick commit from GUI

---

## Priority 5: Developer Experience

### CLI Improvements

1. **Interactive CLI mode**
   ```bash
   vibedev-mcp interactive
   # Opens REPL-like interface for testing tools
   ```

2. **Job inspection commands**
   ```bash
   vibedev-mcp job show JOB-xxx
   vibedev-mcp job export JOB-xxx --format=md
   vibedev-mcp job list --status=EXECUTING
   ```

3. **Database management**
   ```bash
   vibedev-mcp db backup
   vibedev-mcp db migrate
   vibedev-mcp db stats
   ```

### Testing

1. **Integration tests for HTTP layer**
   - Use `httpx` or `TestClient`
   - Test all endpoints

2. **E2E tests for GUI**
   - Playwright or Cypress
   - Test full workflow through browser

3. **Load testing**
   - Verify performance with many jobs/steps

### Documentation

1. **API documentation**
   - OpenAPI/Swagger spec generated from FastAPI
   - Serve at `/docs`

2. **User guide**
   - Tutorial: First job walkthrough
   - Reference: All tools explained
   - Best practices: Evidence collection tips

3. **Architecture diagrams**
   - System overview
   - Data flow
   - State machine

---

## File Structure After Completion

```
vibedev_mcp/
├── __init__.py
├── server.py           # MCP stdio server (existing)
├── http_server.py      # NEW: FastAPI HTTP server
├── store.py            # SQLite persistence (existing)
├── conductor.py        # Planning interview (existing)
├── repo.py             # Repo utilities (existing)
├── models.py           # Pydantic models (existing)
├── templates.py        # NEW: Process templates
├── evidence.py         # NEW: Evidence validation
└── cli.py              # NEW: Enhanced CLI

vibedev-ui/
├── src/
│   ├── components/
│   │   ├── GlobalSidebar.tsx      (enhance)
│   │   ├── MainCanvas.tsx         (enhance)
│   │   ├── ExecutionDashboard.tsx (enhance)
│   │   ├── AutomationCockpit.tsx  (enhance)
│   │   ├── JobSelector.tsx        (existing)
│   │   ├── StepEditor.tsx         # NEW: Rich step editing
│   │   ├── EvidenceForm.tsx       # NEW: Dynamic evidence form
│   │   ├── DiffViewer.tsx         # NEW: Git diff display
│   │   ├── TestResults.tsx        # NEW: Test output display
│   │   └── ThreadManager.tsx      # NEW: Two-thread visualization
│   ├── hooks/
│   │   ├── useUIState.ts          (existing)
│   │   ├── useClipboardBridge.ts  (existing)
│   │   ├── useJobEvents.ts        # NEW: SSE connection
│   │   └── useKeyboardShortcuts.ts # NEW
│   └── ...

docs/
├── API.md              # NEW: HTTP API reference
├── USER_GUIDE.md       # NEW: Tutorial
└── ARCHITECTURE.md     # NEW: System diagrams

tests/
├── test_http_server.py # NEW: HTTP endpoint tests
├── e2e/                # NEW: Playwright tests
└── ...
```

---

## Implementation Order Recommendation

1. **Week 1: HTTP Layer**
   - Create `http_server.py` with all endpoints
   - Add SSE support
   - Add CLI `serve` command
   - Write HTTP integration tests

2. **Week 2: Frontend Connection**
   - Update API client
   - Add SSE hook
   - Test full workflow end-to-end
   - Fix any bugs discovered

3. **Week 3: GUI Polish**
   - Drag-drop step reordering
   - Evidence form builder
   - Keyboard shortcuts
   - Error states and loading indicators

4. **Week 4: Advanced Features**
   - Process templates
   - Step dependencies
   - Auto-prompter improvements
   - Documentation

---

## Success Criteria

The system is complete when:

1. A user can run `vibedev-mcp serve` and open the GUI in a browser
2. They can create a job, answer planning questions, define steps
3. They can transition to READY and start execution
4. They can submit step results with evidence
5. The system validates evidence and advances or rejects
6. They can pause/resume/fail jobs
7. Mistakes are recorded and surfaced in future step prompts
8. Jobs can be exported as markdown bundles
9. The clipboard bridge enables smooth two-thread workflow
10. All 50+ backend tests pass
11. E2E tests verify the full GUI workflow

---

## Notes for the Developer

- The `store.py` already has all the core logic - the HTTP layer is mostly routing
- The GUI components are functional but need real data - focus on the API connection first
- SSE is optional for MVP - polling works, but SSE provides better UX
- Don't over-engineer - get the basic flow working, then iterate
- The evidence validation can be simple at first - just check required fields exist
- Process templates are a nice-to-have, not critical for v1

Good luck! This is a substantial but achievable roadmap. Focus on Priority 1 and 2 first - once the GUI talks to the backend, everything else is incremental improvement.
