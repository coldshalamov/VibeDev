# vibedev-ui — Agent Guide (Frontend)

## What This Module Is

`vibedev-ui/` is the React/Vite “Studio” UI for VibeDev.

## Local Development

- Install deps: `npm install`
- Run dev server: `npm run dev` (default `http://localhost:3000`)
- Lint: `npm run lint`

## Backend Connectivity

- Vite proxies `/api` to `http://localhost:8765` (see `vibedev-ui/vite.config.ts`).
- The API client uses:
  - `VITE_API_BASE_URL` (default empty, use proxy)
  - `VITE_API_PREFIX` (default `/api`)

## Live Updates (SSE)

- SSE endpoint: `GET /api/jobs/{job_id}/events`
- Hook: `vibedev-ui/src/hooks/useJobEvents.ts`

---

## Compilation Surface

| Section | Maps To | Field/Policy |
|---------|---------|--------------|
| Local development | Informational | (How to run the UI) |
| Backend connectivity | Informational | (Proxy + API base configuration) |
| Live updates (SSE) | Informational | (UI refresh/invalidation strategy) |
