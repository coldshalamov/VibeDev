Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Push-Location (Split-Path -Parent $MyInvocation.MyCommand.Path) | Out-Null
Pop-Location | Out-Null

Write-Host "==> Installing Python deps (editable + dev)..."
python -m pip install -e ".[dev]"

Write-Host "==> Installing UI deps (npm ci)..."
Push-Location (Join-Path (Get-Location) "vibedev-ui") | Out-Null
npm ci
Pop-Location | Out-Null

Write-Host "==> Done. Next:"
Write-Host "  - Dev:   .\\launch-dashboard.bat"
Write-Host "  - Verify: .\\scripts\\verify.ps1"

