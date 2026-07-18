#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 /path/to/ComfyUI"
  echo
  echo "Links this repo's comfyui/ folder into ComfyUI/custom_nodes/qwen-image-prompt-tools"
  exit 1
fi

COMFYUI_ROOT="$1"
CUSTOM_NODES="$COMFYUI_ROOT/custom_nodes"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$CUSTOM_NODES/qwen-image-prompt-tools"

mkdir -p "$CUSTOM_NODES"
ln -sfn "$SRC" "$TARGET"

echo "Installed: $TARGET -> $SRC"
echo
echo "Next steps:"
echo "  1. Restart ComfyUI completely"
echo "  2. In the node menu, search for: Prompt Tools"
echo "  3. Start the prompt API: npm run dev (http://127.0.0.1:47832)"
echo
echo "Verify import with ComfyUI's Python:"
echo "  $COMFYUI_ROOT/venv/bin/python $SRC/verify_install.py"
