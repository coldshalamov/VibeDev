#!/bin/bash

# VibeDev Dashboard Launcher
# Starts the MCP backend server and React UI dev server

set -e

echo "🚀 VibeDev Dashboard Launcher"
echo "=============================="

# Check if Node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    exit 1
fi

# Check if Python is installed
if ! command -v python &> /dev/null; then
    echo "❌ Python not found. Please install Python first."
    exit 1
fi

# Get the script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo ""
echo "📦 Starting VibeDev MCP backend on http://127.0.0.1:8765..."
python -m vibedev_mcp serve &
BACKEND_PID=$!

# Give the backend a moment to start
sleep 2

echo "⚛️  Starting React UI dev server on http://localhost:3000..."
cd vibedev-ui
npm run dev &
UI_PID=$!

sleep 3

# Try to open in browser
if command -v start &> /dev/null; then
    # Windows
    start http://localhost:3000
elif command -v open &> /dev/null; then
    # macOS
    open http://localhost:3000
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open http://localhost:3000
else
    echo ""
    echo "✅ Dashboard ready! Open your browser to: http://localhost:3000"
fi

echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $UI_PID
