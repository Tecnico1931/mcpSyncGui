#!/usr/bin/env bash
# Download rulesync sidecar binaries from latest GitHub release.
# Run once after cloning: bash scripts/download-binaries.sh

set -e

REPO="dyoshikawa/rulesync"
DEST="src-tauri/binaries"
VERSION=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['tag_name'])")

echo "Downloading rulesync $VERSION binaries..."
mkdir -p "$DEST"

download() {
  local src=$1 dst=$2
  echo "  → $dst"
  curl -fsSL -o "$DEST/$dst" \
    "https://github.com/$REPO/releases/download/$VERSION/$src"
}

download "rulesync-darwin-arm64"   "rulesync-aarch64-apple-darwin"
download "rulesync-darwin-x64"     "rulesync-x86_64-apple-darwin"
download "rulesync-linux-x64"      "rulesync-x86_64-unknown-linux-gnu"
download "rulesync-windows-x64.exe" "rulesync-x86_64-pc-windows-msvc.exe"

# chmod only applies on Unix; safe to skip on Windows
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
  chmod +x "$DEST/rulesync-aarch64-apple-darwin" \
           "$DEST/rulesync-x86_64-apple-darwin" \
           "$DEST/rulesync-x86_64-unknown-linux-gnu"
fi

echo "Done."
