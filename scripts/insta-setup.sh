#!/usr/bin/env bash
# Provision Mother Tongue on InstaCloud, in the Singapore region.
#
# Region is fixed at service-creation time and there is no multi-region, so this
# has to run before anything else. Re-running is safe: existing services are
# left alone.
set -euo pipefail

say() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }

command -v insta >/dev/null 2>&1 || {
  say "Installing the insta CLI"
  npm install -g insta
}

if [ -n "${INSTA_API_KEY:-}" ]; then
  insta login --api-key "$INSTA_API_KEY"
else
  insta status >/dev/null 2>&1 || insta login
fi

PROJECT="${INSTA_PROJECT:-mother-tongue}"
if ! insta status >/dev/null 2>&1 || [ -n "${INSTA_CREATE:-}" ]; then
  say "Creating project $PROJECT"
  insta project create "$PROJECT" || warn "project may already exist"
fi

# --- pick the Singapore region ------------------------------------------------
say "Available regions"
insta regions || warn "could not list regions"

REGION="${INSTA_REGION:-}"
if [ -z "$REGION" ]; then
  REGION=$(insta regions 2>/dev/null \
    | grep -iE 'singapore|\bsin\b|ap-southeast-1' \
    | grep -oE '[a-z]{2,4}[0-9]?|ap-southeast-1' \
    | head -1 || true)
fi
: "${REGION:=sin}"
say "Using region: $REGION  (override with INSTA_REGION=...)"

add() { # add <type> <name> [extra flags...]
  local type=$1 name=$2; shift 2
  if insta services list 2>/dev/null | grep -q "$name"; then
    warn "$type/$name already exists — skipping"
  else
    say "Adding $type/$name in $REGION"
    insta services add "$type" "$name" --region "$REGION" "$@"
  fi
}

add postgres db
add storage clips --public
# --websocket gets a larger guest and connection-based concurrency; the browser
# talks straight to Boson over WS, but the app still serves long-lived requests.
add compute app

say "Binding the database into compute"
insta secrets bind DATABASE_URL postgres/db --to compute/app \
  || warn "bind failed (self-hosted OSS answers 501 — credentials are injected already)"

if [ -n "${BOSON_API_KEY:-}" ]; then
  say "Storing BOSON_API_KEY"
  insta secrets set BOSON_API_KEY="$BOSON_API_KEY"
else
  warn "BOSON_API_KEY not in your shell — set it with: insta secrets set BOSON_API_KEY=bai-..."
fi

if [ -n "${INSTA_API_KEY:-}" ]; then
  # The app forks a branch per learner at runtime, so it needs its own token.
  insta secrets set INSTA_API_KEY="$INSTA_API_KEY"
fi
insta secrets set INSTA_REGION="$REGION"

say "Deploying"
insta deploy . --websocket

say "Done. Service URLs:"
insta services list
