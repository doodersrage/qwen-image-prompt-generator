export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatContentPart[];
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
  const visionModel = process.env.LLM_VISION_MODEL ?? model;

  return { baseUrl, apiKey, model, visionModel };
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

export async function chatCompletion(options: {
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  model?: string;
  extraBody?: Record<string, unknown>;
}): Promise<string> {
  const { baseUrl, apiKey, model } = getLlmConfig();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

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
    choices?: Array<{ message?: { content?: string | ChatContentPart[] } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned an empty response.");
  }

  if (typeof content === "string") {
    return content.trim();
  }

  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export async function visionCompletion(options: {
  systemPrompt: string;
  textPrompt: string;
  imageDataUrl: string;
  maxTokens: number;
  temperature?: number;
}): Promise<string> {
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
    model: getLlmConfig().visionModel,
  });
}
