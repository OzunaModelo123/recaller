#!/usr/bin/env bash
# Fixes common GitHub HTTPS push failures when credential.helper points at a
# missing `gh` binary (e.g. /tmp/gh_*). Uses macOS Keychain instead.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Removing broken GitHub credential helpers (if any)…"
git config --global --unset-all credential.https://github.com.helper 2>/dev/null || true
git config --global --unset-all credential.https://gist.github.com.helper 2>/dev/null || true

echo "Using osxkeychain for github.com…"
git config --global credential.https://github.com.helper osxkeychain
git config --local credential.https://github.com.helper osxkeychain

echo "OK. From this repo run: git push origin main"
echo "If Git asks for a password, use a GitHub Personal Access Token (classic) with repo scope."
echo "Or install GitHub CLI: brew install gh && gh auth login"
