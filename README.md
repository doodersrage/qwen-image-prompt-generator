# ComfyUI Image Prompt Tools

A Next.js app that turns topics or keywords into model-specific prompts for ComfyUI image workflows, and reformats existing drafts for any supported architecture.

## Supported models

The app includes **40+ ComfyUI image model targets**, grouped by architecture family:

| Family | Examples | Prompt style |
|--------|----------|--------------|
| **Stable Diffusion** | SD 1.5, SD 2.0, SD 2.1 | Short weighted tags or brief phrases |
| **SDXL** | SDXL Base, Refiner, SSD-1B, Segmind Vega | Natural-language scene descriptions |
| **SD3 / AuraFlow** | SD3 Medium/Large, SD 3.5, AuraFlow | Longer NLP; quote visible text in `"quotes"` |
| **Flux / Chroma** | FLUX Dev/Schnell/2/Klein, Chroma | Subject-first photographic prose |
| **Qwen Image** | Edit, Edit-2511, Image-2512, Image-2.0 | Edit instructions or factual/rich T2I prose |
| **Hunyuan / HiDream** | Hunyuan DiT, Hunyuan Image 2.1, HiDream | Descriptive unified scene prose |
| **Other DiT** | PixArt, Lumina 2, Z-Image, OmniGen2, Kandinsky 5, Stable Cascade | Architecture-tuned NLP or instructions |
| **Instruct / Edit** | SD1.5/SDXL InstructPix2Pix, Lotus-D | Short imperative edit instructions |

Use the **search + category filter** in the UI to pick a model. Each entry shows its ComfyUI node name (e.g. `CLIP Text Encode (Flux)`, `TextEncodeQwenImageEditPlus`).

Video, audio, and 3D-only architectures (WAN, Hunyuan Video, Stable Audio, etc.) are not included—their prompt semantics differ from static image generation.

## Tools

| Page | Route | Purpose |
|------|-------|---------|
| **Generate** | `/` | Turn keywords into a model-ready prompt |
| **Format** | `/format` | Adapt an existing prompt draft for a selected model |

## Features

- Searchable model picker with architecture-family filters
- Profile-based prompt styles shared across related checkpoints
- Prompt detail levels (Concise / Balanced / Rich) with **combined model × detail size limits**
- Minimum character enforcement for long-form models (Image-2.0 Rich, FLUX Rich, etc.)
- Positive and negative/preserve prompt modes
- Uncensored system prompts (no content filtering or refusals)
- One-click copy for ComfyUI paste
- LLM-powered generation/formatting with rules fallback

## Prompt size limits (selected models)

Limits are enforced per **model × detail** combination. All models have Concise / Balanced / Rich presets; long-form models also enforce `minChars`:

| Detail | Qwen-Image-Edit | Edit-2511 | Image-2512 | Image-2.0 | FLUX.2 Klein | SDXL | SD1.5 |
|--------|-----------------|-----------|------------|-----------|--------------|------|-------|
| Concise | ~280 chars | ~220 chars | ~320 chars | ~400 chars | ~250 chars | ~280 chars | ~220 chars |
| Balanced | ~520 chars | ~420 chars | ~380–650 chars | ~550–800 chars | ~450–700 chars | ~520 chars | ~380 chars |
| Rich | ~920 chars | ~680 chars | **700–1000 chars** | **1100–1400 chars** | **900–1200 chars** | ~780 chars | ~520 chars |

Other families use limits tuned to their encoder (see `src/lib/comfy-models/limits.ts`).

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## LLM configuration

The generator calls any **OpenAI-compatible** chat completions API. Configure via `.env.local`:

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_BASE_URL` | `http://localhost:11434/v1` | API base URL |
| `LLM_API_KEY` | _(empty)_ | Bearer token if required |
| `LLM_MODEL` | `dolphin-llama3` | Model name |
| `LLM_TEMPERATURE` | `0.95` | Sampling temperature (higher = more variation) |
| `LLM_ENABLED` | `true` | Set `false` for template-only mode |
| `ALLOW_TEMPLATE_FALLBACK` | `true` | Fall back if LLM is unreachable |

### Ollama (local, uncensored)

```bash
ollama pull dolphin-llama3
```

```env
LLM_API_BASE_URL=http://localhost:11434/v1
LLM_MODEL=dolphin-llama3
```

## Prompt format examples

**SDXL (Balanced):**

> A narrow cyberpunk alley at midnight, rain-slick asphalt mirroring magenta and cyan neon signs. Steam curls from sidewalk grates between cracked pavement. A sleek black cat crouches on a rusted fire escape, amber eyes catching a stray beam of light.

**Qwen-Image-Edit-2511 (Balanced):**

> Keep the subject's facial features, pose, and proportions unchanged. Replace the background with a gothic cathedral interior, candle flames cutting through low fog above worn flagstones.

**FLUX.2 Klein (Rich):**

> A sleek black cat crouches on a rusted fire escape… [subject first, named materials, photographic lighting, camera/composition detail]

**SD1.5 (Concise):**

> neon alley, rain, black cat, cyberpunk, night, wet pavement

Use **Negative / Preserve** mode for protective conditioning. **Note:** FLUX models ignore negative prompts—the generator outputs positive preservation phrasing instead.

## HTTP API

All endpoints return **JSON** (`Content-Type: application/json`) and support **CORS** (`Access-Control-Allow-Origin: *`) for use from scripts, ComfyUI custom nodes, or other apps.

### Discovery

```bash
# API catalog: tools, request/response shapes, curl examples
curl -sS http://localhost:3000/api | jq .

# Supported models (47 targets) with limits per detail level
curl -sS http://localhost:3000/api/models | jq .

# Filter by family or fetch one model
curl -sS "http://localhost:3000/api/models?category=flux" | jq .
curl -sS "http://localhost:3000/api/models?id=sdxl" | jq .
```

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api` | GET | API catalog and schema documentation |
| `/api/models` | GET | List models (`?category=`, `?id=`) |
| `/api/generate` | POST | Keywords → model-ready prompt |
| `/api/format` | POST | Existing draft → model-ready prompt |

Errors use a consistent shape: `{ "error": "message" }` with an appropriate HTTP status (400, 404, 405, 500).

### Format API

```bash
curl -X POST http://localhost:3000/api/format \
  -H "Content-Type: application/json" \
  -d '{"input":"1girl, neon alley, rain, masterpiece","model":"flux-2-klein","detail":"balanced","smartFormat":true}'
```

Set `"smartFormat": false` for instant rules-only cleanup (no LLM).

## Generate API

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"input":"neon alley, rain, black cat","mode":"positive","model":"sdxl","detail":"balanced"}'
```

Response:

```json
{
  "prompt": "...",
  "mode": "positive",
  "provider": "llm",
  "model": "sdxl",
  "comfyNode": "CLIP Text Encode (Prompt)",
  "limits": {
    "maxChars": 520,
    "maxSentences": 3,
    "maxTokens": 380
  }
}
```

Model IDs match the registry in `src/lib/comfy-models/registry.ts`.
