Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Host "==> Python: ruff"
ruff check vibedev_mcp tests

Write-Host "==> Python: pytest"
python -m pytest -v

Write-Host "==> UI: lint/test/build"
Push-Location "vibedev-ui" | Out-Null
npm run lint
npm run test
npm run build
Pop-Location | Out-Null

Write-Host "==> All checks passed."

