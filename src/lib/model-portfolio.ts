"use client";

import type { ComfyImageModel } from "./comfy-models";
import { resolveRuntimeForModel } from "./comfyui-runtime-for-model";
import { resolveQueueNegativePrompt } from "./queue-negative";

export type ModelPortfolioItem = {
  model: ComfyImageModel;
  prompt: string;
  error?: string;
};

export async function generateModelPortfolio(input: {
  draft: string;
  models: ComfyImageModel[];
  detail?: string;
}): Promise<ModelPortfolioItem[]> {
  const results: ModelPortfolioItem[] = [];

  for (const model of input.models) {
    try {
      const response = await fetch("/api/format", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input.draft.trim(),
          mode: "positive",
          model,
          detail: input.detail ?? "balanced",
          smartFormat: true,
        }),
      });
      const data = (await response.json()) as { prompt?: string; error?: string };
      if (!response.ok || !data.prompt?.trim()) {
        results.push({
          model,
          prompt: "",
          error: data.error ?? "Format failed.",
        });
        continue;
      }
      results.push({ model, prompt: data.prompt.trim() });
    } catch (err) {
      results.push({
        model,
        prompt: "",
        error: err instanceof Error ? err.message : "Format failed.",
      });
    }
  }

  return results;
}

export async function queueModelPortfolio(input: {
  items: ModelPortfolioItem[];
  hints?: string;
  tool?: string;
}): Promise<number> {
  let queued = 0;
  for (const item of input.items) {
    if (!item.prompt.trim()) {
      continue;
    }
    const runtime = resolveRuntimeForModel(item.model);
    const negativePrompt = await resolveQueueNegativePrompt({
      model: item.model,
      hints: input.hints,
      tool: input.tool ?? "portfolio",
    });
    const response = await fetch("/api/comfyui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: item.prompt,
        negativePrompt,
        ...(runtime ? { comfy: runtime } : {}),
      }),
    });
    if (response.ok) {
      queued += 1;
    }
  }
  return queued;
}
