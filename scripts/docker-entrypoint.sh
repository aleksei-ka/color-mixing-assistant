#!/bin/sh
set -eu

HOST="${COLOR_MATCHER_HOST:-0.0.0.0}"
PORT="${COLOR_MATCHER_PORT:-8000}"

exec python -m uvicorn app.main:app --host "$HOST" --port "$PORT"
