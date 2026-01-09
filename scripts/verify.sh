#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Python: ruff"
ruff check vibedev_mcp tests

echo "==> Python: pytest"
python -m pytest -v

echo "==> UI: lint/test/build"
cd "$ROOT/vibedev-ui"
npm run lint
npm run test
npm run build

echo "==> All checks passed."

