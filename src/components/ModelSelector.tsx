"use client";

import { useMemo, useState } from "react";
import {
  COMFY_IMAGE_MODELS,
  COMFY_MODEL_CATEGORIES,
  type ComfyImageModel,
  type ComfyModelCategory,
} from "@/lib/comfy-models";

type ModelSelectorProps = {
  value: ComfyImageModel;
  onChange: (model: ComfyImageModel) => void;
  id?: string;
};

export default function ModelSelector({ value, onChange, id }: ModelSelectorProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ComfyModelCategory | "all">("all");

  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return COMFY_IMAGE_MODELS.filter((entry) => {
      if (category !== "all" && entry.category !== category) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        entry.label.toLowerCase().includes(normalizedQuery) ||
        entry.id.toLowerCase().includes(normalizedQuery) ||
        entry.comfyNode.toLowerCase().includes(normalizedQuery) ||
        entry.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [category, query]);

  const selected = useMemo(
    () =>
      COMFY_IMAGE_MODELS.find((entry) => entry.id === value) ??
      COMFY_IMAGE_MODELS[0]!,
    [value],
  );

  return (
    <div className="space-y-3" id={id}>
      <div className="flex flex-col gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models by name, id, or node…"
          aria-label="Search ComfyUI models"
          className="ui-input min-h-11 w-full px-[var(--input-padding-x)] py-[var(--input-padding-y)] type-body-lg"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as ComfyModelCategory | "all")
          }
          aria-label="Filter by model family"
          className="ui-input min-h-11 w-full px-3 py-[var(--input-padding-y)] type-body"
        >
          <option value="all">All families ({COMFY_IMAGE_MODELS.length})</option>
          {COMFY_MODEL_CATEGORIES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>

      <p className="type-caption">
        {filteredModels.length} model{filteredModels.length === 1 ? "" : "s"}
        {category !== "all" &&
          ` in ${COMFY_MODEL_CATEGORIES.find((entry) => entry.id === category)?.label ?? category}`}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
        {" · "}
        Selected:{" "}
        <span className="text-[var(--text-secondary)]">{selected.label}</span>
      </p>

      <div className="sidebar-scroll max-h-80 space-y-2 overflow-y-auto pr-1">
        {filteredModels.length === 0 ? (
          <p className="type-caption rounded-[var(--radius-md)] border border-dashed border-[var(--border-default)] px-4 py-6 text-center">
            No models match your search.
          </p>
        ) : (
          filteredModels.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onChange(entry.id)}
              data-active={value === entry.id ? "true" : "false"}
              className={`ui-chip w-full px-4 py-3 text-left ${
                value === entry.id ? "" : "!items-start"
              }`}
            >
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <span
                  className={`type-heading ${
                    value === entry.id
                      ? "text-[var(--accent-text)]"
                      : "text-[var(--text-primary)]"
                  }`}
                >
                  {entry.label}
                </span>
                <span className="type-overline !normal-case !tracking-normal font-mono">
                  {entry.comfyNode}
                </span>
              </div>
              <p className="type-caption mt-1 w-full">{entry.description}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
