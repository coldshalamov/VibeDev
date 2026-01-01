# Task 12 Notes — UI Data Flow & Client‑Side Security Posture

Reviewed files:
- `vibedev-ui/src/lib/api.ts`
- `vibedev-ui/src/hooks/useJobEvents.ts`
- `vibedev-ui/src/hooks/useUIState.ts`
- `vibedev-ui/src/stores/useVibeDevStore.ts`
- `vibedev-ui/vite.config.ts`

## Data Flow

- API base derived from `VITE_API_BASE_URL` and `VITE_API_PREFIX` (default `/api`).
- All API calls use `fetch` with JSON; no auth headers or tokens.
- React Query handles caching and polling:
  - UI state polls every 5s, git status every 30s.
- SSE (`EventSource`) listens at `/api/jobs/{job_id}/events` and invalidates queries.
- State is stored in a Zustand store; only UI preferences are persisted in localStorage.

## Client‑Side Security Posture

- No client‑side auth or session management; relies on API accessibility (see Task 7).
- No use of `dangerouslySetInnerHTML` detected.
- Local storage persistence excludes job data and evidence (limits exposure).
- Vite dev server proxies `/api` to `http://localhost:8765` for local development.
