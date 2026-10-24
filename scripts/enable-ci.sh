#!/usr/bin/env bash
# Installs the macOS DMG build workflow into .github/workflows/ and pushes it.
#
# This lives outside .github/workflows because the automation token used to
# create this project is not allowed to write GitHub Actions workflow files.
# Run this once, from your own machine, with your own git credentials:
#
#   bash scripts/enable-ci.sh
#
# Then trigger it:  gh workflow run "Build macOS DMG" --ref "$(git branch --show-current)"
# And download it:  gh run download --name 26.3-JM-macOS-dmg

set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .github/workflows
cp BUILD-APPS.yml .github/workflows/macos-dmg.yml

git add .github/workflows/macos-dmg.yml
if git diff --cached --quiet; then
  echo "Workflow already installed and committed."
else
  git commit -m "Enable macOS DMG build workflow"
fi

branch="$(git branch --show-current)"
echo "Pushing to origin/$branch ..."
git push origin "$branch"

cat <<EOF

Workflow installed. Next:

  gh workflow run "Build macOS DMG" --ref "$branch" -f universal=true
  gh run watch
  gh run download --name 26.3-JM-macOS-dmg -D ./out

The .dmg will be in ./out
EOF
