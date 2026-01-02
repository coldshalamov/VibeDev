# Project Status & Roadmap

This file is a high-level snapshot. The canonical “spec” now lives in the structured docs set:
- `docs/00_overview.md` through `docs/07_doc_map.md`

For the most detailed, prioritized work plan, see `docs/NEXT_STEPS_PROMPT.md`.

---

## Current Status (Implemented)

### Backend (Python)

- [x] SQLite persistence (`vibedev_mcp/store.py`)
- [x] MCP tools server (stdio) (`vibedev_mcp/server.py`)
- [x] Planning interview + plan compilation (`vibedev_mcp/conductor.py`)
- [x] Execution loop with evidence gating (`job_next_step_prompt`, `job_submit_step_result`)
- [x] Learning/memory: DevLog + MistakeLedger + Context blocks
- [x] Repo helpers: snapshot + repo map + hygiene suggestions
- [x] Local git helpers: `git_status`, `git_diff_summary`, `git_log`
- [x] HTTP API layer (REST) + SSE events (`vibedev_mcp/http_server.py`)

### Frontend (React + TypeScript)

- [x] Vite app skeleton (`vibedev-ui/`)
- [x] API client wired to the backend endpoints (`vibedev-ui/src/lib/api.ts`)
- [x] Core UI shells/components (GlobalSidebar, MainCanvas, ExecutionDashboard, AutomationCockpit, JobSelector)

---

## Roadmap (Next)

### “Big Rocks” (Backend)

- [ ] Automatic checkpoint step insertion (policy-driven)
- [ ] Process templates (save/load job structures) *(partial: built-in `template_list`/`template_apply` exists; persistence still TBD)*
- [ ] RepoMap dependency graph
- [ ] Smarter evidence validation (less “hand-wavy” proofs)
- [ ] Step dependencies (DAG execution + visualization)

### “Big Rocks” (Studio UI)

- [ ] MainCanvas: drag/drop reorder + step templates library + AI-assisted step generation
- [ ] ExecutionDashboard: evidence form builder + diff viewer + test output viewer
- [ ] AutomationCockpit: thread manager + auto-prompter + keyboard shortcuts
- [ ] GlobalSidebar: richer mistake search + context browser + git panel

### Developer Experience

- [ ] Interactive CLI mode
- [ ] Job inspection commands
- [ ] Integration / E2E tests
- [ ] OpenAPI docs + user guide

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Current Status | Informational | (Project snapshot) |
| Roadmap (Next) | Informational | (Backlog only; not enforced) |
