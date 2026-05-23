#!/usr/bin/env bash
# Run production container (build first if missing).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${COLOR_MATCHER_IMAGE:-color-matcher}"
TAG="${COLOR_MATCHER_TAG:-latest}"
PORT="${COLOR_MATCHER_PUBLISH_PORT:-8000}"

if ! docker image inspect "${IMAGE}:${TAG}" >/dev/null 2>&1; then
  echo "Image ${IMAGE}:${TAG} not found. Building..."
  "$ROOT/scripts/docker-build.sh"
fi

echo "UI + API: http://127.0.0.1:${PORT}"
exec docker run --rm -p "${PORT}:8000" "${IMAGE}:${TAG}"
