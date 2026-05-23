#!/usr/bin/env bash
# Quality Gate — v1 tests, v2 i18n, v3 openapi (when docs/openapi.json exists)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAGE="${1:-all}"
FAILED=0

PYTHON="${ROOT}/backend/.venv/bin/python"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="python3"
fi

run_step() {
  local name="$1"
  shift
  echo ""
  echo "=== $name ==="
  if "$@"; then
    :
  else
    echo "FAILED: $name" >&2
    FAILED=1
  fi
}

run_v1() {
  run_step "Backend pytest" bash -c "
    cd '$ROOT/backend' &&
    test -x .venv/bin/python || { echo 'Run scripts/setup first'; exit 1; } &&
    .venv/bin/pip install -q -r requirements-dev.txt 2>/dev/null || true &&
    .venv/bin/python -m pytest -q
  "
  run_step "Frontend vitest" bash -c "
    cd '$ROOT/frontend' &&
    if [[ ! -d node_modules/vitest ]]; then npm install --no-fund --no-audit; fi &&
    npm test
  "
}

run_v2() {
  run_step "i18n key parity" "$PYTHON" "$ROOT/scripts/check_i18n_keys.py"
}

run_v3() {
  local openapi="$ROOT/docs/openapi.json"
  local export="$ROOT/scripts/export_openapi.py"
  if [[ ! -f "$openapi" || ! -f "$export" ]]; then
    echo "SKIP QG v3: docs/openapi.json or export script missing"
    return 0
  fi
  run_step "OpenAPI spec up to date" "$PYTHON" "$ROOT/scripts/check_openapi_drift.py"
}

case "$STAGE" in
  v1) run_v1 ;;
  v2) run_v2 ;;
  v3) run_v3 ;;
  all)
    run_v1
    run_v2
    run_v3
    ;;
  *)
    echo "Usage: $0 [v1|v2|v3|all]" >&2
    exit 2
    ;;
esac

if [[ "$FAILED" -ne 0 ]]; then
  echo ""
  echo "QG FAILED" >&2
  exit 1
fi

echo ""
echo "QG passed ($STAGE)"
