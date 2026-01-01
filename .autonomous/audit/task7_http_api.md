# Task 7 Notes — HTTP API Endpoints, Auth, and SSE

Reviewed file:
- `vibedev_mcp/http_server.py`

## API Surface (High Level)

- Templates: `GET /api/templates`, `POST /api/templates`, `DELETE /api/templates/{template_id}`
- Jobs: `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/{job_id}`, `GET /api/jobs/{job_id}/ui-state`
- Planning Q&A: `GET/POST /api/jobs/{job_id}/questions`
- Planning artifacts: deliverables/invariants/definition-of-done/steps (POST/PATCH)
- Templates apply: `POST /api/jobs/{job_id}/templates/{template_id}/apply`
- Execution lifecycle: start/pause/resume/fail/archive, `GET /api/jobs/{job_id}/step-prompt`
- Step submission & approvals: submit/approve/revoke
- Context/devlog/mistake endpoints (via store)
- Git + repo helpers: git status/diff/log, repo snapshot/map/hygiene
- Export: `GET /api/jobs/{job_id}/export`
- SSE: `GET /api/jobs/{job_id}/events`

## Authentication / Authorization

- No auth or API keys present in this module.
- No per‑job access control checks beyond `job_id` path usage.

## CORS / Exposure

- CORS allowlist restricted to `http://localhost:3000` and `http://127.0.0.1:3000`.
- Credentials allowed (`allow_credentials=True`), all methods/headers allowed.

## SSE Behavior

- Endpoint: `GET /api/jobs/{job_id}/events`, `text/event-stream`.
- Polls store every 1s; emits events when job/phase/step/attempt/mistake/devlog changes.
- Emits initial `job_updated` event and subsequent changes.
- No explicit auth, throttling, or max connections in code.
