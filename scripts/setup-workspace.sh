#!/usr/bin/env bash
#
# Set up a pnpm workspace with Braid and OpenClaw as sibling packages.
#
# Usage:
#   # From an empty parent directory:
#   git clone git@github.com:ZilinIB/braid.git braid
#   ./braid/scripts/setup-workspace.sh
#
#   # Or from an existing directory with both repos already cloned:
#   ./braid/scripts/setup-workspace.sh
#
# The script is idempotent — safe to run again if you add new dependencies.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "Workspace root: $WORKSPACE_DIR"
cd "$WORKSPACE_DIR"

# Clone OpenClaw if not present
if [ ! -d openclaw ]; then
  echo "Cloning OpenClaw..."
  git clone git@github.com:openclaw/openclaw.git openclaw
else
  echo "OpenClaw already present."
fi

# Verify braid exists (it should — this script lives inside it)
if [ ! -d braid ]; then
  echo "Error: braid/ not found in $WORKSPACE_DIR"
  exit 1
fi

# Create workspace root package.json if missing
if [ ! -f package.json ]; then
  echo "Creating workspace package.json..."
  cat > package.json << 'PKGJSON'
{
  "private": true,
  "scripts": {
    "test": "pnpm -r run test",
    "build": "pnpm -r run build"
  }
}
PKGJSON
else
  echo "Workspace package.json already exists."
fi

# Create pnpm-workspace.yaml if missing
if [ ! -f pnpm-workspace.yaml ]; then
  echo "Creating pnpm-workspace.yaml..."
  cat > pnpm-workspace.yaml << 'YAML'
packages:
  - openclaw
  - braid
YAML
else
  echo "pnpm-workspace.yaml already exists."
fi

# Create .gitignore for workspace root (don't track workspace config in either repo)
if [ ! -f .gitignore ]; then
  cat > .gitignore << 'GI'
node_modules/
GI
fi

# Install dependencies
echo "Installing dependencies..."
if command -v pnpm &> /dev/null; then
  pnpm install
elif command -v npm &> /dev/null; then
  echo "(pnpm not found, using npm)"
  cd braid && npm install && cd ..
else
  echo "Warning: neither pnpm nor npm found. Run 'npm install' in braid/ manually."
fi

echo ""
echo "Workspace ready."
echo "  openclaw/ — $(cd openclaw && git log --oneline -1)"
echo "  braid/    — $(cd braid && git log --oneline -1)"
echo ""
echo "Next steps:"
echo "  cd braid && npm test              # run Braid tests"
echo "  cd braid && npm run braid validate  # validate the manifest"
