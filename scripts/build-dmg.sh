#!/usr/bin/env bash
# One-command macOS DMG build for 26.3-JM.
#
#   bash scripts/build-dmg.sh            # Universal (Apple Silicon + Intel)
#   bash scripts/build-dmg.sh --native   # this Mac's architecture only (≈2x faster)
#
# Requirements: macOS 11+, Xcode command line tools, Node 20+, Rust (https://rustup.rs)

set -euo pipefail
cd "$(dirname "$0")/.."

UNIVERSAL=1
[[ "${1:-}" == "--native" ]] && UNIVERSAL=0

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die()  { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || die "A .dmg can only be produced on macOS."
command -v node  >/dev/null || die "Node 20+ is required: https://nodejs.org"
command -v cargo >/dev/null || die "Rust is required: https://rustup.rs"
xcode-select -p >/dev/null 2>&1 || die "Xcode command line tools missing: xcode-select --install"

if [[ $UNIVERSAL -eq 1 ]]; then
  step "Ensuring both Rust targets are installed"
  rustup target add aarch64-apple-darwin x86_64-apple-darwin
fi

step "Installing JS tooling"
npm install --no-audit --no-fund

step "Fetching and preparing the game payload (~86 MB, cached in .game-cache/)"
node scripts/prepare-game.mjs

step "Generating application icons"
npx tauri icon assets/app-icon.png

if [[ $UNIVERSAL -eq 1 ]]; then
  step "Building Universal .dmg (this takes a while — two full optimised builds)"
  npx tauri build --target universal-apple-darwin --bundles dmg
else
  step "Building native-arch .dmg"
  npx tauri build --bundles dmg
fi

step "Result"
mkdir -p out
find src-tauri/target -name '*.dmg' -exec cp {} out/ \;
ls -lh out/*.dmg
shasum -a 256 out/*.dmg

cat <<'EOF'

Done. The .dmg is in ./out

The app is not notarised, so after installing run:
  xattr -dr com.apple.quarantine /Applications/26.3-JM.app
EOF
