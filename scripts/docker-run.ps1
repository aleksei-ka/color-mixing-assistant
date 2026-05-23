param(
    [string]$Image = "color-matcher",
    [string]$Tag = "latest",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$full = "${Image}:${Tag}"
$exists = docker image inspect $full 2>$null
if (-not $exists) {
    Write-Host "Image $full not found. Building..." -ForegroundColor Yellow
    & "$Root\scripts\docker-build.ps1" -Image $Image -Tag $Tag
}

Write-Host "UI + API: http://127.0.0.1:$Port" -ForegroundColor Cyan
docker run --rm -p "${Port}:8000" $full
