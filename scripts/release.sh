#!/usr/bin/env bash
# Local release script — builds macOS universal binary and publishes to GitHub Releases.
# Usage: bash scripts/release.sh
#
# Requirements:
#   - Rust toolchain (aarch64-apple-darwin + x86_64-apple-darwin targets)
#   - Node.js + npm
#   - gh CLI (authenticated)
#   - lipo (comes with Xcode Command Line Tools)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ── 1. Compute version (YEAR.MONTH.NN) ────────────────────────────────────────
YEAR=$(date -u +%Y)
MONTH=$(date -u +%m)
PREFIX="${YEAR}.${MONTH}"

COUNT=$(gh release list --limit 200 --json tagName \
  --jq "[.[].tagName | select(startswith(\"v${PREFIX}.\"))] | length" \
  2>/dev/null || echo "0")

N=$((COUNT + 1))
VERSION="${PREFIX}.$(printf '%02d' $N)"
TAG="v${VERSION}"

echo "▶ Version: ${TAG}"

# ── 2. Download rulesync sidecar binaries ─────────────────────────────────────
echo "▶ Downloading rulesync binaries…"
bash scripts/download-binaries.sh

# ── 3. Create universal sidecar (lipo arm64 + x64) ───────────────────────────
echo "▶ Creating universal rulesync sidecar…"
lipo -create \
  src-tauri/binaries/rulesync-aarch64-apple-darwin \
  src-tauri/binaries/rulesync-x86_64-apple-darwin \
  -output src-tauri/binaries/rulesync-universal-apple-darwin
chmod +x src-tauri/binaries/rulesync-universal-apple-darwin

# ── 4. Ensure Rust targets are installed ──────────────────────────────────────
echo "▶ Checking Rust targets…"
rustup target add aarch64-apple-darwin x86_64-apple-darwin 2>/dev/null || true

# ── 5. Install JS deps ────────────────────────────────────────────────────────
echo "▶ Installing JS dependencies…"
npm ci --silent

# ── 6. Build Tauri universal app ──────────────────────────────────────────────
echo "▶ Building macOS universal app (this takes a few minutes)…"
npm run tauri build -- --target universal-apple-darwin

# ── 7. Locate build artifacts ─────────────────────────────────────────────────
BUNDLE_DIR="src-tauri/target/universal-apple-darwin/release/bundle"
DMG=$(find "$BUNDLE_DIR/dmg" -name "*.dmg" | head -1)
APP_TAR=$(find "$BUNDLE_DIR/macos" -name "*.tar.gz" | head -1)

if [ -z "$DMG" ]; then
  echo "✗ DMG not found in $BUNDLE_DIR/dmg" >&2
  exit 1
fi

echo "  DMG:    $DMG"
[ -n "$APP_TAR" ] && echo "  App.tar: $APP_TAR"

# ── 8. Create GitHub release and upload artifacts ─────────────────────────────
echo "▶ Creating GitHub release ${TAG}…"

RELEASE_NOTES="## rulesync GUI ${VERSION}

Desktop GUI for [rulesync](https://github.com/dyoshikawa/rulesync) — generate AI coding agent configs for Claude Code, Cursor, Copilot, and more.

### Downloads

| Platform | Installer |
|----------|-----------|
| macOS (Apple Silicon + Intel) | \`.dmg\` universal |

> **macOS:** If Gatekeeper blocks the app, right-click → Open."

gh release create "$TAG" \
  --title "$TAG" \
  --notes "$RELEASE_NOTES" \
  "$DMG" \
  ${APP_TAR:+"$APP_TAR"}

echo "✓ Released ${TAG}"
echo "  https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/tag/${TAG}"
