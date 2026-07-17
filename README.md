# Qwen Image Edit Prompt Generator

A Next.js app that paints a picture in words from any topic or keywords—a Qwen-compatible scene prompt for **TextEncodeQwenImageEdit**.

## Features

- Topic or keywords → descriptive prose scene (word painting, not tag soup)
- Qwen Image Edit natural-language format
- Positive and negative/preserve prompt modes
- Uncensored system prompts (no content filtering or refusals)
- One-click copy for ComfyUI paste
- LLM-powered generation with template fallback

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

### OpenRouter

```env
LLM_API_BASE_URL=https://openrouter.ai/api/v1
LLM_API_KEY=your_key
LLM_MODEL=cognitivecomputations/dolphin-mistral-24b-venice-edition:free
```

## Prompt format

Positive mode expands your input into descriptive prose that paints the scene—Qwen's preferred natural-language format:

> A narrow cyberpunk alley at midnight, the asphalt slick with rain that mirrors magenta and cyan neon signs overhead. Steam curls from sidewalk grates between cracked pavement. In the midground, a sleek black cat crouches on a rusted fire escape, amber eyes catching a stray beam of light.

Use **Negative / Preserve** mode for protective conditioning (e.g. "do not alter the subject's face").

## API

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"input":"neon alley, rain, black cat","mode":"positive"}'
```

Response:

```json
{
  "prompt": "A narrow cyberpunk alley at midnight, the asphalt slick with rain that mirrors magenta and cyan neon signs overhead. Steam curls from sidewalk grates between cracked pavement. In the midground, a sleek black cat crouches on a rusted fire escape, amber eyes catching a stray beam of light.",
  "mode": "positive",
  "provider": "llm"
}
```
