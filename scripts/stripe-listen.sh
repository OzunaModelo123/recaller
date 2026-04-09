#!/usr/bin/env bash
# Forward Stripe webhooks to local Next (run alongside `npm run dev`).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SK="$(node -e "const fs=require('fs');const r=fs.readFileSync('$ROOT/.env.local','utf8');const m=r.match(/^STRIPE_SECRET_KEY=(.+)$/m);process.stdout.write(m?m[1].trim():'')")"
if [[ -z "$SK" ]]; then
  echo "STRIPE_SECRET_KEY missing in .env.local" >&2
  exit 1
fi
exec "$ROOT/.local/bin/stripe" listen \
  --forward-to localhost:3000/api/stripe/webhooks \
  --api-key "$SK"
