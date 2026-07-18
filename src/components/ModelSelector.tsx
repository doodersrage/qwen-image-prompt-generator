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
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          aria-label="Search ComfyUI models"
          className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 sm:flex-1"
        />
        <select
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as ComfyModelCategory | "all")
          }
          aria-label="Filter by model family"
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-200 outline-none transition focus:border-violet-500"
        >
          <option value="all">All families ({COMFY_IMAGE_MODELS.length})</option>
          {COMFY_MODEL_CATEGORIES.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.label}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-zinc-500">
        {filteredModels.length} model{filteredModels.length === 1 ? "" : "s"}
        {category !== "all" &&
          ` in ${COMFY_MODEL_CATEGORIES.find((entry) => entry.id === category)?.label ?? category}`}
        {query.trim() ? ` matching “${query.trim()}”` : ""}
        {" · "}
        Selected:{" "}
        <span className="text-zinc-400">{selected.label}</span>
      </p>

      <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {filteredModels.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-700 px-4 py-6 text-center text-sm text-zinc-500">
            No models match your search.
          </p>
        ) : (
          filteredModels.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onChange(entry.id)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                value === entry.id
                  ? "border-violet-500 bg-violet-500/10"
                  : "border-zinc-700 hover:border-zinc-500"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`text-sm font-medium ${
                    value === entry.id ? "text-violet-200" : "text-zinc-200"
                  }`}
                >
                  {entry.label}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  {entry.comfyNode}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                {entry.description}
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
