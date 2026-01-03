# Suggested Commands for VibeDev

## Development Commands

### Backend
- **Start MCP HTTP Server**: `uvicorn vibedev_mcp.http_server:app --host 127.0.0.1 --port 8766`
- **Run Backend Tests**: `pytest`
- **Install in Dev Mode**: `pip install -e .[dev]`

### Frontend (vibedev-ui/)
- **Start Dev Server**: `npm run dev`
- **Build**: `npm run build`
- **Run Tests**: `npm run test`
- **Lint**: `npm run lint`
- **Generate API Types**: `npm run gen:api`

## System/Git Commands (Windows)
- **Status**: `git status`
- **Log**: `git log -n 5`
- **Push**: `git push origin main`
- **Clean**: `git clean -fd` (Use with caution on Windows)
- **Delete Reserved Files (like nul)**: `Remove-Item -Path "\\?\C:\path\to\file" -Force`
