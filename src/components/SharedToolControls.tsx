"use client";

import ModelSelector from "@/components/ModelSelector";
import ComfyWorkflowSelector from "@/components/ComfyWorkflowSelector";
import { useComfyWorkflowSelection } from "@/hooks/useComfyWorkflowSelection";
import type { DetailLevel } from "@/lib/detail-level";
import { getDetailLimits } from "@/lib/detail-level";
import { getComfyModelDefinition } from "@/lib/comfy-models";
import type { SharedToolSettings } from "@/lib/settings-cache";

type SharedToolControlsProps = {
  shared: SharedToolSettings;
  onModelChange: (model: SharedToolSettings["model"]) => void;
  onDetailChange: (detail: DetailLevel) => void;
  detailHelp?: string;
  showWardrobeOption?: boolean;
  alwaysIncludeClothing?: boolean;
  onAlwaysIncludeClothingChange?: (value: boolean) => void;
  wardrobeHelp?: string;
  lockedWardrobeId?: string;
  lockedWardrobeLabel?: string;
  onClearLockedWardrobe?: () => void;
  lockedLocation?: string;
  onClearLockedLocation?: () => void;
  lockedVariationSeed?: string;
  onClearLockedVariationSeed?: () => void;
  autoFixRules?: boolean;
  onAutoFixRulesChange?: (value: boolean) => void;
  onWorkflowPresetChange?: (fileId: string | undefined) => void;
};

export default function SharedToolControls({
  shared,
  onModelChange,
  onDetailChange,
  detailHelp,
  showWardrobeOption = false,
  alwaysIncludeClothing = true,
  onAlwaysIncludeClothingChange,
  wardrobeHelp,
  lockedWardrobeId,
  lockedWardrobeLabel,
  onClearLockedWardrobe,
  lockedLocation,
  onClearLockedLocation,
  lockedVariationSeed,
  onClearLockedVariationSeed,
  autoFixRules = true,
  onAutoFixRulesChange,
  onWorkflowPresetChange,
}: SharedToolControlsProps) {
  const selectedModel = getComfyModelDefinition(shared.model);
  const activeLimits = getDetailLimits(shared.detail, shared.model);
  const workflowSelection = useComfyWorkflowSelection();

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">Target model</p>
          <p className="mt-1 text-xs text-zinc-500">
            Shared across tools and remembered between page reloads.
          </p>
        </div>
        <ModelSelector value={shared.model} onChange={onModelChange} />
      </div>

      <div className="space-y-3 border-t border-zinc-800 pt-4">
        <div>
          <p className="text-sm font-medium text-zinc-200">Prompt detail</p>
          <p className="mt-1 text-xs text-zinc-500">
            {detailHelp ??
              `Limits for ${selectedModel.label}: up to ${activeLimits.maxSentences} sentences, ~${activeLimits.maxChars} chars.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { label: "Concise", value: "concise" },
              { label: "Balanced", value: "balanced" },
              { label: "Rich", value: "rich" },
            ] as const
          ).map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onDetailChange(preset.value)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                shared.detail === preset.value
                  ? "border-violet-500 bg-violet-500/15 text-violet-200"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {onWorkflowPresetChange && workflowSelection.mounted && (
        <ComfyWorkflowSelector
          selectedId={
            shared.selectedWorkflowFileId ??
            shared.selectedWorkflowPresetId ??
            workflowSelection.selectedId
          }
          defaultLabel={workflowSelection.defaultLabel}
          localFiles={workflowSelection.localFiles}
          serverFiles={workflowSelection.serverFiles}
          onChange={(fileId) => {
            workflowSelection.setSelectedId(fileId);
            onWorkflowPresetChange(fileId);
          }}
        />
      )}

      {showWardrobeOption && onAlwaysIncludeClothingChange && (
        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={alwaysIncludeClothing}
              onChange={(e) => onAlwaysIncludeClothingChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
            />
            <span className="space-y-1">
              <span className="text-sm font-medium text-zinc-200">
                Always include wardrobe
              </span>
              <span className="block text-xs leading-relaxed text-zinc-500">
                {wardrobeHelp ??
                  "Rolls catalog outfits for people in the prompt and appends assigned clothing if the model omits it. Shared across Generate, Character, and Random Scene."}
              </span>
            </span>
          </label>
        </div>
      )}

      {lockedWardrobeId && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4 text-xs">
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-sky-200">
            Locked kit: {lockedWardrobeLabel ?? lockedWardrobeId}
          </span>
          {onClearLockedWardrobe && (
            <button
              type="button"
              onClick={onClearLockedWardrobe}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {lockedLocation && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4 text-xs">
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-200">
            Locked location: {lockedLocation}
          </span>
          {onClearLockedLocation && (
            <button
              type="button"
              onClick={onClearLockedLocation}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {lockedVariationSeed && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4 text-xs">
          <span
            className="max-w-full truncate rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-violet-200"
            title={lockedVariationSeed}
          >
            Locked seed: {lockedVariationSeed.length > 48
              ? `${lockedVariationSeed.slice(0, 48)}…`
              : lockedVariationSeed}
          </span>
          {onClearLockedVariationSeed && (
            <button
              type="button"
              onClick={onClearLockedVariationSeed}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {onAutoFixRulesChange && (
        <div className="space-y-3 border-t border-zinc-800 pt-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={autoFixRules}
              onChange={(e) => onAutoFixRulesChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
            />
            <span className="space-y-1">
              <span className="text-sm font-medium text-zinc-200">
                Auto-fix lint errors
              </span>
              <span className="block text-xs leading-relaxed text-zinc-500">
                After generation, apply rule-based fixes when lint reports errors.
              </span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
