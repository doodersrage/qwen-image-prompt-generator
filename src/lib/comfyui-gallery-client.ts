import {
  addComfyGalleryEntry,
  loadComfyGallery,
  updateComfyGalleryByPromptId,
  type ComfyGalleryEntry,
} from "./comfyui-gallery";
import { notifyComfyJobComplete } from "./comfyui-notifications";
import { resolveComfyUiRuntime } from "./comfyui-runtime";
import { loadComfyUiSettings } from "./comfyui-settings";

export type RegisterComfyGalleryJobInput = {
  promptId: string;
  prompt: string;
  negativePrompt?: string;
  tool?: string;
  model?: string;
  comfyUrl: string;
};

export type PollComfyGalleryJobOptions = {
  comfyUrl?: string;
  maxAttempts?: number;
  intervalMs?: number;
};

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLL_ATTEMPTS = 450;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function resolveComfyUrlForJob(promptId: string, comfyUrl?: string): string | undefined {
  return (
    comfyUrl?.trim().replace(/\/+$/, "") ||
    loadComfyGallery()
      .find((entry) => entry.promptId === promptId)
      ?.comfyUrl?.trim()
      .replace(/\/+$/, "") ||
    resolveComfyUiRuntime()?.apiUrl?.trim().replace(/\/+$/, "")
  );
}

export function registerComfyGalleryJob(
  input: RegisterComfyGalleryJobInput,
): ComfyGalleryEntry {
  return addComfyGalleryEntry({
    promptId: input.promptId,
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    tool: input.tool,
    model: input.model,
    comfyUrl: input.comfyUrl,
    status: "pending",
  });
}

export async function fetchComfyJobStatus(
  promptId: string,
  comfyUrl?: string,
) {
  const params = new URLSearchParams({ promptId });
  const resolvedUrl = resolveComfyUrlForJob(promptId, comfyUrl);
  if (resolvedUrl) {
    params.set("comfyUrl", resolvedUrl);
  }

  const response = await fetch(`/api/comfyui/status?${params.toString()}`);
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as {
    status?: string;
    statusMessage?: string;
    comfyUrl?: string;
    images?: ComfyGalleryEntry["images"];
  };
}

function applyComfyJobStatus(
  promptId: string,
  status: NonNullable<Awaited<ReturnType<typeof fetchComfyJobStatus>>>,
  onStatus?: (message: string) => void,
): ComfyGalleryEntry | null {
  if (status.status === "running" || status.status === "pending") {
    updateComfyGalleryByPromptId(promptId, {
      status: status.status,
      statusMessage: status.statusMessage,
      comfyUrl: status.comfyUrl,
    });
    onStatus?.(`${status.status} · prompt_id ${promptId}`);
    return null;
  }

  if (status.status === "error") {
    return updateComfyGalleryByPromptId(promptId, {
      status: "error",
      statusMessage: status.statusMessage,
      completedAt: Date.now(),
      comfyUrl: status.comfyUrl,
    });
  }

  if (status.status === "completed") {
    const entry = updateComfyGalleryByPromptId(promptId, {
      status: "completed",
      statusMessage: status.statusMessage,
      completedAt: Date.now(),
      comfyUrl: status.comfyUrl,
      images: status.images ?? [],
    });
    if (entry && loadComfyUiSettings().notifyOnComplete) {
      notifyComfyJobComplete(entry);
    }
    return entry;
  }

  return null;
}

export async function pollComfyGalleryJob(
  promptId: string,
  onStatus?: (message: string) => void,
  options?: PollComfyGalleryJobOptions,
): Promise<ComfyGalleryEntry | null> {
  const comfyUrl = resolveComfyUrlForJob(promptId, options?.comfyUrl);
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(intervalMs);

    try {
      const status = await fetchComfyJobStatus(promptId, comfyUrl);
      if (!status) {
        continue;
      }

      const entry = applyComfyJobStatus(promptId, status, onStatus);
      if (entry) {
        return entry;
      }
    } catch {
      // keep polling
    }
  }

  return updateComfyGalleryByPromptId(promptId, {
    status: "running",
    statusMessage: "Still processing in ComfyUI — checking continues in background",
    comfyUrl,
  });
}
