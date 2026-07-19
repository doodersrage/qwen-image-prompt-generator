import { getComfyUiBaseUrl, resolveComfyUiConfig } from "./comfyui-client";
import type { ComfyUiRuntimeConfig } from "./comfyui-config";
import { detectWorkflowPlaceholders } from "./comfyui-config";
import {
  extractImagesFromOutputs,
  type ComfyOutputImage,
} from "./comfyui-outputs";

export type ComfyPromptStatus = {
  promptId: string;
  status: "pending" | "running" | "completed" | "error" | "unknown";
  statusMessage?: string;
  comfyUrl: string;
  images?: ComfyOutputImage[];
};

type ComfyHistoryEntry = {
  status?: {
    status_str?: string;
    completed?: boolean;
  };
  outputs?: Record<string, unknown>;
};

export async function getComfyUiPromptStatus(
  promptId: string,
  runtime?: ComfyUiRuntimeConfig,
): Promise<ComfyPromptStatus> {
  const comfyUrl = getComfyUiBaseUrl(runtime);

  try {
    const response = await fetch(`${comfyUrl}/history/${promptId}`, {
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const payload = (await response.json()) as Record<string, ComfyHistoryEntry>;
      const entry = payload[promptId] ?? (payload as unknown as ComfyHistoryEntry);
      return interpretHistoryEntry(promptId, comfyUrl, entry);
    }

    const allResponse = await fetch(`${comfyUrl}/history`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!allResponse.ok) {
      return {
        promptId,
        status: "unknown",
        statusMessage: `HTTP ${allResponse.status}`,
        comfyUrl,
      };
    }

    const history = (await allResponse.json()) as Record<
      string,
      ComfyHistoryEntry
    >;
    const entry = history[promptId];
    if (!entry) {
      return {
        promptId,
        status: "pending",
        statusMessage: "Not in history yet (still queued or running)",
        comfyUrl,
      };
    }

    return interpretHistoryEntry(promptId, comfyUrl, entry);
  } catch (error) {
    return {
      promptId,
      status: "unknown",
      statusMessage: error instanceof Error ? error.message : "Status check failed",
      comfyUrl,
    };
  }
}

export async function getComfyUiWorkflowSummary(runtime?: ComfyUiRuntimeConfig) {
  const config = resolveComfyUiConfig(runtime);
  const placeholders = config.workflow
    ? detectWorkflowPlaceholders(JSON.stringify(config.workflow), config.placeholderTokens)
    : { positive: 0, negative: 0 };

  return {
    apiUrl: config.apiUrl,
    workflowSource: config.workflowSource,
    placeholderTokens: config.placeholderTokens,
    placeholders,
    legacyNodeFallback: Boolean(config.legacyPositiveNodeId),
    hasWorkflow: Boolean(config.workflow),
  };
}

function interpretHistoryEntry(
  promptId: string,
  comfyUrl: string,
  entry: ComfyHistoryEntry,
): ComfyPromptStatus {
  const statusStr = entry.status?.status_str?.toLowerCase() ?? "";
  const images = extractImagesFromOutputs(entry.outputs);
  const completed = entry.status?.completed === true || images.length > 0;

  if (completed) {
    return {
      promptId,
      status: "completed",
      statusMessage: statusStr || "completed",
      comfyUrl,
      images,
    };
  }

  if (statusStr.includes("error")) {
    return {
      promptId,
      status: "error",
      statusMessage: statusStr,
      comfyUrl,
      images,
    };
  }

  if (statusStr.includes("running") || statusStr.includes("execut")) {
    return {
      promptId,
      status: "running",
      statusMessage: statusStr,
      comfyUrl,
    };
  }

  return {
    promptId,
    status: "pending",
    statusMessage: statusStr || "pending",
    comfyUrl,
  };
}
