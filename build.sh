#!/bin/bash
# Build script — works natively in WSL/Linux
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# ---------- detect node ----------
# Prefer WSL-native node, fall back to Windows node.exe
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
    echo "ERROR: node not found. Install Node.js in WSL:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

echo "Using node: $NODE ($($NODE --version 2>/dev/null || echo 'unknown'))"

# ---------- compile ----------
TSC="./node_modules/typescript/bin/tsc"

if [ ! -f "$TSC" ]; then
    echo "ERROR: typescript not installed. Run 'npm install' first."
    exit 1
fi

case "${1:-}" in
    -w|--watch)
        echo "Watching for changes..."
        "$NODE" "$TSC" -p "$PROJECT_DIR" --watch
        ;;
    *)
        echo "Compiling..."
        "$NODE" "$TSC" -p "$PROJECT_DIR"
        echo "Build complete: $PROJECT_DIR/dist/"
        ;;
esac
