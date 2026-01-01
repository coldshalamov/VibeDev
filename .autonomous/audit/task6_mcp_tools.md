# Task 6 Notes — MCP Tool Definitions & Security Boundaries

Reviewed files:
- `vibedev_mcp/server.py`
- `vibedev_mcp/store.py`
- `vibedev_mcp/repo.py`

## Tool Surface (High Level)

All MCP tools are defined in `vibedev_mcp/server.py` via `@mcp.tool`.

- Planning: `conductor_*`, `plan_*`
- Execution: `job_set_ready`, `job_start`, `job_submit_step_result`
- Memory: `context_*`, `devlog_*`, `mistake_*`
- Repo/Git: `repo_*`, `git_*`
- Templates: `template_list`, `template_apply`
- Approvals: `approve_step`, `revoke_step_approval`

## Input Validation & Hints

- Pydantic models use `extra="forbid"` and `str_strip_whitespace=True`.
- Many fields require `min_length=1`.
- Tool annotations include `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`.

## Security Boundaries Observed

- **Shell gate execution is opt‑in**:
  - `DEFAULT_POLICIES.enable_shell_gates` defaults to `False`.
  - Allowlist enforced via `shell_gate_allowlist` with `fnmatch` checks in `store.py`.
  - Timeouts applied (max 300s).
- **Repo-root path constraints in gates**:
  - `file_exists`, `file_not_exists`, `json_schema_valid` resolve paths and require they stay within `job.repo_root`.
- **Git tooling scope**:
  - `git_status`, `git_diff_summary`, `git_log` run fixed git commands with timeouts.
  - `openWorldHint=True` for git tools (server tool annotations).
  - No explicit allowlist for repo_root path beyond “repo_root must be set”.
- **Repo snapshot/hygiene**:
  - `repo_snapshot` and `repo_hygiene_suggest` operate on `job.repo_root` using filesystem walks.
  - `repo.py` ignores common dirs (`.git`, `.venv`, `node_modules`, etc.) and truncates output.
  - No explicit restriction preventing `repo_root` from pointing outside the intended project.
