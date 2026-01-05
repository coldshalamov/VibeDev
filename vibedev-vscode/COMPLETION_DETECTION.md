# Completion Detection Implementation

## Overview

The VSCode extension now implements a **dual-detection strategy** to reliably detect when Claude has finished responding. This prevents the autoprompt engine from firing the next prompt too early, even if the MCP server occasionally forgets to signal completion.

## Problem Statement

Previously, the extension used a simple 20-second timeout after sending a prompt. This had two issues:
1. **False negatives**: If Claude took longer than 20 seconds, the next prompt would fire prematurely
2. **No fallback**: If the MCP server forgot to signal completion, there was no backup detection method

## Solution: Dual Detection

### Method 1: MCP Server Polling (Primary)
- Polls the VibeDev MCP server's `/api/jobs/{jobId}/response-complete` endpoint
- Checks every 2 seconds
- Most reliable when MCP server is functioning correctly
- Already implemented in `VibedDevClient.checkResponseComplete()`

### Method 2: Chat Idle Detection (Fallback)
- Monitors VSCode activity to infer when Claude has stopped responding
- Tracks multiple signals:
  - **Document changes**: Detects Claude streaming text into the chat
  - **File saves**: Detects tool execution saving files
  - **File creation**: Detects artifacts being generated
- Requires 3 consecutive idle checks (6 seconds total) to confirm completion
- Configurable idle threshold (default: 5 seconds)

## Implementation Details

### Configuration Settings

Added three new settings to `package.json`:

```json
{
  "vibedev.autoprompt.completionDetection": {
    "type": "string",
    "enum": ["both", "mcp-only", "chat-only"],
    "default": "both",
    "description": "Completion detection strategy"
  },
  "vibedev.autoprompt.chatIdleThresholdMs": {
    "type": "number",
    "default": 5000,
    "description": "Time (ms) of no chat activity to consider idle"
  },
  "vibedev.autoprompt.maxWaitTimeMs": {
    "type": "number",
    "default": 300000,
    "description": "Maximum wait time for completion (5 minutes)"
  }
}
```

### Detection Modes

1. **`both` (default)**: Uses OR logic - proceeds when EITHER method confirms completion
   - Most reliable and redundant
   - Recommended for production use

2. **`mcp-only`**: Only uses MCP server polling
   - Faster if MCP is always reliable
   - No fallback if MCP misses signals

3. **`chat-only`**: Only uses VSCode activity monitoring
   - Useful for debugging or if MCP is unreliable
   - May be slower but very robust

### Code Changes

#### AutopromptEngine.ts

**Added document change listener** (`setupDocumentChangeListener()`):
- Monitors `onDidChangeTextDocument` for streaming activity
- Filters out trivial changes (< 10 characters)
- Distinguishes between user typing and Claude responses
- Tracks `lastDocumentChangeTime` timestamp

**Added file activity listeners**:
- `onDidSaveTextDocument`: Detects tool execution saving files
- `onDidCreateFiles`: Detects artifact generation

**Enhanced `waitForCompletion()` method**:
- Implements configurable dual-detection logic
- Requires 3 consecutive idle checks for chat idle confirmation
- Double-checks completion with 2-second buffer before proceeding
- Logs detailed completion events for debugging
- Has 5-minute absolute maximum timeout with warning

**Added `checkChatIdle()` method**:
- Compares current time to `lastDocumentChangeTime`
- Returns `true` if idle threshold exceeded
- Configurable via `chatIdleThresholdMs` setting

### Activity Tracking

The extension now tracks these VSCode events:

| Event | What it detects | When it fires |
|-------|----------------|---------------|
| `onDidChangeTextDocument` | Claude streaming text | Every time chat is updated |
| `onDidSaveTextDocument` | Tool execution saving files | When Claude runs tools that save |
| `onDidCreateFiles` | Artifact generation | When Claude creates new files |

All events update `lastDocumentChangeTime`, which is used by `checkChatIdle()` to determine if Claude is still active.

## Testing Strategy

### Unit Tests (Recommended)

1. **Test MCP-only mode**:
   - Mock MCP server returning `complete: true`
   - Verify prompt proceeds immediately

2. **Test chat-only mode**:
   - Simulate document changes
   - Verify completion only after idle threshold

3. **Test both mode**:
   - Verify proceeds when either method confirms
   - Test false alarm recovery (initial detection but not confirmed)

4. **Test timeout behavior**:
   - Verify warning shown after max wait time
   - Verify autoprompt continues despite timeout

### Integration Tests

1. **Real-world autoprompt flow**:
   - Start autoprompt with actual VibeDev job
   - Monitor console logs for completion events
   - Verify timing is appropriate (not too fast, not too slow)

2. **Edge cases**:
   - Very long Claude responses (> 1 minute)
   - Rapid back-and-forth tool use
   - MCP server temporarily unavailable
   - User editing files while Claude is responding

## Debugging

### Console Logs

The implementation includes comprehensive logging:

```
[AutopromptEngine] Waiting for completion with strategy: both
[AutopromptEngine] Detected active streaming
[AutopromptEngine] Chat idle for 5234ms
[AutopromptEngine] Initial completion detected, waiting buffer time...
[AutopromptEngine] Completion confirmed: { mode: 'both', mcp: true, chat: true, elapsed: 12456 }
```

### Common Issues

**Issue**: Autoprompt fires too quickly
- **Diagnosis**: Check if `chatIdleThresholdMs` is too low
- **Fix**: Increase threshold or switch to `both` mode

**Issue**: Autoprompt waits too long
- **Diagnosis**: Chat idle detection may be triggering on unrelated file changes
- **Fix**: Use `mcp-only` mode or review document change filter logic

**Issue**: Autoprompt times out
- **Diagnosis**: Neither detection method is confirming completion
- **Fix**: Check MCP server logs and VSCode activity in Developer Console

## Future Enhancements

1. **VSCode Progress API**: Monitor `vscode.window.withProgress` calls (if exposed)
2. **Terminal activity**: Monitor terminal output if API becomes available
3. **Language model API**: Use VS Code's native LLM API events (when stable)
4. **Machine learning**: Learn typical response time patterns per step type
5. **User feedback loop**: Allow users to report false positives/negatives

## Migration Guide

### For Existing Users

No action required - the default `both` mode is backward compatible and more reliable than the old timeout-based approach.

### For Power Users

To optimize performance:
1. If MCP server is 100% reliable: Switch to `mcp-only` mode
2. If experiencing false early completions: Increase `chatIdleThresholdMs`
3. If experiencing long waits: Decrease `maxWaitTimeMs` or use `mcp-only`

### For Developers

When debugging completion detection:
1. Open VSCode Developer Tools (Help → Toggle Developer Tools)
2. Filter console for `[AutopromptEngine]`
3. Watch for timing patterns and adjust thresholds
4. Test all three modes to isolate issues

## References

- [VSCode Extension API - Workspace Events](https://code.visualstudio.com/api/references/vscode-api#workspace)
- [AutopromptEngine.ts](./src/autoprompt/AutopromptEngine.ts)
- [VibedDevClient.ts](./src/client/VibedDevClient.ts)
- [Package.json Configuration](./package.json)
