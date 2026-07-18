#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" = "" ]; then
  echo "Usage: $0 /path/to/ComfyUI"
  echo
  echo "Links this repo's comfyui/ folder into ComfyUI/custom_nodes/qwen-image-prompt-tools"
  echo
  echo "Example (this machine's running ComfyUI):"
  echo "  $0 /opt/comfyui"
  exit 1
fi

COMFYUI_ROOT="$(cd "$1" && pwd)"
CUSTOM_NODES="$COMFYUI_ROOT/custom_nodes"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$CUSTOM_NODES/qwen-image-prompt-tools"

if [ ! -d "$COMFYUI_ROOT" ]; then
  echo "Error: ComfyUI path not found: $COMFYUI_ROOT" >&2
  exit 1
fi

mkdir -p "$CUSTOM_NODES"
ln -sfn "$SRC" "$TARGET"

echo "Installed: $TARGET -> $SRC"
echo

RUNNING_PATH=""
if command -v pgrep >/dev/null 2>&1; then
  RUNNING_MAIN="$(pgrep -af 'main.py' 2>/dev/null | rg 'comfyui|ComfyUI' | head -1 || true)"
  if [ -n "$RUNNING_MAIN" ]; then
    echo "Running ComfyUI process:"
    echo "  $RUNNING_MAIN"
    if echo "$RUNNING_MAIN" | rg -q "$COMFYUI_ROOT"; then
      echo "  ✓ Install path matches the running ComfyUI."
    else
      echo "  ⚠ Install path does NOT match the running ComfyUI."
      echo "    You likely installed to the wrong copy. Re-run with the path shown above."
      if echo "$RUNNING_MAIN" | rg -q '/opt/comfyui'; then
        echo "    Try: $0 /opt/comfyui"
      fi
    fi
    echo
  fi
fi

PYTHON_BIN=""
for candidate in \
  "$COMFYUI_ROOT/venv/bin/python" \
  "/opt/comfyui/venv/bin/python" \
  "$(command -v python3)"
do
  if [ -x "$candidate" ]; then
    PYTHON_BIN="$candidate"
    break
  fi
done

if [ -n "$PYTHON_BIN" ]; then
  echo "Verifying import with: $PYTHON_BIN"
  "$PYTHON_BIN" "$SRC/verify_install.py" || true
  echo
fi

echo "Next steps:"
echo "  1. Fully restart ComfyUI (browser reload is not enough)"
echo "  2. In the node menu, search for: Prompt Tools"
echo "  3. Start the prompt API: npm run dev (http://127.0.0.1:47832)"
echo
echo "If nodes still do not appear, check the ComfyUI terminal/log for:"
echo "  IMPORT FAILED ... qwen-image-prompt-tools"
