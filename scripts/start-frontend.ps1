$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Frontend = Join-Path $Root "frontend"

if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "Run .\scripts\setup.ps1 first" -ForegroundColor Red
    exit 1
}

Set-Location $Frontend
Write-Host "UI: http://localhost:5173" -ForegroundColor Cyan
npm run dev
