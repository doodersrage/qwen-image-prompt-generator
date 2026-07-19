"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SharedToolControls from "@/components/SharedToolControls";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import PromptDiagnosticsPanel from "@/components/PromptDiagnosticsPanel";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import {
  loadLocationBlocklist,
  saveLocationBlocklist,
  usePromptHistory,
  type PromptHistoryEntry,
} from "@/hooks/usePromptHistory";
import { DEFAULT_STUDIO_TOOL_CACHE } from "@/lib/settings-cache";
import {
  filterHistoryEntries,
  uniqueHistoryModels,
  uniqueHistoryTags,
  uniqueHistoryTools,
  type HistoryFilter,
} from "@/lib/history-filter";
import {
  buildShareableSceneParams,
  buildScenePresetShareUrl,
} from "@/lib/scene-preset-url";
import {
  buildPromptSidecar,
  downloadPromptSidecar,
} from "@/lib/prompt-sidecar";
import { requeueComfyJob } from "@/lib/comfyui-requeue";
import {
  applyScenePresetLocks,
  buildScenePresetFromCurrent,
  deleteScenePreset,
  loadScenePresets,
  upsertScenePreset,
  type ScenePreset,
} from "@/lib/scene-presets";
import {
  BUILTIN_PROMPT_TEMPLATES,
  applyPromptTemplate,
  getAllPromptTemplates,
} from "@/lib/prompt-templates";
import { buildRegenerateUrl } from "@/lib/regenerate-url";
import { diffPromptWords } from "@/lib/prompt-diff";
import {
  createUserTemplate,
  deleteUserTemplate,
  loadUserTemplates,
  templateFromPrompt,
  upsertUserTemplate,
  type UserPromptTemplate,
} from "@/lib/user-templates";
import {
  downloadHistoryExport,
  downloadStudioBackup,
  importStudioBackup,
  parseStudioBackupFile,
} from "@/lib/studio-backup";
import type { EnrichedToolGenerateResult } from "@/lib/specialized/types";

type StudioTab = "history" | "compare" | "catalog" | "templates" | "presets" | "diff";

type CatalogClothing = {
  id: string;
  label: string;
  category: string;
};

type CatalogLocation = {
  id: string;
  label: string;
};

