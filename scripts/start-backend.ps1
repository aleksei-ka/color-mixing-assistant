$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$venvPython = Join-Path $Backend ".venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Host "Run .\scripts\setup.ps1 first" -ForegroundColor Red
    exit 1
}

Set-Location $Backend
Write-Host "API: http://127.0.0.1:8000  docs: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
& $venvPython -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
