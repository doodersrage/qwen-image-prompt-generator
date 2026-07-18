# ComfyUI Image Prompt Tools

Custom ComfyUI nodes that call the qwen-image-prompt HTTP API and return prompt text for `CLIP Text Encode` and similar nodes.

## Requirements

- ComfyUI with Python 3.10+
- The Next.js prompt API running (default: `http://127.0.0.1:47832`)
- LLM env vars configured in the API server for LLM-backed tools

## Install

**Install into the ComfyUI you actually run.** If you have multiple copies (e.g. `~/comfy/ComfyUI` and `/opt/comfyui`), only the running one loads custom nodes.

Recommended:

```bash
/path/to/qwen-image-prompt/comfyui/install.sh /opt/comfyui
```

Or manually:

```bash
ln -sfn /path/to/qwen-image-prompt/comfyui \
  /opt/comfyui/custom_nodes/qwen-image-prompt-tools
```

Restart ComfyUI completely after installing (a browser reload is not enough).

## Verify

Run with the same Python ComfyUI uses (often `ComfyUI/venv/bin/python`):

```bash
python /path/to/qwen-image-prompt/comfyui/verify_install.py
```

You should see `OK: loaded 6 node(s)`.

## Nodes not showing?

1. **Wrong ComfyUI folder** — Most common issue. Check which server is running:
   ```bash
   pgrep -af 'main.py' | rg -i comfy
   ```
   Install into that path's `custom_nodes/` (on this machine, often `/opt/comfyui`, not `~/comfy/ComfyUI`).

2. **Restart ComfyUI** — custom nodes load only at startup. Reloading the browser tab is not enough.

3. **Check the terminal/log** — import errors appear as `IMPORT FAILED` or `Cannot import ... qwen-image-prompt-tools`.

4. **Search in the UI** — double-click the canvas and search `Prompt Tools` (category: **prompt tools**).

5. **Verify import**:
   ```bash
   /opt/comfyui/venv/bin/python /path/to/qwen-image-prompt/comfyui/verify_install.py
   ```

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
