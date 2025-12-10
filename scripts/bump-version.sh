#!/usr/bin/env bash
# Version bump script for Focus GTD monorepo
# Usage: ./scripts/bump-version.sh 0.2.5
#        ./scripts/bump-version.sh  (prompts for version)

set -e

if [ -n "$1" ]; then
    NEW_VERSION="$1"
else
    echo "Current versions:"
    grep '"version"' package.json apps/*/package.json packages/*/package.json apps/mobile/app.json apps/desktop/src-tauri/tauri.conf.json 2>/dev/null | head -10
    echo ""
    read -p "Enter new version (e.g., 0.2.5): " NEW_VERSION
fi

if [ -z "$NEW_VERSION" ]; then
    echo "Error: Version cannot be empty"
    exit 1
fi

# Use Node.js script for safe JSON updates
node scripts/update-versions.js "$NEW_VERSION"

echo ""
echo "Done! Now you can:"
echo "  git add -A"
echo "  git commit -m 'chore(release): v$NEW_VERSION'"
echo "  git tag v$NEW_VERSION"
echo "  git push origin main --tags"
