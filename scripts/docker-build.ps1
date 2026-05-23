# Build test stage then production Docker image (Windows PowerShell)
param(
    [string]$Image = "color-matcher",
    [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$env:DOCKER_BUILDKIT = "1"

Write-Host "=== Docker: test stage ===" -ForegroundColor Cyan
docker build --target test -t "${Image}:test" .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== Docker: production image ===" -ForegroundColor Cyan
docker build --target production -t "${Image}:${Tag}" .
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDone." -ForegroundColor Green
Write-Host "  Test image:        ${Image}:test"
Write-Host "  Production image:  ${Image}:${Tag}"
Write-Host "`nRun locally:"
Write-Host "  docker run --rm -p 8000:8000 ${Image}:${Tag}"
Write-Host "Or:"
Write-Host "  docker compose up -d --build"