export default function StudioTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("studio", DEFAULT_STUDIO_TOOL_CACHE);
  const {
    entries,
    toggleFavorite,
    setRating,
    addTag,
    removeEntry,
    clearHistory,
  } = usePromptHistory();

  const [tab, setTab] = useState<StudioTab>("history");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogClothing, setCatalogClothing] = useState<CatalogClothing[]>([]);
  const [catalogLocations, setCatalogLocations] = useState<CatalogLocation[]>([]);
  const [compareHints, setCompareHints] = useState(
    "two female gravel cyclists in a fierce competition",
  );
  const [compareA, setCompareA] = useState<EnrichedToolGenerateResult | null>(null);
  const [compareB, setCompareB] = useState<EnrichedToolGenerateResult | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>({});
  const [scenePresets, setScenePresets] = useState<ScenePreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetHints, setPresetHints] = useState("");
  const [userTemplates, setUserTemplates] = useState<UserPromptTemplate[]>([]);
  const [customTemplateName, setCustomTemplateName] = useState("");
  const [diffLeftId, setDiffLeftId] = useState("");
  const [diffRightId, setDiffRightId] = useState("");
  const [copiedPresetShareId, setCopiedPresetShareId] = useState<string | null>(
    null,
  );

  const actions = usePromptResultActions({
    tool: "studio",
    model: shared.model,
    detail: shared.detail,
  });

  const filteredEntries = useMemo(
    () => filterHistoryEntries(entries, historyFilter),
    [entries, historyFilter],
  );

  const favoriteEntries = useMemo(
    () => entries.filter((entry) => entry.favorite),
    [entries],
  );

  const template = useMemo(() => {
    return getAllPromptTemplates(userTemplates).find(
      (entry) => entry.id === (toolSettings.templateId ?? "duo-sport-race"),
    );
  }, [toolSettings.templateId, userTemplates]);

  const filledTemplate = useMemo(() => {
    if (!template) return "";
    return applyPromptTemplate(template.template, toolSettings.templateSlots ?? {});
  }, [template, toolSettings.templateSlots]);

  useEffect(() => {
    setBlocklist(loadLocationBlocklist());
    setScenePresets(loadScenePresets());
    setUserTemplates(loadUserTemplates());
  }, []);

  const loadCatalog = useCallback(async (query: string) => {
    const params = query.trim()
      ? `?q=${encodeURIComponent(query.trim())}`
      : "?limit=80";
    const response = await fetch(`/api/catalog${params}`);
    const data = (await response.json()) as {
      clothing?: CatalogClothing[];
      locations?: CatalogLocation[];
    };
    setCatalogClothing(data.clothing ?? []);
    setCatalogLocations(data.locations ?? []);
  }, []);

  useEffect(() => {
    if (tab === "catalog") {
      void loadCatalog(catalogQuery);
    }
  }, [tab, catalogQuery, loadCatalog]);

  const runCompare = useCallback(async () => {
    setCompareLoading(true);
    try {
      const payload = {
        hints: compareHints,
        portraitStyle: "action" as const,
        presetOptions: { headcount: "duo" as const },
      };

      const [responseA, responseB] = await Promise.all([
        fetch("/api/duo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, model: shared.model, detail: shared.detail }),
        }),
        fetch("/api/duo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            model: toolSettings.compareModelB ?? "flux-2-klein",
            detail: shared.detail,
          }),
        }),
      ]);

      setCompareA((await responseA.json()) as EnrichedToolGenerateResult);
      setCompareB((await responseB.json()) as EnrichedToolGenerateResult);
    } finally {
      setCompareLoading(false);
    }
  }, [compareHints, shared, toolSettings.compareModelB]);

  const toggleBlockLocation = useCallback((label: string) => {
    setBlocklist((previous) => {
      const next = previous.includes(label)
        ? previous.filter((entry) => entry !== label)
        : [...previous, label];
      saveLocationBlocklist(next);
      return next;
    });
  }, []);

  const copyText = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleImportBackup = useCallback(async (file: File) => {
    try {
      const raw = await file.text();
      importStudioBackup(parseStudioBackupFile(raw));
      setBlocklist(loadLocationBlocklist());
      setScenePresets(loadScenePresets());
      setUserTemplates(loadUserTemplates());
      setBackupStatus("Backup imported. Reload tabs to see restored settings.");
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : "Import failed.");
    }
  }, []);

  const diffLeft = useMemo(
    () => entries.find((entry) => entry.id === diffLeftId) ?? null,
    [entries, diffLeftId],
  );
  const diffRight = useMemo(
    () => entries.find((entry) => entry.id === diffRightId) ?? null,
    [entries, diffRightId],
  );
  const promptDiff = useMemo(() => {
    if (!diffLeft || !diffRight) {
      return null;
    }
    return diffPromptWords(diffLeft.prompt, diffRight.prompt);
  }, [diffLeft, diffRight]);

  if (!mounted) {
    return null;
  }

  const tabs: { id: StudioTab; label: string }[] = [
    { id: "history", label: "History" },
    { id: "compare", label: "Compare" },
    { id: "catalog", label: "Catalog" },
    { id: "templates", label: "Templates" },
    { id: "presets", label: "Presets" },
    { id: "diff", label: "Diff" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-violet-300">
          Studio
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Prompt Studio
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          History, model comparison, catalog browser, and template slots.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTab(entry.id)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
              tab === entry.id
                ? "border-violet-500 bg-violet-500/15 text-violet-200"
                : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {tab === "history" && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-200">
              Saved prompts ({filteredEntries.length}
              {filteredEntries.length !== entries.length
                ? ` of ${entries.length}`
                : ""}
              )
            </h2>
            <div className="flex flex-wrap gap-2 text-xs">
              {favoriteEntries.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    void actions.sendBatchComfyUi(
                      favoriteEntries.map((entry) => entry.prompt),
                    )
                  }
                  className="text-violet-400 hover:text-violet-300"
                >
                  Queue favorites to ComfyUI ({favoriteEntries.length})
                </button>
              )}
              {entries.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadHistoryExport(filteredEntries)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    Export filtered
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadHistoryExport(entries)}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    Export all
                  </button>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-zinc-500 hover:text-zinc-300"
                  >
                    Clear all
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  downloadStudioBackup();
                  setBackupStatus("Studio backup downloaded.");
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                Export backup
              </button>
              <label className="cursor-pointer text-zinc-500 hover:text-zinc-300">
                Import backup
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImportBackup(file);
                    }
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          {entries.length > 0 && (
            <div className="flex flex-wrap items-end gap-3 border-b border-zinc-800 pb-4 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500">Search</label>
                <input
                  value={historyFilter.query ?? ""}
                  onChange={(event) =>
                    setHistoryFilter((previous) => ({
                      ...previous,
                      query: event.target.value || undefined,
                    }))
                  }
                  placeholder="prompt, hints, tool…"
                  className="w-48 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500">Tool</label>
                <select
                  value={historyFilter.tool ?? "all"}
                  onChange={(event) =>
                    setHistoryFilter((previous) => ({
                      ...previous,
                      tool:
                        event.target.value === "all"
                          ? undefined
                          : event.target.value,
                    }))
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                >
                  <option value="all">All tools</option>
                  {uniqueHistoryTools(entries).map((tool) => (
                    <option key={tool} value={tool}>
                      {tool}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500">Model</label>
                <select
                  value={historyFilter.model ?? "all"}
                  onChange={(event) =>
                    setHistoryFilter((previous) => ({
                      ...previous,
                      model:
                        event.target.value === "all"
                          ? undefined
                          : event.target.value,
                    }))
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                >
                  <option value="all">All models</option>
                  {uniqueHistoryModels(entries).map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500">Tag</label>
                <select
                  value={historyFilter.tag ?? "all"}
                  onChange={(event) =>
                    setHistoryFilter((previous) => ({
                      ...previous,
                      tag:
                        event.target.value === "all"
                          ? undefined
                          : event.target.value,
                    }))
                  }
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                >
                  <option value="all">All tags</option>
                  {uniqueHistoryTags(entries).map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-zinc-400">
                <input
                  type="checkbox"
                  checked={historyFilter.favoritesOnly === true}
                  onChange={(event) =>
                    setHistoryFilter((previous) => ({
                      ...previous,
                      favoritesOnly: event.target.checked || undefined,
                    }))
                  }
                  className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
                />
                Favorites only
              </label>
              <div className="space-y-1">
                <label className="text-zinc-500">Min rating</label>
                <select
                  value={historyFilter.minRating ?? 0}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setHistoryFilter((previous) => ({
                      ...previous,
                      minRating: value > 0 ? value : undefined,
                    }));
                  }}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-200"
                >
                  <option value={0}>Any</option>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating}+ stars
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {backupStatus && (
            <p className="text-xs text-zinc-500">{backupStatus}</p>
          )}

          {actions.comfyUiStatus && (
            <p className="text-xs text-violet-400">{actions.comfyUiStatus}</p>
          )}

          {entries.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Generate prompts in Duo or other tools, then save them here.
            </p>
          ) : filteredEntries.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No history entries match the current filters.
            </p>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <HistoryCard
                  key={entry.id}
                  entry={entry}
                  onCopy={() => copyText(entry.prompt)}
                  onToggleFavorite={() => toggleFavorite(entry.id)}
                  onRate={(rating) => setRating(entry.id, rating)}
                  onAddTag={(tag) => addTag(entry.id, tag)}
                  onExportSidecar={() => {
                    downloadPromptSidecar(
                      buildPromptSidecar({
                        positive: entry.prompt,
                        model: entry.model,
                        hints: entry.hints,
                        tool: entry.tool,
                        diagnostics: entry.diagnostics,
                        metadata: entry.metadata,
                      }),
                      `${entry.tool}-history`,
                    );
                  }}
                  onRemove={() => removeEntry(entry.id)}
                  onDiffLeft={() => {
                    setDiffLeftId(entry.id);
                    setTab("diff");
                  }}
                  onDiffRight={() => {
                    setDiffRightId(entry.id);
                    setTab("diff");
                  }}
                  onSaveTemplate={() => {
                    const name = window.prompt("Template name", `${entry.tool} prompt`);
                    if (!name?.trim()) {
                      return;
                    }
                    const created = templateFromPrompt(name.trim(), entry.prompt);
                    upsertUserTemplate(created);
                    setUserTemplates(loadUserTemplates());
                    setBackupStatus(`Saved template “${created.label}”.`);
                  }}
                  onRequeue={(newSeed) => {
                    setBackupStatus("Re-queueing from history…");
                    void requeueComfyJob({
                      prompt: entry.prompt,
                      tool: entry.tool,
                      model: entry.model,
                      hints: entry.hints,
                      newSeed,
                      onStatus: setBackupStatus,
                    }).then((result) => {
                      if (!result.ok) {
                        setBackupStatus(result.error ?? "Re-queue failed.");
                        return;
                      }
                      setBackupStatus(
                        [
                          "queued from history",
                          result.promptId ? `prompt_id ${result.promptId}` : null,
                          newSeed ? "new seed" : "same params",
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      );
                    });
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "compare" && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <SharedToolControls
            shared={shared}
            onModelChange={(model) => updateShared({ model })}
            onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">Model A</label>
              <p className="text-xs text-zinc-500">{shared.model}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-200">Model B</label>
              <input
                value={toolSettings.compareModelB ?? "flux-2-klein"}
                onChange={(event) =>
                  updateToolSettings({ compareModelB: event.target.value })
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
              />
            </div>
          </div>

          <textarea
            rows={3}
            value={compareHints}
            onChange={(event) => setCompareHints(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm"
          />

          <button
            type="button"
            onClick={runCompare}
            disabled={compareLoading}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {compareLoading ? "Comparing…" : "Compare models"}
          </button>

          <div className="grid gap-4 lg:grid-cols-2">
            {compareA && (
              <CompareCard title={`Model A · ${shared.model}`} result={compareA} />
            )}
            {compareB && (
              <CompareCard
                title={`Model B · ${toolSettings.compareModelB}`}
                result={compareB}
              />
            )}
          </div>
        </section>
      )}

      {tab === "catalog" && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <input
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
            placeholder="Search clothing or locations…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-200">Clothing</h3>
              <ul className="max-h-80 space-y-1 overflow-y-auto text-xs text-zinc-400">
                {catalogClothing.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2 py-1"
                  >
                    <span>
                      <span className="text-zinc-200">{entry.label}</span>
                      <span className="text-zinc-600"> · {entry.category}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => updateShared({ lockedWardrobeId: entry.id })}
                      className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${
                        shared.lockedWardrobeId === entry.id
                          ? "bg-sky-500/20 text-sky-200"
                          : "text-zinc-500 hover:text-sky-300"
                      }`}
                    >
                      {shared.lockedWardrobeId === entry.id ? "Locked" : "Lock kit"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-medium text-zinc-200">
                Locations · blocklist ({blocklist.length})
              </h3>
              <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                {catalogLocations.map((entry) => {
                  const blocked = blocklist.includes(entry.label);
                  const locked = shared.lockedLocation === entry.label;
                  return (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 rounded border border-zinc-800 px-2 py-1"
                    >
                      <button
                        type="button"
                        onClick={() => toggleBlockLocation(entry.label)}
                        className={`flex-1 text-left transition ${
                          blocked
                            ? "text-rose-200"
                            : "text-zinc-400 hover:text-zinc-200"
                        }`}
                      >
                        {entry.label}
                        {blocked ? " · blocked" : ""}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateShared({
                            lockedLocation:
                              locked ? undefined : entry.label,
                          })
                        }
                        className={`shrink-0 rounded px-2 py-0.5 text-[10px] ${
                          locked
                            ? "bg-amber-500/20 text-amber-200"
                            : "text-zinc-500 hover:text-amber-300"
                        }`}
                      >
                        {locked ? "Locked" : "Lock location"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === "templates" && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-200">Template</label>
            <select
              value={toolSettings.templateId ?? "duo-sport-race"}
              onChange={(event) =>
                updateToolSettings({ templateId: event.target.value })
              }
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm"
            >
              <optgroup label="Built-in">
                {BUILTIN_PROMPT_TEMPLATES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </optgroup>
              {userTemplates.length > 0 && (
                <optgroup label="Custom">
                  {userTemplates.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div className="grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
            <input
              value={customTemplateName}
              onChange={(event) => setCustomTemplateName(event.target.value)}
              placeholder="Custom template name"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={!customTemplateName.trim() || !filledTemplate.trim()}
              onClick={() => {
                const created = createUserTemplate({
                  name: customTemplateName,
                  template: filledTemplate,
                  defaultPortraitStyle: template?.defaultPortraitStyle,
                });
                upsertUserTemplate(created);
                setUserTemplates(loadUserTemplates());
                updateToolSettings({ templateId: created.id });
                setCustomTemplateName("");
                setBackupStatus(`Saved custom template “${created.label}”.`);
              }}
              className="rounded-lg border border-violet-700/60 px-3 py-2 text-sm text-violet-200 disabled:opacity-50"
            >
              Save preview as custom template
            </button>
          </div>

          {template && userTemplates.some((entry) => entry.id === template.id) && (
            <button
              type="button"
              onClick={() => {
                deleteUserTemplate(template.id);
                setUserTemplates(loadUserTemplates());
                updateToolSettings({ templateId: "duo-sport-race" });
                setBackupStatus(`Deleted template “${template.label}”.`);
              }}
              className="text-xs text-rose-400 hover:text-rose-300"
            >
              Delete custom template
            </button>
          )}

          {template && (
            <>
              <p className="font-mono text-xs text-zinc-500">{template.template}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from(
                  template.template.matchAll(/\{\{(\w+)\}\}/g),
                  (match) => match[1]!,
                ).map((slot) => (
                  <div key={slot} className="space-y-1">
                    <label className="text-xs text-zinc-400">{slot}</label>
                    <input
                      value={toolSettings.templateSlots?.[slot] ?? ""}
                      onChange={(event) =>
                        updateToolSettings({
                          templateSlots: {
                            ...toolSettings.templateSlots,
                            [slot]: event.target.value,
                          },
                        })
                      }
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              <EnhancedPromptResult
                output={filledTemplate}
                provider={null}
                copied={copied}
                onCopy={() => copyText(filledTemplate)}
                extraMeta="template preview"
              />

              <a
                href={`/duo?hints=${encodeURIComponent(filledTemplate)}`}
                className="inline-flex text-sm text-emerald-400 hover:text-emerald-300"
              >
                Open in Duo generator →
              </a>
            </>
          )}
        </section>
      )}

      {tab === "presets" && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-sm text-zinc-400">
            Save named bundles of hints and shared locks (kit, location, seed) for
            quick reuse across Character, Duo, and Random Scene.
          </p>

          <SharedToolControls
            shared={shared}
            onModelChange={(model) => updateShared({ model })}
            onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
            lockedWardrobeId={shared.lockedWardrobeId}
            lockedLocation={shared.lockedLocation}
            lockedVariationSeed={shared.lockedVariationSeed}
            onClearLockedWardrobe={() =>
              updateShared({ lockedWardrobeId: undefined })
            }
            onClearLockedLocation={() =>
              updateShared({ lockedLocation: undefined })
            }
            onClearLockedVariationSeed={() =>
              updateShared({ lockedVariationSeed: undefined })
            }
          />

          <div className="grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Preset name</label>
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Gravel duo night race"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Hints (optional)</label>
              <input
                value={presetHints}
                onChange={(event) => setPresetHints(event.target.value)}
                placeholder={compareHints}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!presetName.trim()}
            onClick={() => {
              const preset = buildScenePresetFromCurrent({
                name: presetName,
                hints: presetHints || compareHints,
                tool: "studio",
                shared,
              });
              upsertScenePreset(preset);
              setScenePresets(loadScenePresets());
              setPresetName("");
              setBackupStatus(`Saved preset “${preset.name}”.`);
            }}
            className="rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Save current locks as preset
          </button>

          {scenePresets.length === 0 ? (
            <p className="text-sm text-zinc-500">No scene presets saved yet.</p>
          ) : (
            <ul className="space-y-2">
              {scenePresets.map((preset) => (
                <li
                  key={preset.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-zinc-200">{preset.name}</p>
                    <p className="text-xs text-zinc-500">
                      {preset.hints ? preset.hints.slice(0, 80) : "No hints"}
                      {preset.sharedLocks?.lockedLocation
                        ? ` · location: ${preset.sharedLocks.lockedLocation}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        updateShared(applyScenePresetLocks(preset));
                        if (preset.hints) {
                          setCompareHints(preset.hints);
                        }
                        setBackupStatus(`Applied preset “${preset.name}”.`);
                      }}
                      className="text-emerald-400 hover:text-emerald-300"
                    >
                      Apply locks
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const url = buildScenePresetShareUrl(
                          "/duo",
                          buildShareableSceneParams({
                            hints: preset.hints,
                            sportPresetId: preset.sportPresetId,
                            shared: {
                              lockedWardrobeId:
                                preset.sharedLocks?.lockedWardrobeId,
                              lockedLocation: preset.sharedLocks?.lockedLocation,
                              lockedVariationSeed:
                                preset.sharedLocks?.lockedVariationSeed,
                            },
                          }),
                        );
                        const absolute =
                          typeof window !== "undefined"
                            ? `${window.location.origin}${url}`
                            : url;
                        void navigator.clipboard.writeText(absolute);
                        setCopiedPresetShareId(preset.id);
                        window.setTimeout(() => setCopiedPresetShareId(null), 2000);
                      }}
                      className="text-violet-400 hover:text-violet-300"
                    >
                      {copiedPresetShareId === preset.id
                        ? "Copied link!"
                        : "Copy share link"}
                    </button>
                    <a
                      href={buildScenePresetShareUrl(
                        "/duo",
                        buildShareableSceneParams({
                          hints: preset.hints,
                          sportPresetId: preset.sportPresetId,
                          shared: {
                            lockedWardrobeId: preset.sharedLocks?.lockedWardrobeId,
                            lockedLocation: preset.sharedLocks?.lockedLocation,
                            lockedVariationSeed:
                              preset.sharedLocks?.lockedVariationSeed,
                          },
                        }),
                      )}
                      className="text-zinc-400 hover:text-zinc-200"
                    >
                      Open Duo
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        deleteScenePreset(preset.id);
                        setScenePresets(loadScenePresets());
                      }}
                      className="text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "diff" && (
        <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
          <p className="text-sm text-zinc-400">
            Compare two saved prompts word-by-word. Pick entries from history or use
            the Diff A / Diff B buttons on history cards.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Left (before)</label>
              <select
                value={diffLeftId}
                onChange={(event) => setDiffLeftId(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Select entry…</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.tool} · {entry.prompt.slice(0, 48)}…
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-zinc-500">Right (after)</label>
              <select
                value={diffRightId}
                onChange={(event) => setDiffRightId(event.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Select entry…</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.tool} · {entry.prompt.slice(0, 48)}…
                  </option>
                ))}
              </select>
            </div>
          </div>

          {promptDiff && (
            <>
              <p className="text-xs text-zinc-500">
                {promptDiff.beforeChars} → {promptDiff.afterChars} chars
                {promptDiff.changed ? "" : " · identical"}
              </p>
              <p className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-sm leading-relaxed">
                {promptDiff.segments.map((segment, index) => (
                  <span
                    key={`${index}-${segment.type}-${segment.text.slice(0, 12)}`}
                    className={
                      segment.type === "remove"
                        ? "bg-rose-500/20 text-rose-200 line-through"
                        : segment.type === "add"
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "text-zinc-300"
                    }
                  >
                    {segment.text}{" "}
                  </span>
                ))}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <pre className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono text-xs text-zinc-400">
                  {diffLeft?.prompt}
                </pre>
                <pre className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 font-mono text-xs text-emerald-300">
                  {diffRight?.prompt}
                </pre>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function HistoryCard({
  entry,
  onCopy,
  onToggleFavorite,
  onRate,
  onAddTag,
  onExportSidecar,
  onRemove,
  onDiffLeft,
  onDiffRight,
  onSaveTemplate,
  onRequeue,
}: {
  entry: PromptHistoryEntry;
  onCopy: () => void;
  onToggleFavorite: () => void;
  onRate: (rating: PromptHistoryEntry["rating"]) => void;
  onAddTag: (tag: string) => void;
  onExportSidecar: () => void;
  onRemove: () => void;
  onDiffLeft: () => void;
  onDiffRight: () => void;
  onSaveTemplate: () => void;
  onRequeue: (newSeed: boolean) => void;
}) {
  const regenerateUrl = buildRegenerateUrl(entry);
  const showHintDiff =
    entry.hints?.trim() &&
    entry.prompt.trim() &&
    !entry.prompt.toLowerCase().includes(entry.hints.trim().slice(0, 40).toLowerCase());

  return (
    <article className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span>
          {entry.tool} · {entry.model} · {new Date(entry.timestamp).toLocaleString()}
        </span>
        <div className="flex gap-2">
          <a
            href={regenerateUrl}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Regenerate
          </a>
          <button type="button" onClick={onToggleFavorite} className="hover:text-zinc-300">
            {entry.favorite ? "★" : "☆"}
          </button>
          <button type="button" onClick={onCopy} className="hover:text-zinc-300">
            Copy
          </button>
          <button type="button" onClick={onExportSidecar} className="hover:text-violet-300">
            Sidecar
          </button>
          <button
            type="button"
            onClick={() => onRequeue(false)}
            className="hover:text-violet-300"
          >
            Re-queue
          </button>
          <button
            type="button"
            onClick={() => onRequeue(true)}
            className="hover:text-violet-300"
          >
            Re-queue (new seed)
          </button>
          <button
            type="button"
            onClick={() => {
              const tag = window.prompt("Add tag");
              if (tag?.trim()) {
                onAddTag(tag.trim());
              }
            }}
            className="hover:text-sky-300"
          >
            Tag
          </button>
          <button type="button" onClick={onDiffLeft} className="hover:text-amber-300">
            Diff A
          </button>
          <button type="button" onClick={onDiffRight} className="hover:text-amber-300">
            Diff B
          </button>
          <button type="button" onClick={onSaveTemplate} className="hover:text-violet-300">
            Template
          </button>
          <button type="button" onClick={onRemove} className="hover:text-rose-300">
            Remove
          </button>
        </div>
      </div>
      {entry.hints?.trim() && (
        <p className="text-xs text-zinc-500">
          Hints: <span className="text-zinc-400">{entry.hints}</span>
        </p>
      )}
      {(entry.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags!.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-300">
        {entry.prompt}
      </pre>
      {showHintDiff && (
        <p className="text-xs text-amber-400/80">
          Prompt expanded beyond the saved hints — use Regenerate to roll again with the same inputs.
        </p>
      )}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onRate(value as PromptHistoryEntry["rating"])}
            className={`h-6 w-6 rounded text-xs ${
              entry.rating === value
                ? "bg-violet-500/30 text-violet-200"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {value}
          </button>
        ))}
      </div>
      {entry.diagnostics && <PromptDiagnosticsPanel diagnostics={entry.diagnostics} />}
    </article>
  );
}

function CompareCard({
  title,
  result,
}: {
  title: string;
  result: EnrichedToolGenerateResult;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      <pre className="whitespace-pre-wrap font-mono text-xs text-emerald-300">
        {result.prompt}
      </pre>
      <PromptDiagnosticsPanel diagnostics={result.diagnostics ?? null} />
    </div>
  );
}
