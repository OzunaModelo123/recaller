#!/usr/bin/env bash
# Downloads Stripe CLI into .local/bin/stripe (macOS arm64). Re-run after clone.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/.local/bin"
if [[ -x "$ROOT/.local/bin/stripe" ]]; then
  "$ROOT/.local/bin/stripe" --version
  exit 0
fi
VER="1.40.3"
URL="https://github.com/stripe/stripe-cli/releases/download/v${VER}/stripe_${VER}_mac-os_arm64.tar.gz"
echo "Downloading Stripe CLI ${VER}…"
curl -sL -o /tmp/stripe-cli.tgz "$URL"
tar -xzf /tmp/stripe-cli.tgz -C "$ROOT/.local/bin"
chmod +x "$ROOT/.local/bin/stripe"
"$ROOT/.local/bin/stripe" --version
