#!/usr/bin/env python3
"""Verify the ComfyUI custom node package imports with your Python interpreter."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def load_package(name: str, path: Path):
    init = path / "__init__.py"
    if not init.exists():
        raise FileNotFoundError(f"Missing {init}")

    spec = importlib.util.spec_from_file_location(
        name,
        init,
        submodule_search_locations=[str(path)],
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load package from {path}")

    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


def check_package(label: str, path: Path) -> bool:
    print(f"\n=== {label} ===")
    print(f"Path: {path}")
    try:
        module = load_package(path.name.replace("-", "_"), path)
        mappings = getattr(module, "NODE_CLASS_MAPPINGS", None)
        if not isinstance(mappings, dict) or not mappings:
            print("FAIL: NODE_CLASS_MAPPINGS is missing or empty.")
            return False

        print(f"OK: loaded {len(mappings)} node(s)")
        for node_id, node_cls in mappings.items():
            display = getattr(module, "NODE_DISPLAY_NAME_MAPPINGS", {}).get(
                node_id,
                node_id,
            )
            category = getattr(node_cls, "CATEGORY", "?")
            print(f"  - {display} [{node_id}] category={category}")
        return True
    except Exception as error:
        print(f"FAIL: {error}")
        return False


def main() -> int:
    repo_comfyui = Path(__file__).resolve().parent
    inner = repo_comfyui / "comfyui_image_prompt_tools"

    ok_outer = check_package("Whole comfyui/ folder install", repo_comfyui)
    ok_inner = check_package("Inner comfyui_image_prompt_tools/ install", inner)

    if ok_outer or ok_inner:
        print("\nImport check passed. Restart ComfyUI and search for 'Prompt Tools'.")
        return 0

    print("\nImport check failed. Use the Python from your ComfyUI venv and read the traceback above.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
