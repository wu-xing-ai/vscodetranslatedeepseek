#!/bin/bash
# Package the extension into .vsix
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Detect node
detect_node() {
    if command -v node &>/dev/null; then
        echo "node"
        return
    fi
    local win_node="/mnt/c/Program Files/nodejs/node.exe"
    if [ -f "$win_node" ]; then
        echo "$win_node"
        return
    fi
    echo ""
}

NODE=$(detect_node)
if [ -z "$NODE" ]; then
    echo "ERROR: node not found"
    exit 1
fi

echo "Building first..."
bash "$PROJECT_DIR/build.sh"

echo "Packaging..."
VSCE="$PROJECT_DIR/node_modules/@vscode/vsce/out/vsce.js"
if [ ! -f "$VSCE" ]; then
    echo "ERROR: @vscode/vsce not installed. Run: npm install"
    exit 1
fi

"$NODE" "$VSCE" package --cwd "$PROJECT_DIR"

echo ""
echo "Done! .vsix file in: $PROJECT_DIR"
ls -la "$PROJECT_DIR"/*.vsix
