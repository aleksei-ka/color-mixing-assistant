$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

Write-Host "Backend tests (pytest)..."
Push-Location "$root\backend"
& .\.venv\Scripts\python.exe -m pip install -q -r requirements-dev.txt 2>$null
& .\.venv\Scripts\python.exe -m pytest -q
Pop-Location

Write-Host "Frontend tests (vitest)..."
Push-Location "$root\frontend"
if (-not (Test-Path "node_modules\vitest")) {
  npm install
}
npm test
Pop-Location

Write-Host "Done."
