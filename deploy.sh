#!/usr/bin/env bash
# deploy.sh — push code and trigger an EAS iOS build in one command
# Usage:  ./deploy.sh           (development build, default)
#         ./deploy.sh preview   (preview/ad-hoc build)
#         ./deploy.sh prod      (production build)

set -e

PROFILE="${1:-development}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "▶ Pushing to GitHub…"
cd "$ROOT"
git push origin main

echo "▶ Triggering EAS build (profile: $PROFILE)…"
cd "$ROOT/app"
eas build --platform ios --profile "$PROFILE" --non-interactive

echo "✅ Done. Check https://expo.dev for build status."
