#!/bin/sh
# Retry pip install inside Docker.
set -eu

file="${1:?requirements file required}"
attempt=1
max=5
while [ "$attempt" -le "$max" ]; do
  echo "pip install attempt ${attempt}/${max}: ${file}"
  if pip install --retries 10 --timeout 120 --no-cache-dir -r "$file"; then
    exit 0
  fi
  if [ "$attempt" -eq "$max" ]; then
    echo "pip install failed after ${max} attempts" >&2
    exit 1
  fi
  sleep $((attempt * 10))
  attempt=$((attempt + 1))
done
