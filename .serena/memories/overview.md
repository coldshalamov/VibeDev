# VibeDev Project Overview

VibeDev is a Development Command Center consisting of an MCP server (acting as a persistent process brain and prompt-chain conductor) and a visual UI for managing workflows and AI agents.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, MCP, aiosqlite, Pydantic, uvicorn.
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Zustand, @xyflow/react (formerly React Flow), TanStack Query.
- **VS Code Extension**: TypeScript-based extension for integrating VibeDev into the IDE.

## Rough Structure
- `vibedev_mcp/`: Core backend and MCP server implementation.
- `vibedev-ui/`: React-based visual dashboard.
- `vibedev-vscode/`: Integration for VS Code.
- `tests/`: Project tests (primarily Python).
- `docs/`: Project documentation.
