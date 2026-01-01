# Repo Inventory (Task 3)

Timestamp: 2026-01-01 15:34

## Components

- Backend package: `vibedev_mcp/`
  - Key modules: `server.py` (MCP CLI), `http_server.py` (REST + SSE), `store.py` (SQLite persistence), `conductor.py`, `models.py`, `templates.py`
- Frontend app: `vibedev-ui/` (React + Vite Studio UI)
  - Key files: `src/main.tsx`, `vite.config.ts`, `package.json`
- Docs: `docs/` (canonical specs in `docs/00_overview.md` … `docs/07_doc_map.md`)
- Tests: `tests/` (pytest)
- Root config: `pyproject.toml`, `pytest.ini`

## Key Entrypoints

- MCP CLI: `vibedev-mcp` → `vibedev_mcp.server:main` (from `pyproject.toml`)
- HTTP API server: `vibedev-mcp serve` → `vibedev_mcp/http_server.py:serve_main`
- UI dev server: `npm run dev` (Vite), entry `vibedev-ui/src/main.tsx`
