#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND="$ROOT/frontend"

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "Run ./scripts/setup.sh first" >&2
  exit 1
fi

cd "$FRONTEND"
echo "UI: http://localhost:5173"
exec npm run dev
