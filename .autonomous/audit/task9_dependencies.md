# Task 9 Notes — Dependency Manifests (Vulns & Licenses)

Reviewed files:
- `pyproject.toml`
- `vibedev-ui/package.json`
- `vibedev-ui/package-lock.json` (presence only)

## Python Dependencies (`pyproject.toml`)

Runtime:
- `aiosqlite>=0.20.0`
- `fastapi>=0.110.0`
- `mcp[cli]>=1.12.0`
- `pydantic>=2.8.0`
- `uvicorn>=0.27.0`

Dev:
- `httpx>=0.27.0`
- `pytest>=9.0.0`
- `pytest-asyncio>=1.3.0`

## Node Dependencies (`vibedev-ui/package.json`)

Runtime:
- `react`, `react-dom`
- `@tanstack/react-query`, `zustand`
- `@dnd-kit/*`, `lucide-react`, `clsx`, `tailwind-merge`

Dev:
- `vite`, `typescript`, `eslint`, `@typescript-eslint/*`, `@vitejs/plugin-react`
- `tailwindcss`, `postcss`, `autoprefixer`

## Vulnerability / License Status

- No automated vulnerability scan performed in this session (offline).
- Version ranges are open (`>=` in Python, `^` in Node); Python deps not lock‑pinned.
- No explicit license metadata found in `pyproject.toml` or `package.json`.

Recommended follow‑ups:
- Run `pip-audit` (or equivalent) for Python.
- Run `npm audit` for UI dependencies.
- Add explicit license metadata and a top‑level LICENSE file if required.
