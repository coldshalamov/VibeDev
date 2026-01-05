# MCP Configuration (Example)

If you run the VibeDev HTTP server (`vibedev-mcp serve`), it exposes MCP tools over Streamable HTTP at:

- `http://127.0.0.1:8765/mcp/`

Example `.mcp.json` entry:

```json
{
  "vibedev": {
    "type": "http",
    "url": "http://127.0.0.1:8765/mcp/"
  }
}
```

Then your MCP client can call tools like:
- `workflow_unified_upsert_step`
- `workflow_unified_connect`
- `job_next_step_prompt`

