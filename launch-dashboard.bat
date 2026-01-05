@echo off
REM VibeDev Dashboard Launcher for Windows
REM Starts the MCP backend server and React UI dev server

echo.
echo 🚀 VibeDev Dashboard Launcher
echo ==============================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found. Please install Python first.
    pause
    exit /b 1
)

REM Check if Node is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

REM Get the script directory
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo.
echo 📦 Starting VibeDev MCP backend on http://127.0.0.1:8765...
start "VibeDev MCP Backend" python -m vibedev_mcp serve

REM Give the backend a moment to start
timeout /t 2 /nobreak

echo ⚛️  Starting React UI dev server on http://localhost:3000...
cd vibedev-ui
start "VibeDev UI" cmd /k npm run dev

timeout /t 3 /nobreak

REM Try to open in browser
start http://localhost:3000

echo.
echo ✅ Dashboard launching!
echo.
echo Both servers are running in separate windows.
echo Close the windows to stop the servers.
echo.
pause
