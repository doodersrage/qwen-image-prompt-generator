import type { ComfyImageModel } from "./comfy-models";
import type { SharedToolSettings } from "./settings-cache";

export type ModelWorkflowMap = Record<string, string>;

export function resolveWorkflowForModel(
  model: ComfyImageModel,
  map?: ModelWorkflowMap,
): string | undefined {
  if (!map) {
    return undefined;
  }

  return map[model]?.trim() || undefined;
}

export function patchSharedForModelChange(
  model: ComfyImageModel,
  shared: SharedToolSettings,
): Partial<SharedToolSettings> {
  const patch: Partial<SharedToolSettings> = { model };
  const workflowId = resolveWorkflowForModel(model, shared.modelWorkflowMap);
  if (workflowId) {
    patch.selectedWorkflowFileId = workflowId;
  }
  return patch;
}
