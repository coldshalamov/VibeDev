## Task 16: Manual API Smoke Checks

Date: 2026-01-01

### Attempted Command
- `python3 -m vibedev_mcp serve --help`

### Result
- Failed to start server: `ModuleNotFoundError: No module named 'aiosqlite'`    

### Feasibility
- Manual API smoke checks are not feasible in this environment without installing runtime dependencies (e.g., `aiosqlite`).

### Follow-up (WSL venv) — 2026-01-01

After installing dependencies into a virtualenv, basic smoke checks work.

#### Commands Run
- `~/.venvs/vibedev/bin/vibedev-mcp serve --help`
- Started server (briefly): `~/.venvs/vibedev/bin/vibedev-mcp serve --host 127.0.0.1 --port 8765`
- `curl http://127.0.0.1:8765/api/templates`

#### Result
- `vibedev-mcp serve --help` prints usage/options successfully.
- `GET /api/templates` returns JSON with `count` and `templates[]` (built-in template present).
