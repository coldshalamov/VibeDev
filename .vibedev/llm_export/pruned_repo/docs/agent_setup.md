# Agent Setup (Universal MCP)

This repo provides a **Model Context Protocol (MCP) server** with two transports:

- **stdio MCP tools server** (for agents/IDEs): `vibedev-mcp`
- **HTTP REST + SSE server** (for the Studio UI): `vibedev-mcp serve`

The **MCP protocol is shared**, but **each client (Claude Code, Codex, Cursor, etc.) chooses its own config file location and schema**.
This doc provides copy/paste *templates* you can adapt to your client.

---

## 1) Install (repo)

From the repo root:

- `python -m pip install -e .`
- (recommended) `python -m pip install -e .[dev]`

---

## 2) Configure persistence (SQLite)

VibeDev stores state in SQLite.

- Default DB path: `%USERPROFILE%\.vibedev\vibedev.sqlite3` (Windows) / `~/.vibedev/vibedev.sqlite3` (POSIX)
- Override with `VIBEDEV_DB_PATH`

Example (Windows PowerShell):

- `setx VIBEDEV_DB_PATH "$env:USERPROFILE\\.vibedev\\vibedev.sqlite3"`

---

## 3) Start the MCP server (stdio)

Run:

- `vibedev-mcp`

This runs the MCP server on stdio, and the client/agent communicates via MCP tool calls.

---

## 4) Client config templates

These templates use the common `mcpServers` shape used by many MCP clients.
If your client uses different keys, keep the `command`, `args`, and `env` values and adapt the wrapper schema.

See:
- `configs/mcp/mcpServers.vibedev.windows.json`
- `configs/mcp/mcpServers.vibedev.posix.json`

### Notes

- Use an **absolute** DB path in `env.VIBEDEV_DB_PATH` if your client runs servers from an unexpected working directory.
- Prefer running the server from a **Python environment** where `vibedev-mcp` is on PATH.

---

## 5) Start the HTTP API (for the UI)

- `vibedev-mcp serve` (defaults to `127.0.0.1:8765`)

Health check:
- `curl http://127.0.0.1:8765/api/health`

### SQLite concurrency note

If you run multiple VibeDev processes against the same SQLite DB (e.g. one HTTP server and one stdio server),
SQLite may temporarily return `database is locked` under write contention. The backend enables:
- WAL mode
- a busy timeout

You should still treat this as a single-user / low-concurrency dev store unless you explicitly harden it further.

---

## 6) API schema + generated UI types

The backend can export its OpenAPI schema:

- `vibedev-mcp openapi --out openapi.json`

The UI can generate types from that schema:

- `cd vibedev-ui`
- `npm run gen:api`

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Install | Informational | (How to run locally) |
| Persistence | Informational | `VIBEDEV_DB_PATH` |
| stdio MCP | Informational | MCP tool transport |
| HTTP API | Informational | `/api/*` endpoints |
| Schema export | Informational | `vibedev-mcp openapi` |
