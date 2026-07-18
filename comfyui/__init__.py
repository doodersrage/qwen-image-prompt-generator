"""ComfyUI custom nodes for the qwen-image-prompt HTTP API.

Install by symlinking this entire `comfyui` folder into ComfyUI/custom_nodes/, e.g.:

  ln -s /path/to/qwen-image-prompt/comfyui \\
        /path/to/ComfyUI/custom_nodes/qwen-image-prompt-tools

Alternatively symlink only the inner package:

  ln -s /path/to/qwen-image-prompt/comfyui/comfyui_image_prompt_tools \\
        /path/to/ComfyUI/custom_nodes/comfyui_image_prompt_tools
"""

try:
    from .comfyui_image_prompt_tools import (
        NODE_CLASS_MAPPINGS,
        NODE_DISPLAY_NAME_MAPPINGS,
    )
except Exception:
    import traceback

    print(
        "\n[qwen-image-prompt-tools] Failed to load ComfyUI custom nodes:\n",
        flush=True,
    )
    traceback.print_exc()
    raise

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
