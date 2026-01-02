# VibeDev Repo Audit (from onefile-prompt snapshot)
This audit is based on the `onefile-prompt.txt` snapshot you provided (100 files). If the GitHub repo has diverged since that snapshot, treat diffs as "things to re-check".
## Executive summary
- **Backend (vibedev_mcp):** feature-rich MVP. Planning phases + evidence-gated execution + templates + REST/SSE are all present.
- **Frontend (vibedev-ui):** usable Studio shell with planning + execution flows; next big win is *runner integration* and *injection/gate-result previews*.
- **Docs:** unusually strong; canonical set is `docs/00…07` with legacy specs clearly labeled.
- **Tests/CI:** good unit coverage; CI builds backend + UI.

## Biggest gaps / risks
1. **Runner/autoprompt is still spec-only** (docs/06). Without it, users still do copy/paste.
2. **`store.py` is a monolith** (schema + planning + verifier + git + exports). Works, but refactor cost rises quickly.
3. **Type drift risk** between backend dict payloads and UI TS types; consider OpenAPI → TS generation.
4. **SQLite multi-process contention** (MCP server + HTTP server both writing) could benefit from WAL + busy_timeout.

## File-by-file notes

### ROOT
- `.gitignore` — Git ignore rules. Fine; verify it excludes local DB (~/.vibedev) and node_modules, dist, etc.
- `AGENTS.md` — Repo-root agent guide. Solid map + workflow. Consider adding a 10-line 'golden path' (create job → plan → execute → submit evidence → pass gates) with exact commands/UI clicks.
- `CLAUDE.md` — Authoritative behavioral contract for LLM/agents. Strong. Make sure README points here as 'rules of engagement' for contributors.
- `CLAUDE_VERBOSE.md` — Expanded CLAUDE.md for long-context models. Useful; keep in sync to avoid split-brain docs.
- `DOCS_REFACTOR_PROMPT.md` — Meta prompt used for docs refactor; ok to keep, but consider moving to /meta or /prompts so root stays clean.
- `README.md` — Project landing page. Good high-level but still wants a 'quickstart in 3 commands' plus 'what success looks like' screenshot(s) of Studio and one end-to-end run.
- `VibeDev doc3.md` — Design doc (likely the missing 'doc3' you referenced in earlier threads). Ensure it doesn’t contradict canonical docs/00–07; if it does, mark as legacy or fold into structured docs.
- `VibeDev-doc2_ todo_done folder.md` — Work log/todo archive. Useful for provenance but not canonical; consider moving to /notes or /meta.
- `pyproject.toml` — Packaging + deps. Looks reasonable. Consider pinning minimum versions + adding an extra 'dev' group (ruff/black/mypy) if you want a uniform contributor toolchain.
- `pytest.ini` — Pytest config; fine.

### .github
- `.github/workflows/ci.yml` — CI runs python tests and UI build. Good baseline; next: add lint (ruff/eslint) and maybe a tiny e2e smoke (start API and curl /health).

### .claude
- `.claude/settings.local.json` — Local tool allowlist for Claude. Good; document that this is local-only and safe to ignore for other envs.

### docs
- `docs/00_overview.md` — Canonical overview and behavioral contract. Keep as primary 'start here'.
- `docs/01_architecture.md` — Canonical architecture narrative. Ensure diagrams match actual code paths.
- `docs/02_step_canvas_spec.md` — Canonical StepTemplate spec. Watch for schema drift vs store.py.
- `docs/03_gates_and_evidence.md` — Canonical gates/evidence spec. Should remain consistent with store._evaluate_step_gates.
- `docs/04_flow_graph_and_loops.md` — Canonical flow graph spec. Ensure retry/pause/fail behaviors are implemented + tested.
- `docs/05_studio_ui_spec.md` — Canonical Studio UI spec. Compare to vibedev-ui implementation and log gaps.
- `docs/06_runner_autoprompt_spec.md` — Runner/autoprompt spec. Mostly future work; implement minimal runner first.
- `docs/07_doc_map.md` — Doc index. Keep updated whenever files move or sections change.
- `docs/AGENTS.md` — Docs/supporting notes. Check status header (canonical vs legacy) to prevent confusion.
- `docs/NEXT_STEPS_PROMPT.md` — Docs/supporting notes. Check status header (canonical vs legacy) to prevent confusion.
- `docs/gui_spec.md` — Docs/supporting notes. Check status header (canonical vs legacy) to prevent confusion.
- `docs/roadmap.md` — Docs/supporting notes. Check status header (canonical vs legacy) to prevent confusion.
- `docs/spec.md` — Docs/supporting notes. Check status header (canonical vs legacy) to prevent confusion.

### vibedev_mcp
- `vibedev_mcp/AGENTS.md` — Backend-focused agent guide. Good verification commands + API notes.
- `vibedev_mcp/__init__.py` — Package exports + version. Fine. Future: consider moving version to pyproject and reading it dynamically.
- `vibedev_mcp/conductor.py` — Planning 'interview' state machine (phases, question generation, ready-transition validation). Core to the two-thread workflow; seems coherent.
- `vibedev_mcp/http_server.py` — FastAPI REST+SSE layer for Studio UI. Nice: lifespan-managed store, explicit endpoints mirroring MCP tools, event stream. Next: enable reload in dev, add /health, and document CORS/proxy expectations.
- `vibedev_mcp/models.py` — Pydantic domain models (jobs/steps/evidence/gates/UI). Nice, but current runtime mostly uses dicts; next step is to tighten validation at boundaries (HTTP + MCP inputs/outputs).
- `vibedev_mcp/repo.py` — Repo scanning helpers: file-tree snapshot, dependency analysis, stale-candidate heuristics. Useful for recon + injection; consider adding language/framework detectors and size limits.
- `vibedev_mcp/server.py` — FastMCP tool surface (~39 tools). Good typed inputs and policy defaults. Risk: very large file + business logic sprinkled around; consider pushing logic into store/service modules and keeping server.py as thin routing.
- `vibedev_mcp/store.py` — The engine room: SQLite schema/migrations + planning state + evidence/gate verifier + git helpers + repo map + exports. Functionally rich but monolithic; biggest maintainability win is to split into modules (db/schema, planning, verifier, git, exports). Also consider WAL + busy_timeout for multi-process safety.
- `vibedev_mcp/templates.py` — Built-in template catalog + a strict_feature template. Works, but template library is tiny; next is to add 3–5 canonical templates (bugfix, refactor, docs-only, security hardening, release).

