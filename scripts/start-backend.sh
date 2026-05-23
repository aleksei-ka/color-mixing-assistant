#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
PYTHON="$BACKEND/.venv/bin/python"

if [[ ! -x "$PYTHON" ]]; then
  echo "Run ./scripts/setup.sh first" >&2
  exit 1
fi

cd "$BACKEND"
echo "API: http://127.0.0.1:8000  docs: http://127.0.0.1:8000/docs"
exec "$PYTHON" -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
