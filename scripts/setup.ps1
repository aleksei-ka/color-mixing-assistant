# One-time setup for Color Matcher (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Write-Host "=== Color Matcher setup ===" -ForegroundColor Cyan

Write-Host "`nPython:" -ForegroundColor Yellow
python --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "Python not found. Install from https://www.python.org/downloads/" -ForegroundColor Red
    exit 1
}

Write-Host "`nNode.js:" -ForegroundColor Yellow
node --version
npm --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "Node.js not found. Install LTS from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "`nCreating Python venv..." -ForegroundColor Yellow
$venv = Join-Path $Backend ".venv"
if (-not (Test-Path $venv)) {
    python -m venv $venv
}
& (Join-Path $venv "Scripts\Activate.ps1")
python -m pip install --upgrade pip
pip install -r (Join-Path $Backend "requirements.txt")

Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Yellow
Set-Location $Frontend
npm install
Set-Location $Root

Write-Host "`nDone. Run:" -ForegroundColor Green
Write-Host "  .\scripts\start-backend.ps1"
Write-Host "  .\scripts\start-frontend.ps1"
Write-Host "Then open http://localhost:5173"
