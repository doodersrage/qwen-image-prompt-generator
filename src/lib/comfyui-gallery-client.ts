import {
  addComfyGalleryEntry,
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

export async function fetchComfyJobStatus(promptId: string) {
  const runtime = resolveComfyUiRuntime();
  const params = new URLSearchParams({ promptId });
  if (runtime?.apiUrl) {
    params.set("comfyUrl", runtime.apiUrl);
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

export async function pollComfyGalleryJob(
  promptId: string,
  onStatus?: (message: string) => void,
): Promise<ComfyGalleryEntry | null> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2000));

    try {
      const status = await fetchComfyJobStatus(promptId);
      if (!status) {
        continue;
      }

      if (status.status === "running" || status.status === "pending") {
        updateComfyGalleryByPromptId(promptId, {
          status: status.status,
          statusMessage: status.statusMessage,
          comfyUrl: status.comfyUrl,
        });
        onStatus?.(`${status.status} · prompt_id ${promptId}`);
        continue;
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
    } catch {
      // keep polling
    }
  }

  return updateComfyGalleryByPromptId(promptId, {
    status: "error",
    statusMessage: "Timed out waiting for ComfyUI",
    completedAt: Date.now(),
  });
}
