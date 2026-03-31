#!/usr/bin/env bash
# Stops listeners on 3000/3001 (typical Next.js dev ports), then starts the dev server.
# Use when you see "Another next dev server is already running" or port-in-use errors.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v lsof >/dev/null 2>&1; then
  for port in 3000 3001; do
    pids=$(lsof -ti:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "${pids}" ]]; then
      echo "Stopping listener(s) on port ${port}: ${pids}"
      kill ${pids} 2>/dev/null || true
    fi
  done
  sleep 0.5
fi

exec npm run dev -- "$@"
