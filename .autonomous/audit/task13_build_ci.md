# Task 13 Notes — Build/Dev Scripts & CI Configuration

Reviewed files:
- `.github/workflows/ci.yml`
- `pyproject.toml`
- `vibedev-ui/package.json`

## CI Configuration

- GitHub Actions `CI` workflow runs on `push` and `pull_request`.
- Jobs:
  - **python-tests**: setup Python 3.11, install `.[dev]`, run `pytest -v`.
  - **ui-build**: setup Node 20, `npm ci`, `npm run lint`, `npm run build`.
- No dependency vulnerability scanning or SAST configured.

## Build/Dev Scripts

- Backend:
  - CLI entry: `vibedev-mcp` (from `pyproject.toml`)
  - HTTP server: `vibedev-mcp serve`
- UI (`package.json`):
  - `dev`: `vite`
  - `build`: `tsc && vite build`
  - `lint`: `eslint src --ext ts,tsx`

## Observations

- Node dependencies are locked via `package-lock.json` (`npm ci`).
- Python dependencies are version‑range based (`>=`) without a lockfile.
- CI focuses on build/lint/test; no explicit security or license checks.
