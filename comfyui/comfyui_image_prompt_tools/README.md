# ComfyUI Image Prompt Tools

Custom ComfyUI nodes that call the qwen-image-prompt HTTP API and return prompt text for `CLIP Text Encode` and similar nodes.

## Requirements

- ComfyUI with Python 3.10+
- The Next.js prompt API running (default: `http://127.0.0.1:47832`)
- LLM env vars configured in the API server for LLM-backed tools

## Install

**Recommended** — symlink the whole `comfyui/` folder:

```bash
/path/to/qwen-image-prompt/comfyui/install.sh /path/to/ComfyUI
```

Or manually:

```bash
ln -sfn /path/to/qwen-image-prompt/comfyui \
  /path/to/ComfyUI/custom_nodes/qwen-image-prompt-tools
```

**Also works** — symlink only the inner package:

```bash
ln -sfn /path/to/qwen-image-prompt/comfyui/comfyui_image_prompt_tools \
  /path/to/ComfyUI/custom_nodes/comfyui_image_prompt_tools
```

Restart ComfyUI completely after installing.

## Verify

Run with the same Python ComfyUI uses (often `ComfyUI/venv/bin/python`):

```bash
python /path/to/qwen-image-prompt/comfyui/verify_install.py
```

You should see `OK: loaded 6 node(s)`.

## Nodes not showing?

1. **Restart ComfyUI** — custom nodes load only at startup.
2. **Check the terminal** — import errors appear as `Failed to load ComfyUI custom nodes` with a traceback.
3. **Confirm the path** — the folder must be a direct child of `ComfyUI/custom_nodes/` and contain an `__init__.py`.
   - Wrong: copying the repo root or only the `comfyui/` folder without `__init__.py` (fixed in current repo).
   - Wrong: nesting under `custom_nodes/foo/bar/` with no `__init__.py` in `foo`.
4. **Search in the UI** — double-click the canvas and search `Prompt Tools` (category: **prompt tools**).
5. **Desktop ComfyUI** — custom nodes live under your ComfyUI install, e.g. `~/Documents/ComfyUI/custom_nodes/`, not inside this repo.

## Configuration

Optional environment variable on the ComfyUI host:

```bash
export COMFY_PROMPT_API_URL=http://127.0.0.1:47832
```

Each node also exposes an `api_base_url` override.

If the API runs in Docker and ComfyUI on the host, point to the published port. If ComfyUI is in Docker and the API on the host, use `http://host.docker.internal:47832`.

## Nodes

| Node | API | Output |
|------|-----|--------|
| **Prompt Tools · Generate** | `POST /api/generate` | Keywords → model-ready prompt |
| **Prompt Tools · Format** | `POST /api/format` | Draft → model-ready prompt |
| **Prompt Tools · Random Scene** | `POST /api/random-scene` | Random cohesive scene |
| **Prompt Tools · Character** | `POST /api/character` | Single-person character prompt |
| **Prompt Tools · Background** | `POST /api/background` | People-free environment |
| **Prompt Tools · Image → Prompt** | `POST /api/image-prompt` | Reference image → prompt |

All nodes output a single `prompt` string.

## Workflow

1. Start the prompt API (`npm run dev` or Docker).
2. Add a node from category **prompt tools**.
3. Connect its `prompt` output to the `text` input of your encoder node (`CLIP Text Encode`, `CLIP Text Encode (Flux)`, `TextEncodeQwenImageEditPlus`, etc.).
4. Match the node's **model** setting to the checkpoint you are using.

## Example

`Prompt Tools · Generate` → `CLIP Text Encode (Prompt)` → KSampler

Use **positive** mode for scene prompts and **negative** mode for preserve/negative conditioning where supported.
