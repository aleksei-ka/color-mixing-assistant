#!/usr/bin/env bash
# Quick test run (QG v1). Full gate: ./scripts/qg.sh
set -euo pipefail
"$(cd "$(dirname "$0")" && pwd)/qg.sh" v1
