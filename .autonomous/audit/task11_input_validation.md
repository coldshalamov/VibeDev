# Task 11 Notes — Backend Input Validation & Error Handling

Reviewed files:
- `vibedev_mcp/server.py`
- `vibedev_mcp/http_server.py`
- `vibedev_mcp/store.py`

## Input Validation

- MCP tools use Pydantic models with `extra="forbid"` and `str_strip_whitespace=True`; many fields have `min_length=1`.
- HTTP API request bodies use Pydantic models with `extra="forbid"`; fewer fields use `min_length` and no `str_strip_whitespace` in most models.
- Query params use FastAPI constraints (`limit`, `offset`, `n`, etc.).
- Some fields are descriptive only (e.g., `model_claim` expects MET/NOT_MET/PARTIAL but is not enforced as an enum).

## Error Handling

- HTTP API defines exception handlers:
  - `KeyError` → 404 `{"error":"not_found"}`
  - `ValueError` → 400 `{"error":"bad_request"}`
- Store raises `KeyError` for missing entities and `ValueError` for invalid job/step state.
- Other exceptions would surface as 500 responses (default FastAPI behavior).
- MCP server does not add custom exception handling; errors propagate from store calls.

## Observations

- Validation is generally strong at MCP tool boundary; HTTP API is less strict for some payloads.
- No explicit request authentication/authorization validation (handled in Task 7).
