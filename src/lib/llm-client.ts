export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
  /** Ollama native multimodal field (raw base64, no data URL prefix) */
  images?: string[];
};

export type ChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type LlmConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel: string;
};

export function getLlmConfig(): LlmConfig {
  const baseUrl =
    process.env.LLM_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost:11434/v1";
  const apiKey = process.env.LLM_API_KEY ?? "";
  const model = process.env.LLM_MODEL ?? "dolphin-llama3";
  const visionModel =
    process.env.LLM_VISION_MODEL?.trim() ||
    process.env.LLM_MODEL?.trim() ||
    model;

  return { baseUrl, apiKey, model, visionModel };
}

export function getVisionModel(): string {
  const visionModel = process.env.LLM_VISION_MODEL?.trim();
  if (!visionModel) {
    throw new Error(
      "LLM_VISION_MODEL is not set. Image → Prompt requires a vision model (e.g. qwen3-vl:latest). Add it to .env.local and restart the dev server.",
    );
  }
  return visionModel;
}

export function isLlmEnabled(): boolean {
  return process.env.LLM_ENABLED !== "false";
}

export function allowTemplateFallback(): boolean {
  return process.env.ALLOW_TEMPLATE_FALLBACK !== "false";
}

export function getLlmTemperature(override?: number): number {
  if (typeof override === "number" && override >= 0 && override <= 2) {
    return override;
  }

  const configured = Number(process.env.LLM_TEMPERATURE);
  return Number.isFinite(configured) && configured >= 0 && configured <= 2
    ? configured
    : 0.95;
}

function isOllamaBaseUrl(baseUrl: string): boolean {
  return /ollama\.com/i.test(baseUrl) || /:11434(\/|$)/.test(baseUrl);
}

function ollamaNativeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, "");
}

export function extractBase64FromDataUrl(dataUrl: string): {
  mimeType: string;
  base64: string;
} {
  const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/i);
  if (!match) {
    throw new Error("Image must be a base64 data URL (data:image/...;base64,...).");
  }

  return {
    mimeType: match[1]!,
    base64: match[2]!,
  };
}

function extractVisionAssistantText(message?: {
  content?: string | ChatContentPart[] | null;
  reasoning?: string | null;
  thinking?: string | null;
}): string {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function extractAssistantText(message?: {
  content?: string | ChatContentPart[] | null;
  reasoning?: string | null;
  thinking?: string | null;
}): string {
  if (!message) {
    return "";
  }

  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) {
      return text;
    }
  }

  if (typeof message.reasoning === "string" && message.reasoning.trim()) {
    return message.reasoning.trim();
  }

  if (typeof message.thinking === "string" && message.thinking.trim()) {
    return message.thinking.trim();
  }

  return "";
}

function buildAuthHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

async function ollamaNativeVisionCompletion(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  textPrompt: string;
  imageBase64: string;
  maxTokens: number;
  temperature?: number;
}): Promise<string> {
  const response = await fetch(`${ollamaNativeBaseUrl(options.baseUrl)}/api/chat`, {
    method: "POST",
    headers: buildAuthHeaders(options.apiKey),
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: options.systemPrompt },
        {
          role: "user",
          content: options.textPrompt,
          images: [options.imageBase64],
        },
      ],
      stream: false,
      think: false,
      options: {
        temperature: getLlmTemperature(options.temperature),
        num_predict: options.maxTokens,
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Ollama vision request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    message?: {
      content?: string;
      thinking?: string;
    };
  };

  const text = extractVisionAssistantText(data.message);
  if (!text) {
    throw new Error(
      "Vision model returned an empty response. If using a thinking model, ensure Ollama supports think:false or returns content.",
    );
  }

  return text;
}

export async function chatCompletion(options: {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  model?: string;
  extraBody?: Record<string, unknown>;
}): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();
  const headers = buildAuthHeaders(apiKey);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: options.model ?? model,
      messages: options.messages,
      temperature: getLlmTemperature(options.temperature),
      max_tokens: options.maxTokens,
      stream: false,
      top_p: 0.9,
      ...options.extraBody,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `LLM request failed (${response.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | ChatContentPart[];
        reasoning?: string;
        thinking?: string;
      };
    }>;
  };

  const text = extractAssistantText(data.choices?.[0]?.message);
  if (!text) {
    throw new Error("LLM returned an empty response.");
  }

  return text;
}

export async function visionCompletion(options: {
  systemPrompt: string;
  textPrompt: string;
  imageDataUrl: string;
  maxTokens: number;
  temperature?: number;
}): Promise<string> {
  const { baseUrl, apiKey } = getLlmConfig();
  const visionModel = getVisionModel();
  const { base64 } = extractBase64FromDataUrl(options.imageDataUrl);

  if (isOllamaBaseUrl(baseUrl)) {
    try {
      return await ollamaNativeVisionCompletion({
        baseUrl,
        apiKey,
        model: visionModel,
        systemPrompt: options.systemPrompt,
        textPrompt: options.textPrompt,
        imageBase64: base64,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
      });
    } catch (nativeError) {
      console.warn(
        "[llm-client] Ollama native vision failed, trying OpenAI-compatible endpoint:",
        nativeError instanceof Error ? nativeError.message : nativeError,
      );
    }
  }

  return chatCompletion({
    messages: [
      { role: "system", content: options.systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: options.textPrompt },
          { type: "image_url", image_url: { url: options.imageDataUrl } },
        ],
      },
    ],
    maxTokens: options.maxTokens,
    temperature: options.temperature,
    model: visionModel,
    extraBody: { think: false },
  });
}
