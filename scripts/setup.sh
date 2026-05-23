#!/usr/bin/env bash
# One-time setup (Linux / macOS)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "=== Color Matcher setup ==="

echo ""
echo "Python:"
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 not found. Install Python 3.10+." >&2
  exit 1
fi
python3 --version

echo ""
echo "Node.js:"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install LTS from https://nodejs.org/" >&2
  exit 1
fi
node --version
npm --version

echo ""
echo "Creating Python venv..."
if [[ ! -d "$BACKEND/.venv" ]]; then
  python3 -m venv "$BACKEND/.venv"
fi
# shellcheck disable=SC1091
source "$BACKEND/.venv/bin/activate"
python -m pip install --upgrade pip
pip install -r "$BACKEND/requirements.txt"

echo ""
echo "Installing frontend dependencies..."
(cd "$FRONTEND" && npm install --no-fund --no-audit)

echo ""
echo "Done. Run:"
echo "  ./scripts/start-backend.sh"
echo "  ./scripts/start-frontend.sh"
echo "Then open http://localhost:5173"
