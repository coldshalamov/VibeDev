# vibedev_mcp — Agent Guide (Backend)

## What This Module Is

`vibedev_mcp/` is the backend package:
- MCP tools server (stdio): `vibedev_mcp/server.py`
- HTTP API (REST + SSE): `vibedev_mcp/http_server.py`
- Persistent store + verification logic: `vibedev_mcp/store.py`

## Key Entrypoints

- CLI: `vibedev-mcp` (see `vibedev_mcp/server.py:main`)
- HTTP serve: `vibedev-mcp serve` (see `vibedev_mcp/http_server.py:serve_main`)

## How To Verify Changes

- Run tests: `python -m pytest -v`
- Smoke run stdio server: `vibedev-mcp`
- Smoke run HTTP server: `vibedev-mcp serve`

## API Contract Notes

- HTTP base path: `/api`
- UI state endpoint: `GET /api/jobs/{job_id}/ui-state`
- SSE stream: `GET /api/jobs/{job_id}/events`

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Entrypoints | Informational | (How to run) |
| Verification | Informational | (How to check behavior) |
| API contract notes | Informational | (HTTP surface for Studio) |
