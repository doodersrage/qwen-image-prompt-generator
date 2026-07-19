"use client";

import type { ComfyImageModel } from "./comfy-models";
import {
  pollComfyGalleryJob,
  registerComfyGalleryJob,
} from "./comfyui-gallery-client";
import {
  comfyUiSettingsToRuntime,
  loadComfyUiSettings,
} from "./comfyui-settings";
import { modelUsesNegativePrompt } from "./prompt-pair";

type WorkflowPreviewResponse = {
  ok: boolean;
  replacements?: {
    positive: number;
    negative: number;
    params: Record<string, number>;
    custom?: Record<string, number>;
  };
  resolvedParams?: {
    seed: string;
    width: string;
    height: string;
    cfg: string;
    steps: string;
  };
  snippets?: Array<{ path: string; value: string }>;
  workflowJson?: string;
  truncated?: boolean;
};

export type RequeueComfyJobInput = {
  prompt: string;
  negativePrompt?: string;
  tool?: string;
  model?: string;
  hints?: string;
  /** When true, override seed with a new random value for this job. */
  newSeed?: boolean;
  onStatus?: (message: string) => void;
};

export type RequeueComfyJobResult = {
  ok: boolean;
  promptId?: string;
  error?: string;
  comfyUrl?: string;
};

export async function requeueComfyJob(
  input: RequeueComfyJobInput,
): Promise<RequeueComfyJobResult> {
  if (!input.prompt.trim()) {
    return { ok: false, error: "Prompt is required." };
  }

  input.onStatus?.("Queueing…");

  let negativePrompt = input.negativePrompt?.trim() || undefined;
  const model = (input.model ?? "qwen-image-2512") as ComfyImageModel;

  if (!negativePrompt && modelUsesNegativePrompt(model)) {
    try {
      const response = await fetch("/api/negative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hints: input.hints?.trim() || input.prompt.slice(0, 200),
        }),
      });
      const data = (await response.json()) as { prompt?: string };
      negativePrompt = data.prompt?.trim() || undefined;
    } catch {
      // queue without negative
    }
  }

  const runtime = comfyUiSettingsToRuntime(loadComfyUiSettings());
  const response = await fetch("/api/comfyui", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input.prompt.trim(),
      negativePrompt,
      params: input.newSeed
        ? { seed: String(Math.floor(Math.random() * 2 ** 32)) }
        : undefined,
      ...(runtime ? { comfy: runtime } : {}),
    }),
  });

  const data = (await response.json()) as {
    ok?: boolean;
    promptId?: string;
    error?: string;
    comfyUrl?: string;
    workflowSource?: string;
  };

  if (!response.ok) {
    return {
      ok: false,
      error: data.error ?? "ComfyUI queue failed.",
      comfyUrl: data.comfyUrl,
    };
  }

  if (data.promptId) {
    registerComfyGalleryJob({
      promptId: data.promptId,
      prompt: input.prompt.trim(),
      negativePrompt,
      tool: input.tool,
      model: input.model,
      comfyUrl: data.comfyUrl ?? "http://127.0.0.1:8188",
    });
    void pollComfyGalleryJob(data.promptId, input.onStatus);
  }

  return {
    ok: true,
    promptId: data.promptId,
    comfyUrl: data.comfyUrl,
  };
}

export async function fetchWorkflowPreview(input: {
  prompt: string;
  negativePrompt?: string;
  newSeed?: boolean;
}): Promise<{
  ok?: boolean;
  error?: string;
  workflowSource?: string;
  replacements?: WorkflowPreviewResponse["replacements"];
  resolvedParams?: WorkflowPreviewResponse["resolvedParams"];
  snippets?: WorkflowPreviewResponse["snippets"];
  workflowJson?: string;
  truncated?: boolean;
}> {
  const runtime = comfyUiSettingsToRuntime(loadComfyUiSettings());
  const response = await fetch("/api/comfyui/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      params: input.newSeed
        ? { seed: String(Math.floor(Math.random() * 2 ** 32)) }
        : undefined,
      ...(runtime ? { comfy: runtime } : {}),
    }),
  });

  const data = (await response.json()) as WorkflowPreviewResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Workflow preview failed.");
  }

  return data;
}

export async function requeueComfyJobs(
  inputs: RequeueComfyJobInput[],
  onStatus?: (message: string) => void,
): Promise<{ queued: number; failed: number }> {
  let queued = 0;
  let failed = 0;

  for (const [index, input] of inputs.entries()) {
    onStatus?.(`Re-queueing ${index + 1}/${inputs.length}…`);
    const result = await requeueComfyJob({ ...input, onStatus: undefined });
    if (result.ok) {
      queued += 1;
    } else {
      failed += 1;
    }
  }

  onStatus?.(`Bulk re-queue finished · ${queued} queued · ${failed} failed`);
  return { queued, failed };
}
