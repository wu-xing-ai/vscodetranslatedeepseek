#!/bin/bash
# Publish the extension to the VS Code Marketplace.
#
# Prerequisites:
#   1. A Personal Access Token (PAT) with "Marketplace: Manage" scope from
#      https://dev.azure.com  (create via User settings -> Personal access tokens)
#   2. The publisher "aitranslate" must exist on the marketplace and match
#      the "publisher" field in package.json.
#
# Usage:
#   VSCE_PAT=xxxxxxxx bash publish.sh
#   or:  npx vsce login aitranslate   (then run without VSCE_PAT)
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

detect_node() {
    if command -v node &>/dev/null; then echo "node"; return; fi
    local win_node="/mnt/c/Program Files/nodejs/node.exe"
    if [ -f "$win_node" ]; then echo "$win_node"; return; fi
    echo ""
}

NODE=$(detect_node)
if [ -z "$NODE" ]; then
    echo "ERROR: node not found"
    exit 1
fi

# .npmrc may set a Windows-only `script-shell` (bash.exe). When running
# under WSL/Linux that path does not exist, so override it for this run.
if grep -qi 'script-shell.*bash\.exe' "$PROJECT_DIR/.npmrc" 2>/dev/null; then
    export NPM_CONFIG_SCRIPT_SHELL=/bin/bash
fi

VSCE="$PROJECT_DIR/node_modules/@vscode/vsce/vsce"
if [ ! -f "$VSCE" ]; then
    VSCE="$PROJECT_DIR/node_modules/.bin/vsce"
fi
if [ ! -f "$VSCE" ]; then
    echo "ERROR: @vscode/vsce not installed. Run: npm install"
    exit 1
fi

echo "Building..."
bash "$PROJECT_DIR/build.sh"

echo "Publishing to VS Code Marketplace..."
"$NODE" "$VSCE" publish "$@"

echo "Done! Published."
