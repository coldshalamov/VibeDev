# Task 14 Notes — Logging/Telemetry & PII Leakage

Reviewed files:
- `vibedev_mcp/store.py`
- `vibedev_mcp/server.py`
- `vibedev_mcp/http_server.py`
- `vibedev-ui/src/hooks/useClipboardBridge.ts`
- `vibedev-ui/src/components/JobSelector.tsx`

## Observations

- No backend logging framework or telemetry instrumentation detected in `vibedev_mcp/`.
- Application data (devlogs, mistakes, context blocks, evidence, attempts) is stored in SQLite as plain text/JSON.
  - These fields can contain user‑entered content that may include PII.
- UI uses `console.error` for clipboard/job errors; no external telemetry or error reporting service observed.
- Clipboard bridge copies prompts to system clipboard; potential exposure depends on OS clipboard history and user environment.

## Conclusion

- No explicit telemetry or log shipping observed.
- PII risk primarily stems from storing user‑provided content in SQLite and clipboard usage.
