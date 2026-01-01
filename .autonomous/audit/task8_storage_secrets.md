# Task 8 Notes — Data Storage/Persistence & Secrets Management

Reviewed files:
- `vibedev_mcp/store.py`
- `vibedev_mcp/server.py`
- `vibedev_mcp/http_server.py`
- `README.md`

## Data Storage & Persistence

- Uses SQLite via `aiosqlite`; DB file path defaults to `~/.vibedev/vibedev.sqlite3`.
- DB directory is created if missing; foreign keys enabled (`PRAGMA foreign_keys = ON`).
- Schemas include tables for:
  - `jobs`, `steps`, `attempts`, `context_blocks`, `logs`, `mistakes`
  - `repo_snapshots`, `repo_map_entries`, `templates`
- Evidence, context content, and logs are stored as JSON/text fields (plain text in DB).
- IDs generated with `secrets.choice` (random IDs, not security tokens).

## Secrets Management

- No explicit secret/credential storage or encryption in repo.
- Environment variables used for configuration only:
  - `VIBEDEV_DB_PATH` (DB file path)
  - `VIBEDEV_HTTP_PORT` (HTTP server port)
- No per‑request auth or API keys observed; data confidentiality relies on local filesystem access controls.

## Observations

- Repo snapshots include file tree, key files, and dependency data; content may expose sensitive file names.
- Context blocks, evidence, and logs could contain sensitive user‑provided data; stored unencrypted in SQLite.
