#!/bin/sh
# Retry npm ci inside Docker (transient registry/network errors).
set -eu

npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set maxsockets 5

attempt=1
max=5
while [ "$attempt" -le "$max" ]; do
  echo "npm ci attempt ${attempt}/${max}"
  if npm ci --no-fund --no-audit; then
    exit 0
  fi
  if [ "$attempt" -eq "$max" ]; then
    echo "npm ci failed after ${max} attempts" >&2
    exit 1
  fi
  sleep $((attempt * 15))
  attempt=$((attempt + 1))
done
