"use client";

import ModelSelector from "@/components/ModelSelector";
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
}: SharedToolControlsProps) {
  const selectedModel = getComfyModelDefinition(shared.model);
  const activeLimits = getDetailLimits(shared.detail, shared.model);

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
    </div>
  );
}
