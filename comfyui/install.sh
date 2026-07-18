#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: install.sh [--copy|--link] /path/to/ComfyUI

Installs the Prompt Tools ComfyUI custom nodes from this repo.

  --copy   Copy files into custom_nodes/ (required for /opt/comfyui on this machine)
  --link   Symlink this repo's comfyui/ folder (only if ComfyUI can read your home dir)
  (default) Use --copy when the ComfyUI service user cannot read the repo path

Examples:
  sudo ./comfyui/install.sh --copy /opt/comfyui
  ./comfyui/install.sh --link ~/comfy/ComfyUI
EOF
}

MODE="auto"
COMFYUI_ARG=""

for arg in "$@"; do
  case "$arg" in
    --copy) MODE="copy" ;;
    --link) MODE="link" ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [ -n "$COMFYUI_ARG" ]; then
        echo "Unexpected argument: $arg" >&2
        usage >&2
        exit 1
      fi
      COMFYUI_ARG="$arg"
      ;;
  esac
done

if [ -z "$COMFYUI_ARG" ]; then
  usage >&2
  exit 1
fi

COMFYUI_ROOT="$(cd "$COMFYUI_ARG" && pwd)"
CUSTOM_NODES="$COMFYUI_ROOT/custom_nodes"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INNER="$SRC/comfyui_image_prompt_tools"
TARGET_NAME="comfyui_image_prompt_tools"
TARGET="$CUSTOM_NODES/$TARGET_NAME"
LEGACY_LINK="$CUSTOM_NODES/qwen-image-prompt-tools"

if [ ! -d "$COMFYUI_ROOT" ]; then
  echo "Error: ComfyUI path not found: $COMFYUI_ROOT" >&2
  exit 1
fi

if [ ! -d "$INNER" ]; then
  echo "Error: node package not found: $INNER" >&2
  exit 1
fi

comfyui_service_user() {
  if command -v pgrep >/dev/null 2>&1; then
    local pid
    pid="$(pgrep -f '/opt/comfyui/main.py' | head -1 || true)"
    if [ -n "$pid" ] && [ -r "/proc/$pid/status" ]; then
      awk '/^Uid:/ {print $2}' "/proc/$pid/status" | xargs -I{} getent passwd {} | cut -d: -f1
      return
    fi
  fi
  if id comfy >/dev/null 2>&1; then
    echo "comfy"
  fi
}

service_user_can_read() {
  local user="$1"
  local path="$2"
  if [ -z "$user" ]; then
    return 0
  fi
  if [ "$(id -un)" = "$user" ]; then
    test -r "$path"
    return
  fi
  if command -v sudo >/dev/null 2>&1; then
    sudo -u "$user" test -r "$path" 2>/dev/null
    return
  fi
  return 0
}

SERVICE_USER="$(comfyui_service_user || true)"

if [ "$MODE" = "auto" ]; then
  if service_user_can_read "$SERVICE_USER" "$INNER/__init__.py"; then
    MODE="link"
  else
    MODE="copy"
  fi
fi

if [ ! -w "$CUSTOM_NODES" ] 2>/dev/null; then
  echo "Error: cannot write to $CUSTOM_NODES" >&2
  echo "Re-run with sudo, for example:" >&2
  echo "  sudo $0 --copy $COMFYUI_ROOT" >&2
  exit 1
fi

mkdir -p "$CUSTOM_NODES"

if [ "$MODE" = "copy" ]; then
  echo "Installing with copy (ComfyUI user must be able to read files under $CUSTOM_NODES)"
  rm -f "$LEGACY_LINK"
  rm -rf "$TARGET"
  cp -a "$INNER" "$TARGET"

  if [ -n "$SERVICE_USER" ]; then
    chown -R "$SERVICE_USER:$SERVICE_USER" "$TARGET" 2>/dev/null || true
  fi

  echo "Installed: $TARGET"
else
  echo "Installing with symlink"
  rm -rf "$TARGET"
  rm -f "$LEGACY_LINK"
  ln -sfn "$SRC" "$LEGACY_LINK"
  echo "Installed: $LEGACY_LINK -> $SRC"

  if ! service_user_can_read "$SERVICE_USER" "$SRC/__init__.py"; then
    echo
    echo "WARNING: ComfyUI user${SERVICE_USER:+ ($SERVICE_USER)} cannot read $SRC." >&2
    echo "Symlinks into your home directory will fail at import time." >&2
    echo "Re-run with --copy instead:" >&2
    echo "  sudo $0 --copy $COMFYUI_ROOT" >&2
  fi
fi

echo

if command -v pgrep >/dev/null 2>&1; then
  RUNNING_MAIN="$(pgrep -af 'main.py' 2>/dev/null | rg 'comfyui|ComfyUI' | head -1 || true)"
  if [ -n "$RUNNING_MAIN" ]; then
    echo "Running ComfyUI process:"
    echo "  $RUNNING_MAIN"
    if echo "$RUNNING_MAIN" | rg -q "$COMFYUI_ROOT"; then
      echo "  ✓ Install path matches the running ComfyUI."
    else
      echo "  ⚠ Install path does NOT match the running ComfyUI."
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
echo "If nodes still do not appear, check /opt/comfyui/user/comfyui_8188.log for:"
echo "  IMPORT FAILED ... comfyui_image_prompt_tools"
