#!/usr/bin/env bash
# Provision Mother Tongue on InstaCloud, in the Singapore region.
#
# Region is fixed at service-creation time and there is no multi-region, so the
# services have to be created with --region before anything else. Re-running is
# safe: services that already exist are left alone.
#
# Verified against insta CLI 0.1.0.
set -euo pipefail

say() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }

command -v insta >/dev/null 2>&1 || {
  say "Installing the insta CLI"
  pnpm add -g insta
}

if [ -n "${INSTA_API_KEY:-}" ]; then
  insta login --api-key "$INSTA_API_KEY"
else
  insta status >/dev/null 2>&1 || insta login
fi

PROJECT="${INSTA_PROJECT:-mother-tongue}"
if ! insta status 2>/dev/null | grep -q 'project: [0-9a-f]'; then
  say "Creating project $PROJECT"
  insta project create "$PROJECT"
fi

# --- region -------------------------------------------------------------------
# The command is `insta config regions`, not `insta regions`.
say "Available regions"
insta config regions || warn "could not list regions"
REGION="${INSTA_REGION:-ap-southeast}"   # ap-southeast = Asia Pacific (Singapore)
say "Using region: $REGION"

add() { # add <type> <name> [extra flags...]
  local type=$1 name=$2
  shift 2
  if insta services list 2>/dev/null | grep -q "^$type/$name"; then
    warn "$type/$name already exists — skipping"
  else
    say "Adding $type/$name"
    insta services add "$type" "$name" "$@"
  fi
}

add postgres db --region "$REGION"
add storage clips --public          # storage is not region-scoped
add compute app --region "$REGION" --port 8080

say "Binding the database into compute"
insta secrets bind DATABASE_URL postgres/db --to compute/app \
  || warn "bind failed (self-hosted OSS answers 501 — credentials are injected already)"

if [ -n "${BOSON_API_KEY:-}" ]; then
  say "Storing BOSON_API_KEY"
  insta secrets set BOSON_API_KEY "$BOSON_API_KEY"
else
  warn "BOSON_API_KEY not in your shell — set it with: insta secrets set BOSON_API_KEY bai-..."
fi

if [ -n "${INSTA_API_KEY:-}" ]; then
  # The app forks a branch per learner at runtime, so it needs its own token.
  insta secrets set INSTA_API_KEY "$INSTA_API_KEY"
fi
insta secrets set INSTA_REGION "$REGION"

say "Deploying (--websocket: larger guest + connection-based concurrency)"
insta deploy . --websocket

say "Done."
insta services list
