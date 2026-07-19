"use client";

import type { ComfyImageModel } from "./comfy-models";
import { loadSettingsCache } from "./settings-cache";
import { resolveWorkflowForModel } from "./model-workflow-map";
import {
  resolveSelectedWorkflowRuntime,
  getSelectedWorkflowFileId,
} from "./comfyui-runtime";
import type { ComfyUiRuntimeConfig } from "./comfyui-config";

export function resolveRuntimeForModel(
  model: ComfyImageModel,
): ComfyUiRuntimeConfig | undefined {
  const shared = loadSettingsCache().shared;
  const mapped = resolveWorkflowForModel(model, shared.modelWorkflowMap);
  return resolveSelectedWorkflowRuntime(mapped ?? getSelectedWorkflowFileId());
}
