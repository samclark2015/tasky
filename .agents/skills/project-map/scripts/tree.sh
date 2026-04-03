#!/usr/bin/env bash
# Wrapper — delegates to tree.js (Node.js, no external dependencies).
# Run from anywhere inside the repo.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/tree.js" "$@"
