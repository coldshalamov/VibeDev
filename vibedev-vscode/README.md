# VibeDev Mission Control - VS Code Extension

Autonomous development workflow automation for Claude Code and other AI coding assistants.

## Features

- **Mission Control Sidebar**: Live job status, step progress, and quick actions
- **Autoprompt Engine**: Autonomous execution of multi-step development workflows
- **Status Bar Integration**: Real-time job status in VS Code status bar
- **Quick Commands**: Next step, submit evidence, open dashboard

## Installation

### From Source

1. Clone the VibeDev repository
2. Navigate to `vibedev-vscode/`
3. Run `npm install`
4. Run `npm run compile`
5. Press F5 in VS Code to launch extension development host

### Manual Installation

1. Run `npm run package` to create `.vsix` file
2. In VS Code: Extensions → ... → Install from VSIX

## Setup

1. Ensure VibeDev MCP HTTP server is running (default: `http://127.0.0.1:8765`)
2. Configure server URL in settings if needed:
   - Open Settings (Ctrl+,)
   - Search for "vibedev"
   - Set `vibedev.serverUrl` if not using default

## Usage

### Manual Workflow ("vd next" pattern)

1. **Plan your job** in Claude Code chat using VibeDev MCP tools
2. **Start execution**: Type "vd start JOB-ID" in chat
3. **Get next step**: Click "Next Step" button in sidebar or run command
4. **Perform work** as described in step
5. **Submit evidence**: Use MCP tools or extension command
6. **Repeat** until job complete

### Autoprompt Mode (Experimental)

1. Enable autoprompt in settings: `vibedev.autoprompt.enabled: true`
2. Start a job in EXECUTING status
3. Click "Start Autoprompt" in sidebar
4. Extension will:
   - Fetch next step prompt
   - Copy to clipboard
   - (Optional) Paste into chat
   - (Optional) Auto-send message
   - Wait for completion using dual-detection
   - Repeat until job done

**Safety features:**
- Pause button in status bar
- Press ESC to stop
- Auto-pause on diagnose mode
- Auto-pause on human review steps

**Completion Detection:**

The extension uses a **dual-detection strategy** to reliably detect when Claude has finished responding:

1. **MCP Server Polling**: Checks the VibeDev MCP server's `response-complete` endpoint every 2 seconds
2. **Chat Idle Detection**: Monitors VSCode for document changes, file saves, and file creation to detect when Claude stops streaming

**Detection Modes** (`vibedev.autoprompt.completionDetection`):
- `both` (default): Proceeds when EITHER method confirms completion (redundant/safe)
- `mcp-only`: Only uses MCP server signals (faster if MCP is reliable)
- `chat-only`: Only uses VSCode activity monitoring (fallback if MCP signals are missed)

**How Chat Idle Detection Works:**
- Tracks document changes (Claude streaming text)
- Monitors file saves (tool execution)
- Detects file creation (artifacts generated)
- Requires 3 consecutive idle checks (6 seconds total) to confirm completion
- Configurable via `vibedev.autoprompt.chatIdleThresholdMs`

This ensures the extension never fires the next prompt too early, even if the MCP server occasionally forgets to signal completion.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `vibedev.serverUrl` | `http://127.0.0.1:8765` | VibeDev MCP HTTP server URL (`vibedev-mcp serve`) |
| `vibedev.dashboardUrl` | `http://localhost:3000` | VibeDev Studio web UI URL |
| `vibedev.autoprompt.enabled` | `false` | Enable autoprompt automation |
| `vibedev.autoprompt.autoSend` | `false` | Auto-send messages (vs paste only) |
| `vibedev.autoprompt.delayMs` | `1000` | Delay between steps (ms) |
| `vibedev.autoprompt.pauseOnDiagnose` | `true` | Pause when entering diagnose mode |
| `vibedev.autoprompt.completionDetection` | `both` | Detection strategy: `both`, `mcp-only`, or `chat-only` |
| `vibedev.autoprompt.chatIdleThresholdMs` | `5000` | Time (ms) of no chat activity to consider idle |
| `vibedev.autoprompt.maxWaitTimeMs` | `300000` | Maximum wait time for completion (5 minutes) |
| `vibedev.completionMarker` | `✓ VD_READY` | Marker to detect response completion |

## Commands

| Command | Description |
|---------|-------------|
| `VibeDev: Next Step` | Get next step prompt and copy to clipboard |
| `VibeDev: Start Autoprompt` | Start autonomous execution |
| `VibeDev: Stop Autoprompt` | Stop autonomous execution |
| `VibeDev: Submit Evidence` | Submit step evidence (JSON) |
| `VibeDev: Open Web Dashboard` | Open VibeDev web UI in browser |
| `VibeDev: Refresh Status` | Refresh job status display |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ VS Code Extension                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐        │
│  │ Mission Control  │      │  Autoprompt      │        │
│  │ Sidebar (Webview)│      │  Engine          │        │
│  └────────┬─────────┘      └────────┬─────────┘        │
│           │                         │                   │
│           └─────────┬───────────────┘                   │
│                     │                                   │
│           ┌─────────▼─────────┐                         │
│           │  VibeDev Client   │                         │
│           │  (HTTP API)       │                         │
│           └─────────┬─────────┘                         │
│                     │                                   │
└─────────────────────┼─────────────────────────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │ VibeDev MCP     │
            │ HTTP Server     │
            │ localhost:3000  │
            └─────────────────┘
```

Note: In extension settings, `vibedev.serverUrl` should point to the MCP HTTP server (`vibedev-mcp serve`, default `http://127.0.0.1:8765`). `vibedev.dashboardUrl` is the optional Studio web UI URL (often `http://localhost:3000` in dev).

## Troubleshooting

### Extension not connecting to server

- Check that VibeDev MCP HTTP server is running (`vibedev-mcp serve`)
- Verify `vibedev.serverUrl` setting
- Check VS Code Developer Console (Help → Toggle Developer Tools)

### Autoprompt not working

- Ensure `vibedev.autoprompt.enabled` is `true`
- Check that job is in `EXECUTING` status
- Try manual mode first (`autoSend: false`)
- Look for error messages in status bar

### Prompts not pasting into chat

- Try manual copy/paste workflow first
- Check active editor focus
- Some chat UIs may not support programmatic paste

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode
npm run watch

# Launch extension
# Press F5 in VS Code

# Package extension
npm run package
```

## License

MIT

## Links

- [VibeDev Repository](https://github.com/yourusername/VibeDev)
- [Documentation](https://github.com/yourusername/VibeDev/tree/main/docs)
- [Report Issues](https://github.com/yourusername/VibeDev/issues)
