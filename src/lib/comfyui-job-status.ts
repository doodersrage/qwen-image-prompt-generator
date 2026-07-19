import type { ComfyGalleryJobStatus } from "./comfyui-gallery";

export type ComfyUiJobTrackerState = {
  promptId: string;
  status: ComfyGalleryJobStatus;
  statusMessage?: string;
  comfyUrl?: string;
  /** 1-based position in ComfyUI pending queue; 0 means running now. */
  queuePosition?: number | null;
  imageCount?: number;
};

export function isComfyUiJobProcessing(
  job: ComfyUiJobTrackerState | null | undefined,
): boolean {
  return job?.status === "pending" || job?.status === "running";
}

export function formatComfyUiJobStatusLine(job: ComfyUiJobTrackerState): string {
  const parts: string[] = [];

  if (job.status === "running") {
    parts.push("Running in ComfyUI");
  } else if (job.status === "pending") {
    if (job.queuePosition != null && job.queuePosition > 0) {
      parts.push(`Queued · position ${job.queuePosition}`);
    } else {
      parts.push("Queued");
    }
  } else if (job.status === "completed") {
    parts.push("Completed");
    if (job.imageCount != null && job.imageCount > 0) {
      parts.push(`${job.imageCount} image(s)`);
    }
  } else if (job.status === "error") {
    parts.push("Error");
  }

  if (job.statusMessage?.trim()) {
    const normalized = job.statusMessage.trim();
    if (!parts.some((part) => normalized.toLowerCase().includes(part.toLowerCase()))) {
      parts.push(normalized);
    }
  }

  parts.push(`prompt_id ${job.promptId}`);
  if (job.comfyUrl?.trim()) {
    parts.push(job.comfyUrl.trim());
  }

  return parts.filter(Boolean).join(" · ");
}

export function comfyUiJobStatusLabel(job: ComfyUiJobTrackerState): string {
  if (job.status === "running") {
    return "Running";
  }
  if (job.status === "pending") {
    if (job.queuePosition != null && job.queuePosition > 0) {
      return `Queued · #${job.queuePosition}`;
    }
    return "Queued";
  }
  if (job.status === "completed") {
    return "Completed";
  }
  return "Failed";
}
