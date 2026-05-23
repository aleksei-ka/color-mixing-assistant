#!/usr/bin/env bash
# Build test stage (pytest, vitest, i18n, openapi) then production image.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export DOCKER_BUILDKIT=1

IMAGE="${COLOR_MATCHER_IMAGE:-color-matcher}"
TAG="${COLOR_MATCHER_TAG:-latest}"

echo "=== Docker: test stage ==="
docker build --target test -t "${IMAGE}:test" .

echo ""
echo "=== Docker: production image ==="
docker build --target production -t "${IMAGE}:${TAG}" .

echo ""
echo "Done."
echo "  Test image:        ${IMAGE}:test"
echo "  Production image:  ${IMAGE}:${TAG}"
echo ""
echo "Run locally:"
echo "  docker run --rm -p 8000:8000 ${IMAGE}:${TAG}"
echo "Or:"
echo "  docker compose up -d --build"
