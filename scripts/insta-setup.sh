#!/usr/bin/env bash
# Provision and deploy Mother Tongue on InstaCloud, in the Singapore region.
#
# CONTAINMENT (see README "Keeping the tooling contained"):
#   * the CLI is never installed globally — every call goes through `pnpm dlx`
#   * HOME is redirected into ./.insta-home, so the account token lands inside
#     the repo (gitignored) instead of ~/.insta
#   * `insta project create|link` installs 24 vendor SKILL.md files and a
#     PostToolUse hook into .claude/, .agents/, .github/skills and .codex/ with
#     no opt-out flag, so we scrub them after every call that can write them
#
# Region is fixed at service-creation time and there is no multi-region, so the
# services must be created with --region before anything else. Re-running is
# safe: services that already exist are left alone.
#
# Verified against insta CLI 0.1.0.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

INSTA_HOME="$ROOT/.insta-home"
mkdir -p "$INSTA_HOME"

say() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }

# Remove everything the CLI injects into the repo. Cheap, so run it liberally.
scrub() {
  rm -rf "$ROOT/.claude/skills" "$ROOT/.agents" "$ROOT/.github/skills" \
         "$ROOT/skills-lock.json" "$ROOT/.codex/hooks.json"
  # .claude/settings.json is only ever the insta PostToolUse hook here; drop it
  # if that is all it contains, and leave it alone if you have added your own.
  if [ -f "$ROOT/.claude/settings.json" ] \
     && grep -q '_insta' "$ROOT/.claude/settings.json" \
     && ! grep -qv '_insta\|hooks\|PostToolUse\|matcher\|command\|timeout\|type\|[]{},[]' "$ROOT/.claude/settings.json"; then
    rm -f "$ROOT/.claude/settings.json"
  fi
  rmdir "$ROOT/.claude" "$ROOT/.codex" "$ROOT/.github" 2>/dev/null || true
}

# Every CLI call: sandboxed HOME, no global install, scrub afterwards.
insta() {
  HOME="$INSTA_HOME" USERPROFILE="$INSTA_HOME" \
    pnpm dlx insta@latest "$@"
  local status=$?
  scrub
  return $status
}

trap scrub EXIT

if [ -z "${INSTA_API_KEY:-}" ]; then
  warn "INSTA_API_KEY is not set — export it first (it is never written to ~)."
  exit 1
fi
insta login --api-key "$INSTA_API_KEY"

PROJECT="${INSTA_PROJECT:-mother-tongue}"
if [ -n "${INSTA_PROJECT_ID:-}" ]; then
  say "Linking project $INSTA_PROJECT_ID"
  insta project link "$INSTA_PROJECT_ID"
else
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

# The app forks a branch per learner at runtime, so the container needs a token.
insta secrets set INSTA_API_KEY "$INSTA_API_KEY"
insta secrets set INSTA_REGION "$REGION"

say "Deploying (--websocket: larger guest + connection-based concurrency)"
insta deploy . --websocket

say "Done."
insta services list

cat <<EOF

The account token is in .insta-home/.insta/config.json (gitignored, inside the
repo). To revoke this machine's session entirely:

  rm -rf "$INSTA_HOME"
EOF
