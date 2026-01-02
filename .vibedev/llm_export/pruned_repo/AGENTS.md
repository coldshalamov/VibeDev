# VibeDev — Agent Guide (Repo Root)

## Repo Map

- `vibedev_mcp/` — Python backend (MCP tools + HTTP API)
- `vibedev-ui/` — React/Vite “Studio” UI
- `docs/` — Canonical spec docs (`docs/00_overview.md` → `docs/07_doc_map.md`)
- `tests/` — Python tests
- `CLAUDE.md` — Authoritative LLM operating manual (repo behavior rules)

## Cross-Module Workflow

- Backend exposes:
  - MCP tools over stdio (`vibedev-mcp`)
  - REST + SSE for the UI (`vibedev-mcp serve`, default `127.0.0.1:8765`)
- Frontend runs on `http://localhost:3000` and proxies `/api` to `http://localhost:8765`.

## Hard Rules (Global)

- Be truthful about command execution and outputs.
- Keep diffs small and scoped; avoid opportunistic refactors.
- If asked to do “docs-only”, do not touch code/config; document code changes as TODOs.

## Verification Commands

- Python tests: `python -m pytest -v`
- Backend stdio server: `vibedev-mcp`
- Backend HTTP server: `vibedev-mcp serve`
- UI dev server: `cd vibedev-ui; npm run dev`
- UI lint: `cd vibedev-ui; npm run lint`

## Where To Read The Spec

- Start: `docs/00_overview.md`
- Index: `docs/07_doc_map.md`

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Repo map + workflows | Informational | (Navigation only) |
| Hard rules | Informational | (Guidance for contributors/agents) |
| Verification commands | Informational | (Commands to run manually) |
