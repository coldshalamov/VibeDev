# Project Status & Roadmap

## Current Status: V1 Complete
The core specification defined in `docs/spec.md` has been implemented.

### Implemented Features
- [x] **Core Infrastructure**
    - [x] SQLite persistence (`store.py`)
    - [x] Pydantic models for type safety (`models.py`)
    - [x] FastMCP server setup (`server.py`)

- [x] **Planning Mode (Conductor)**
    - [x] Phased planning interview (Intent, Deliverables, Invariants, Context, Plan) (`conductor.py`)
    - [x] Context block management (Research, Notes, snippets)
    - [x] Repo introspection (file listing, stale file detection) (`repo.py`)

- [x] **Execution Mode**
    - [x] Job state management (Pending, Active, Done)
    - [x] Structured Step Prompts with Evidence Gating
    - [x] Policy enforcement (Strict/Loose modes, required tests, diff summaries)

- [x] **Memory & Learning**
    - [x] DevLog appending
    - [x] Mistakes ledger (Record & List mistakes)
    - [x] Repo Map logic

## Roadmap / Future Work

### V1.1: Polishing & Experience
- [ ] **Better Docstrings/Help**: Ensure all tools have verbose descriptions for LLM consumption.
- [ ] **CLI Improvements**: nicer output for `vibedev-mcp` (though mostly used via MCP).

### V2 Ideas
- [ ] **Local Git Enforcement**: Implement direct local `git` integration (commit, branch, diff).
    - *Goal*: Enforce "frequent commits" and "clean state" invariants automatically.
    - *Constraint*: STRICTLY LOCAL. No GitHub/GitLab API dependencies.
- [ ] **Visual Dashboard**: A simple web UI to view active jobs and logs (reading from the SQLite DB).
- [ ] **Multi-Job Dependencies**: Allow one job to depend on the output of another.
- [ ] **Remote Remote**: Sync DB to a cloud location?

### V1.2: Infrastructure & Quality
- [ ] **CI/CD Setup**: Create GitHub Actions workflow (`.github/workflows/test.yml`) to run tests on push/PR.
- [ ] **Linting & Formatting**: Configure `pre-commit` hooks (Black, isort, MyPy) to enforce code style automatically.
- [ ] **Documentation Consolidation**:
    - Convert `docs/spec.md` to structured Markdown.
    - Migrate `CLAUDE.md` content to `docs/developer_guide.md`.
    - Ensure a single source of truth for architecture and testing patterns.

## Maintenance
- [ ] **Test Robustness**: Add specific test cases for Windows path handling and file locking.
- [ ] **Unit Test Expansion**: Increase coverage for edge cases in `conductor.py` and `repo.py`.
