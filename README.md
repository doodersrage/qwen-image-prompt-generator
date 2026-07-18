# Qwen Image Prompt Generator

A Next.js app that turns topics or keywords into model-specific prompts for ComfyUI image workflows.

## Supported models

| Model | ComfyUI node | Prompt style |
|-------|--------------|--------------|
| **Qwen-Image-Edit** | `TextEncodeQwenImageEdit` | Short unified scene prose for single-image edits |
| **Qwen-Image-Edit-2511** | `TextEncodeQwenImageEditPlus` | Explicit keep/change instructions; Figure 1 / Figure 2 for multi-image |
| **Qwen-Image-2.0** | `CLIP Text Encode (Qwen)` | Long T2I scene descriptions; Rich targets 1100–1400 characters |
| **FLUX.2 Klein** | `CLIP Text Encode (Flux)` | Subject-first photographic prose; materials, lighting, camera |

## Features

- User-selectable target model with model-specific formatting
- Prompt detail levels (Concise / Balanced / Rich) with **combined model + detail size limits**
- Minimum character enforcement for long-form models (Image-2.0 Rich, FLUX Rich)
- Positive and negative/preserve prompt modes
- Uncensored system prompts (no content filtering or refusals)
- One-click copy for ComfyUI paste
- LLM-powered generation with template fallback

## Prompt size limits

Limits are enforced per **model × detail** combination (characters and sentence count):

| Detail | Qwen-Image-Edit | Edit-2511 | Image-2.0 | FLUX.2 Klein |
|--------|-----------------|-----------|-----------|--------------|
| Concise | ~280 chars, 2 sent. | ~220 chars, 1–2 sent. | ~400 chars, 2 sent. | ~250 chars, 2 sent. |
| Balanced | ~520 chars, 3 sent. | ~420 chars, 2–3 sent. | ~550–800 chars, 3–4 sent. | ~450–700 chars, 3–5 sent. |
| Rich | ~920 chars, 4–5 sent. | ~680 chars, 3–4 sent. | **1100–1400 chars**, 6–8 sent. | **900–1200 chars**, 5–8 sent. |

Rich detail on Image-2.0 and FLUX.2 Klein enforces a **minimum character count** via LLM instructions, long few-shot examples, and post-processing expansion.

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

**Qwen-Image-Edit (Balanced):**

> A narrow cyberpunk alley at midnight, rain-slick asphalt mirroring magenta and cyan neon signs. Steam curls from sidewalk grates between cracked pavement. A sleek black cat crouches on a rusted fire escape, amber eyes catching a stray beam of light.

**Qwen-Image-Edit-2511 (Balanced):**

> Keep the subject's facial features, pose, and proportions unchanged. Replace the background with a gothic cathedral interior, candle flames cutting through low fog above worn flagstones.

**FLUX.2 Klein (Rich):**

> A sleek black cat crouches on a rusted fire escape… [subject first, named materials, photographic lighting, camera/composition detail]

Use **Negative / Preserve** mode for protective conditioning. **Note:** FLUX.2 Klein ignores negative prompts—the generator outputs positive preservation phrasing instead.

## API

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"input":"neon alley, rain, black cat","mode":"positive","model":"qwen-image-2.0","detail":"rich"}'
```

Response:

```json
{
  "prompt": "...",
  "mode": "positive",
  "provider": "llm",
  "model": "qwen-image-2.0",
  "comfyNode": "CLIP Text Encode (Qwen)",
  "limits": {
    "minChars": 1100,
    "maxChars": 1400,
    "maxSentences": 8,
    "maxTokens": 1024
  }
}
```
