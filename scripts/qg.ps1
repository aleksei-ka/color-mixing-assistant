# Quality Gate — run before PR (v1 tests, v2 i18n; v3 openapi after docs/openapi.json exists)
param(
    [ValidateSet("v1", "v2", "v3", "all")]
    [string]$Stage = "all"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failed = $false

$python = if (Test-Path "$root\backend\.venv\Scripts\python.exe") {
    "$root\backend\.venv\Scripts\python.exe"
} else {
    "python"
}

function Run-Step($name, [scriptblock]$block) {
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    try {
        & $block
        if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
    } catch {
        Write-Host "FAILED: $name" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
        $script:failed = $true
    }
}

$runV1 = $Stage -eq "all" -or $Stage -eq "v1"
$runV2 = $Stage -eq "all" -or $Stage -eq "v2"
$runV3 = $Stage -eq "all" -or $Stage -eq "v3"

if ($runV1) {
    Run-Step "Backend pytest" {
        Push-Location "$root\backend"
        if (-not (Test-Path ".\.venv\Scripts\python.exe")) {
            throw "Backend venv missing. Run .\scripts\setup.ps1"
        }
        & .\.venv\Scripts\python.exe -m pip install -q -r requirements-dev.txt 2>$null
        & .\.venv\Scripts\python.exe -m pytest -q
        Pop-Location
    }

    Run-Step "Frontend vitest" {
        Push-Location "$root\frontend"
        if (-not (Test-Path "node_modules\vitest")) {
            npm install --no-fund --no-audit
        }
        npm test
        Pop-Location
    }
}

if ($runV2) {
    Run-Step "i18n key parity" {
        Push-Location $root
        & $python scripts\check_i18n_keys.py
        Pop-Location
    }
}

if ($runV3) {
    $openapi = Join-Path $root "docs\openapi.json"
    $export = Join-Path $root "scripts\export_openapi.py"
    if (-not (Test-Path $openapi) -or -not (Test-Path $export)) {
        Write-Host "SKIP QG v3: docs/openapi.json or export script missing" -ForegroundColor Yellow
    } else {
        Run-Step "OpenAPI spec up to date" {
            Push-Location $root
            $tmpJson = Join-Path $env:TEMP "color-matcher-openapi-check.json"
            & $python scripts\export_openapi.py $tmpJson
            $diff = Compare-Object (Get-Content $openapi) (Get-Content $tmpJson)
            Remove-Item $tmpJson -ErrorAction SilentlyContinue
            if ($diff) {
                Write-Host "docs/openapi.json is out of date. Run: python scripts/export_openapi.py" -ForegroundColor Red
                throw "openapi drift"
            }
            Pop-Location
        }
    }
}

if ($failed) {
    Write-Host "`nQG FAILED" -ForegroundColor Red
    exit 1
}

Write-Host "`nQG passed ($Stage)" -ForegroundColor Green
exit 0