### vibedev-ui
- `vibedev-ui/AGENTS.md` — Frontend agent guide. Good for UI contributors; keep aligned with backend API contract.
- `vibedev-ui/index.html` — Vite HTML entrypoint. Standard.
- `vibedev-ui/package-lock.json` — NPM lockfile; good for reproducible builds.
- `vibedev-ui/package.json` — Frontend deps + scripts. Fine. Next: add 'typecheck' and 'format' scripts (prettier) and consider pinning via lockfile.
- `vibedev-ui/postcss.config.js` — PostCSS config for Tailwind; standard.
- `vibedev-ui/src/App.tsx` — Top-level UI composition: loads job state, renders sidebar + main panes. Keep it thin; most logic should stay in store/hooks.
- `vibedev-ui/src/components/AutomationCockpit.tsx` — Human-in-the-loop controls (pause/fail, devlog). Good seed for runner integration; next: wire 'RunnerActions' when runner exists.
- `vibedev-ui/src/components/ExecutionDashboard.tsx` — Execution UI: shows current step prompt, attempts, evidence submit form. Key UX piece; future: add 'prompt injection preview' panel and gate results at submission time.
- `vibedev-ui/src/components/GlobalSidebar.tsx` — Left nav: view mode, theme, job actions. UX-critical; add 'health' + connection status indicators here.
- `vibedev-ui/src/components/JobSelector.tsx` — Job list + create/archive UI. Consider adding search + tags as job count grows.
- `vibedev-ui/src/components/MainCanvas.tsx` — Planning UI (questions + step editor + template apply). Aligns with planning phases.
- `vibedev-ui/src/components/index.ts` — Barrel export; fine.
- `vibedev-ui/src/hooks/index.ts` — Barrel export; fine.
- `vibedev-ui/src/hooks/useClipboardBridge.ts` — Clipboard helper for copy/paste prompts/evidence. Good precursor to runner; add graceful fallbacks for denied clipboard perms.
- `vibedev-ui/src/hooks/useJobEvents.ts` — SSE subscription + event handling. Watch reconnect/backoff logic and event ordering.
- `vibedev-ui/src/hooks/useUIState.ts` — Fetch + cache UI state. Ensure it’s the single fetch path to avoid drift.
- `vibedev-ui/src/index.css` — Tailwind base styles + theme vars. Fine.
- `vibedev-ui/src/lib/api.ts` — Typed API client. Good surface; consider generating types from OpenAPI to avoid drift.
- `vibedev-ui/src/lib/utils.ts` — Small utilities (cn etc). Fine.
- `vibedev-ui/src/main.tsx` — React bootstrap. Standard.
- `vibedev-ui/src/stores/useVibeDevStore.ts` — Central client-side state store (jobs, UI state, view modes). Solid; keep it the single source to avoid prop-drilling chaos.
- `vibedev-ui/src/types/index.ts` — Type declarations for UI state payloads. Risk of drift; best fixed by generating from backend schemas/OpenAPI.
- `vibedev-ui/tailwind.config.js` — Tailwind config. Standard.
- `vibedev-ui/tsconfig.json` — TS config. Fine.
- `vibedev-ui/tsconfig.node.json` — TS config for Vite tooling. Fine.
- `vibedev-ui/vite.config.ts` — Dev server + /api proxy to backend. Good default.

### tests
- `tests/conftest.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_checkpoint_injection.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_conductor.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_dependencies.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_gates.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_http_server.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_mcp_tools.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_new_features.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_planning.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_repo_map.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_server.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_shell_gate_policy.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_store.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_templates.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_templates_custom.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.
- `tests/test_vibedev_smoke.py` — Test coverage for core behaviors. Keep expanding around boundary cases + concurrency.

### .autonomous
- `.autonomous/audit/audit_report_template.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/audit_scope.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/inventory.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/progress.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task10_secrets_scan.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task11_input_validation.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task12_ui_security.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task13_build_ci.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task14_logging_pii.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task15_tests.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task16_smoke_checks.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task6_mcp_tools.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task7_http_api.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task8_storage_secrets.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task9_dependencies.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.
- `.autonomous/audit/task_list.md` — Internal audit/work-tracking doc. Not runtime code; good for transparency and future hardening.

### PAPERS_EXTRACTED
- `PAPERS_EXTRACTED/Agentic_Design_Patterns.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/code-agents-are-state-of-the-art-software-testers-2tu70fvdvt.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/core-llm-as-interpreter-for-natural-language-programming-40uc1np38x.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/flowbench-revisiting-and-benchmarking-workflow-guided-2891cdc8m8.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/how-to-understand-whole-software-repository-3tzgf7anb8.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/masai-modular-architecture-for-software-engineering-ai-izzxldfe5w.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/sankalp.bearblog.dev.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
- `PAPERS_EXTRACTED/swe-agent-agent-computer-interfaces-enable-automated-5cpgb7kq3z.md` — Reference material (papers/notes). Not used by runtime; consider moving to /research or git submodule if repo size becomes annoying.
