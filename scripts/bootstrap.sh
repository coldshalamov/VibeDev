#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Installing Python deps (editable + dev)..."
python -m pip install -e ".[dev]"

echo "==> Installing UI deps (npm ci)..."
cd "$ROOT/vibedev-ui"
npm ci

echo "==> Done. Next:"
echo "  - Dev:   ./launch-dashboard.sh"
echo "  - Verify: ./scripts/verify.sh"

