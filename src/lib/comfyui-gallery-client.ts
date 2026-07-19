import {
  addComfyGalleryEntry,
  loadComfyGallery,
  updateComfyGalleryByPromptId,
  type ComfyGalleryEntry,
  type ComfyGalleryJobStatus,
} from "./comfyui-gallery";
import {
  formatComfyUiJobStatusLine,
  type ComfyUiJobTrackerState,
} from "./comfyui-job-status";
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
  onJobUpdate?: (job: ComfyUiJobTrackerState) => void;
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
    statusMessage: "Queued",
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
    queuePosition?: number | null;
    images?: ComfyGalleryEntry["images"];
  };
}

function normalizeTrackerStatus(
  status: string | undefined,
): ComfyGalleryJobStatus | null {
  if (
    status === "pending" ||
    status === "running" ||
    status === "completed" ||
    status === "error"
  ) {
    return status;
  }

  return null;
}

function buildTrackerState(
  promptId: string,
  status: NonNullable<Awaited<ReturnType<typeof fetchComfyJobStatus>>>,
): ComfyUiJobTrackerState | null {
  const normalized = normalizeTrackerStatus(status.status);
  if (!normalized) {
    return null;
  }

  return {
    promptId,
    status: normalized,
    statusMessage: status.statusMessage,
    comfyUrl: status.comfyUrl,
    queuePosition: status.queuePosition,
    imageCount: status.images?.length,
  };
}

function applyComfyJobStatus(
  promptId: string,
  status: NonNullable<Awaited<ReturnType<typeof fetchComfyJobStatus>>>,
  onStatus?: (message: string) => void,
  onJobUpdate?: (job: ComfyUiJobTrackerState) => void,
): ComfyGalleryEntry | null {
  const tracker = buildTrackerState(promptId, status);
  if (!tracker) {
    return null;
  }

  onJobUpdate?.(tracker);
  onStatus?.(formatComfyUiJobStatusLine(tracker));

  if (tracker.status === "running" || tracker.status === "pending") {
    updateComfyGalleryByPromptId(promptId, {
      status: tracker.status,
      statusMessage: tracker.statusMessage,
      queuePosition: tracker.queuePosition,
      comfyUrl: tracker.comfyUrl,
    });
    return null;
  }

  if (tracker.status === "error") {
    return updateComfyGalleryByPromptId(promptId, {
      status: "error",
      statusMessage: tracker.statusMessage,
      queuePosition: null,
      completedAt: Date.now(),
      comfyUrl: tracker.comfyUrl,
    });
  }

  const entry = updateComfyGalleryByPromptId(promptId, {
    status: "completed",
    statusMessage: tracker.statusMessage,
    queuePosition: null,
    completedAt: Date.now(),
    comfyUrl: tracker.comfyUrl,
    images: status.images ?? [],
  });
  if (entry && loadComfyUiSettings().notifyOnComplete) {
    notifyComfyJobComplete(entry);
  }
  return entry;
}

export async function pollComfyGalleryJob(
  promptId: string,
  onStatus?: (message: string) => void,
  options?: PollComfyGalleryJobOptions,
): Promise<ComfyGalleryEntry | null> {
  const comfyUrl = resolveComfyUrlForJob(promptId, options?.comfyUrl);
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_POLL_ATTEMPTS;
  const intervalMs = options?.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const onJobUpdate = options?.onJobUpdate;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(intervalMs);
    }

    try {
      const status = await fetchComfyJobStatus(promptId, comfyUrl);
      if (!status) {
        continue;
      }

      const entry = applyComfyJobStatus(
        promptId,
        status,
        onStatus,
        onJobUpdate,
      );
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
    queuePosition: null,
    comfyUrl,
  });
}
