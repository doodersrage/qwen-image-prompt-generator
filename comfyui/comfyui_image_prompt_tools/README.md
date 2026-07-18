# ComfyUI Image Prompt Tools

Custom ComfyUI nodes that call the [qwen-image-prompt](https://github.com/) HTTP API and return prompt text for `CLIP Text Encode` and similar nodes.

## Requirements

- ComfyUI with Python 3.10+
- The Next.js prompt API running (default: `http://127.0.0.1:47832`)
- LLM env vars configured in the API server for LLM-backed tools

## Install

Copy or symlink this folder into your ComfyUI `custom_nodes` directory:

```bash
ln -s /path/to/qwen-image-prompt/comfyui/comfyui_image_prompt_tools \
  /path/to/ComfyUI/custom_nodes/comfyui_image_prompt_tools
```

Restart ComfyUI.

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
