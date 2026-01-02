# VibeDev VS Code Extension - Quick Start

## Installation (3 minutes)

### Step 1: Install Dependencies

```bash
cd vibedev-vscode
npm install
```

### Step 2: Compile TypeScript

```bash
npm run compile
```

### Step 3: Test in Development Mode

1. Open `vibedev-vscode` folder in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window will open with the extension loaded

### Step 4 (Optional): Package for Installation

```bash
npm run package
# Creates vibedev-vscode-0.1.0.vsix

# Install in VS Code:
# Extensions → ... → Install from VSIX
```

## First Use

### 1. Start VibeDev Server

```bash
# In main VibeDev directory
python -m vibedev_mcp.server serve
# Server runs on http://127.0.0.1:8765
```

### 2. Open VS Code

You'll see:
- **VibeDev icon** in Activity Bar (left sidebar)
- **Status bar item** showing connection status

### 3. Click VibeDev Icon

Opens **Mission Control** sidebar with:
- Current job status
- Step progress
- Quick action buttons

### 4. Try Manual Mode

In Claude Code chat:
```
User: "Start VibeDev job JOB-7F2A"
Claude: [uses MCP tools to start job]
```

Then in Mission Control sidebar:
- Click **"Next Step"**
- Prompt copied to clipboard
- Paste into chat
- Perform work
- Submit evidence via MCP

### 5. Try Autoprompt (Experimental)

1. Enable in settings:
   ```
   Ctrl+, → Search "vibedev" → Enable autoprompt
   ```

2. In Mission Control:
   - Click **"Start Autoprompt"**
   - Extension auto-pastes prompts
   - Watch progress in status bar
   - Press ESC to stop anytime

## Workflow Example

```
┌─────────────────────────────────────────────────────────┐
│ Planning Thread (Claude Code Chat)                      │
├─────────────────────────────────────────────────────────┤
│ User: "Help me implement authentication"               │
│ Claude: [uses conductor_init, plan_propose_steps, etc.]│
│ Claude: "Job JOB-7F2A ready with 8 steps"              │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Execution (Manual or Autoprompt)                       │
├─────────────────────────────────────────────────────────┤
│ Option A: Manual                                        │
│   1. Click "Next Step" in sidebar                      │
│   2. Paste prompt into chat                            │
│   3. Perform work                                       │
│   4. Submit evidence                                    │
│   5. Repeat                                             │
│                                                         │
│ Option B: Autoprompt                                    │
│   1. Click "Start Autoprompt"                          │
│   2. Watch it run autonomously                         │
│   3. Press ESC if needed                               │
└─────────────────────────────────────────────────────────┘
```

## Keybindings (Optional)

Add to your `keybindings.json`:

```json
[
  {
    "key": "ctrl+alt+n",
    "command": "vibedev.nextStep",
    "when": "editorTextFocus"
  },
  {
    "key": "ctrl+alt+a",
    "command": "vibedev.startAutoprompt"
  },
  {
    "key": "escape",
    "command": "vibedev.stopAutoprompt",
    "when": "vibedev.autopromptRunning"
  }
]
```

## Troubleshooting

### "VibeDev Offline" in status bar

- Check VibeDev MCP HTTP server is running (`vibedev-mcp serve`)
- Default: `http://127.0.0.1:8765`
- Test in browser: http://127.0.0.1:8765/health

### Extension not loading

- Check VS Code Developer Console (Help → Toggle Developer Tools)
- Look for errors in Console tab

### Autoprompt not pasting

- Try `autoSend: false` mode first
- Manually paste prompts
- Check that chat input has focus

## Next Steps

- Read [README.md](README.md) for full documentation
- Check [docs/00_overview.md](../docs/00_overview.md) for the canonical spec

## Tips

1. **Start simple**: Use manual mode first to understand workflow
2. **Enable autoprompt cautiously**: It's experimental
3. **Watch status bar**: Shows real-time job state
4. **Use web dashboard**: Click "Open Dashboard" for full UI
5. **ESC is your friend**: Stops autoprompt immediately

## Support

- Issues: https://github.com/yourusername/VibeDev/issues
- Docs: https://github.com/yourusername/VibeDev/tree/main/docs
