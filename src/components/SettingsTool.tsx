"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  downloadStudioBackup,
  importStudioBackup,
  parseStudioBackupFile,
} from "@/lib/studio-backup";
import { clearAllLocalPromptData, LOCAL_DATA_KEYS } from "@/lib/local-data-reset";
import { useComfyUiSettings } from "@/hooks/useComfyUiSettings";
import {
  validateWorkflowJson,
  WORKFLOW_PARAM_TOKEN_HELP,
  type CustomWorkflowToken,
} from "@/lib/comfyui-config";
import {
  DEFAULT_COMFYUI_SETTINGS,
  placeholderTokensFromSettings,
  resetComfyUiSettings,
  saveComfyUiSettings,
} from "@/lib/comfyui-settings";
import {
  deleteComfyWorkflowPreset,
  loadComfyWorkflowPresets,
  upsertComfyWorkflowPreset,
  type ComfyWorkflowPreset,
} from "@/lib/comfyui-workflow-presets";
import {
  isComfyNotificationSupported,
  requestComfyNotificationPermission,
} from "@/lib/comfyui-notifications";
import ComfyUiGalleryPanel from "@/components/ComfyUiGalleryPanel";
import WorkflowPreviewPanel from "@/components/WorkflowPreviewPanel";
import { fetchWorkflowPreview } from "@/lib/comfyui-requeue";

type HealthResponse = {
  llm: {
    ok: boolean;
    enabled: boolean;
    model?: string;
    visionModel?: string;
    baseUrl?: string;
    error?: string;
  };
  comfyui: { ok: boolean; url: string; error?: string };
  workflow?: {
    apiUrl: string;
    workflowSource: "client" | "env" | "none";
    placeholderTokens: { positive: string; negative: string };
    placeholders: { positive: number; negative: number };
    legacyNodeFallback: boolean;
    hasWorkflow: boolean;
  };
  config: {
    llmEnabled: boolean;
    allowTemplateFallback: boolean;
    llmModel: string;
    visionModel: string;
    comfyUiUrl: string;
  };
};

export default function SettingsTool() {
  const { mounted, settings, updateSettings } = useComfyUiSettings();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [workflowPresets, setWorkflowPresets] = useState<ComfyWorkflowPreset[]>([]);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [previewPrompt, setPreviewPrompt] = useState(
    "Two gravel cyclists racing through a muddy forest doubletrack at dusk.",
  );
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [workflowPreview, setWorkflowPreview] = useState<Awaited<
    ReturnType<typeof fetchWorkflowPreview>
  > | null>(null);

  useEffect(() => {
    setWorkflowPresets(loadComfyWorkflowPresets());
    if (isComfyNotificationSupported()) {
      setNotificationPermission(Notification.permission);
    } else {
      setNotificationPermission("unsupported");
    }
  }, []);

  const workflowValidation = useMemo(() => {
    if (!settings.workflowJson?.trim()) {
      return null;
    }
    return validateWorkflowJson(
      settings.workflowJson,
      placeholderTokensFromSettings(settings),
    );
  }, [settings.workflowJson, settings.positiveToken, settings.negativeToken]);

  const refreshHealth = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (!settings.useServerDefaults && settings.apiUrl?.trim()) {
        params.set("comfyUrl", settings.apiUrl.trim());
      }
      const query = params.toString();
      const response = await fetch(query ? `/api/health?${query}` : "/api/health");
      setHealth((await response.json()) as HealthResponse);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Health check failed.");
    } finally {
      setLoading(false);
    }
  }, [settings.apiUrl, settings.useServerDefaults]);

  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  const handleImport = useCallback(async (file: File) => {
    try {
      const raw = await file.text();
      importStudioBackup(parseStudioBackupFile(raw));
      setStatus("Backup imported. Reload the page to apply all settings.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import failed.");
    }
  }, []);

  const handleSaveComfySettings = useCallback(() => {
    if (!settings.useServerDefaults && settings.workflowJson?.trim()) {
      const validation = validateWorkflowJson(
        settings.workflowJson,
        placeholderTokensFromSettings(settings),
      );
      if (!validation.ok) {
        setWorkflowError(validation.error ?? "Invalid workflow JSON.");
        return;
      }
    }

    saveComfyUiSettings(settings);
    setWorkflowError(null);
    setStatus("ComfyUI settings saved.");
    void refreshHealth();
  }, [refreshHealth, settings]);

  const handleImportWorkflow = useCallback(async (file: File) => {
    try {
      const raw = await file.text();
      const validation = validateWorkflowJson(
        raw,
        placeholderTokensFromSettings(settings),
      );
      if (!validation.ok) {
        setWorkflowError(validation.error ?? "Invalid workflow JSON.");
        return;
      }

      updateSettings({
        useServerDefaults: false,
        workflowJson: raw.trim(),
      });
      setWorkflowError(null);
      setStatus(
        `Imported workflow · ${validation.placeholders?.positive ?? 0} positive placeholder(s).`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Workflow import failed.");
    }
  }, [settings, updateSettings]);

  const handleResetComfySettings = useCallback(() => {
    resetComfyUiSettings();
    updateSettings(DEFAULT_COMFYUI_SETTINGS);
    setWorkflowError(null);
    setStatus("ComfyUI settings reset to server defaults.");
    void refreshHealth();
  }, [refreshHealth, updateSettings]);

  const handleSaveWorkflowPreset = useCallback(() => {
    if (!settings.workflowJson?.trim()) {
      setWorkflowError("Add a workflow JSON before saving a preset.");
      return;
    }

    const validation = validateWorkflowJson(
      settings.workflowJson,
      placeholderTokensFromSettings(settings),
    );
    if (!validation.ok) {
      setWorkflowError(validation.error ?? "Invalid workflow JSON.");
      return;
    }

    const name = presetName.trim() || `Workflow ${new Date().toLocaleString()}`;
    const saved = upsertComfyWorkflowPreset({
      name,
      apiUrl: settings.apiUrl,
      workflowJson: settings.workflowJson,
      positiveToken: settings.positiveToken,
      negativeToken: settings.negativeToken,
      queueParams: settings.queueParams,
      customTokens: settings.customTokens,
    });
    setWorkflowPresets(loadComfyWorkflowPresets());
    setPresetName("");
    setWorkflowError(null);
    setStatus(`Saved workflow preset “${saved.name}”.`);
  }, [presetName, settings]);

  const handleApplyWorkflowPreset = useCallback(
    (preset: ComfyWorkflowPreset) => {
      updateSettings({
        useServerDefaults: false,
        apiUrl: preset.apiUrl ?? "",
        workflowJson: preset.workflowJson,
        positiveToken: preset.positiveToken,
        negativeToken: preset.negativeToken,
        queueParams: preset.queueParams ?? settings.queueParams,
        customTokens: preset.customTokens ?? settings.customTokens,
      });
      setWorkflowError(null);
      setStatus(`Applied preset “${preset.name}”.`);
      void refreshHealth();
    },
    [refreshHealth, settings.customTokens, settings.queueParams, updateSettings],
  );

  const handleDeleteWorkflowPreset = useCallback((id: string) => {
    deleteComfyWorkflowPreset(id);
    setWorkflowPresets(loadComfyWorkflowPresets());
    setStatus("Workflow preset deleted.");
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    const permission = await requestComfyNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      updateSettings({ notifyOnComplete: true });
      setStatus("Browser notifications enabled for completed ComfyUI jobs.");
    } else if (permission === "denied") {
      setStatus("Notifications blocked in browser settings.");
    }
  }, [updateSettings]);

  const updateQueueParam = useCallback(
    (key: "seed" | "width" | "height" | "cfg" | "steps", value: string) => {
      updateSettings({
        queueParams: {
          ...settings.queueParams,
          [key]: value,
        },
      });
    },
    [settings.queueParams, updateSettings],
  );

  const updateCustomToken = useCallback(
    (index: number, patch: Partial<CustomWorkflowToken>) => {
      const current = settings.customTokens ?? [];
      const next = current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      );
      updateSettings({ customTokens: next });
    },
    [settings.customTokens, updateSettings],
  );

  const addCustomToken = useCallback(() => {
    updateSettings({
      customTokens: [
        ...(settings.customTokens ?? []),
        { token: "{{CHECKPOINT}}", value: "" },
      ],
    });
  }, [settings.customTokens, updateSettings]);

  const removeCustomToken = useCallback(
    (index: number) => {
      updateSettings({
        customTokens: (settings.customTokens ?? []).filter(
          (_, entryIndex) => entryIndex !== index,
        ),
      });
    },
    [settings.customTokens, updateSettings],
  );

  const handlePreviewWorkflow = useCallback(async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    setWorkflowPreview(null);
    try {
      saveComfyUiSettings(settings);
      const preview = await fetchWorkflowPreview({ prompt: previewPrompt });
      setWorkflowPreview(preview);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewLoading(false);
    }
  }, [previewPrompt, settings]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-zinc-500/30 bg-zinc-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-300">
          Settings
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Settings & Health
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Service connectivity, ComfyUI workflow overrides, local data backup, and
          reset tools. LLM settings still come from server environment variables.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-zinc-200">Service health</h2>
          <button
            type="button"
            onClick={() => void refreshHealth()}
            disabled={loading}
            className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {loading ? "Checking…" : "Refresh"}
          </button>
        </div>

        {health && (
          <div className="grid gap-3 sm:grid-cols-2">
            <HealthCard
              title="LLM API"
              ok={health.llm.ok}
              detail={[
                health.llm.enabled ? health.llm.model : "disabled",
                health.llm.baseUrl,
                health.llm.error,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
            <HealthCard
              title="ComfyUI"
              ok={health.comfyui.ok}
              detail={[health.comfyui.url, health.comfyui.error]
                .filter(Boolean)
                .join(" · ")}
            />
          </div>
        )}

        {health && (
          <ul className="space-y-1 text-xs text-zinc-500">
            <li>Vision model: {health.config.visionModel}</li>
            <li>
              Template fallback:{" "}
              {health.config.allowTemplateFallback ? "allowed" : "disabled"}
            </li>
            {health.workflow && (
              <li>
                Active workflow: {health.workflow.workflowSource}
                {health.workflow.hasWorkflow
                  ? ` · ${health.workflow.placeholders.positive}× ${health.workflow.placeholderTokens.positive}${
                      health.workflow.placeholders.negative > 0
                        ? ` · ${health.workflow.placeholders.negative}× ${health.workflow.placeholderTokens.negative}`
                        : ""
                    }`
                  : " · minimal fallback workflow"}
                {health.workflow.legacyNodeFallback
                  ? " · env node-ID fallback available"
                  : ""}
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-violet-900/40 bg-zinc-900/60 p-6">
        <div className="space-y-1">
          <h2 className="text-sm font-medium text-zinc-200">ComfyUI queue settings</h2>
          <p className="text-sm text-zinc-400">
            Override the server&apos;s{" "}
            <code className="rounded bg-zinc-800 px-1 text-violet-300">
              COMFYUI_*
            </code>{" "}
            env vars for this browser. Used by Send to ComfyUI, batch queue, and the
            export pipeline.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={settings.useServerDefaults}
            onChange={(event) =>
              updateSettings({ useServerDefaults: event.target.checked })
            }
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
          />
          Use server defaults (ignore local ComfyUI overrides)
        </label>

        <div
          className={`grid gap-4 ${settings.useServerDefaults ? "pointer-events-none opacity-50" : ""}`}
        >
          <div className="space-y-1">
            <label htmlFor="comfy-url" className="text-xs text-zinc-400">
              ComfyUI API URL
            </label>
            <input
              id="comfy-url"
              value={settings.apiUrl ?? ""}
              onChange={(event) => updateSettings({ apiUrl: event.target.value })}
              placeholder="http://127.0.0.1:8188"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="positive-token" className="text-xs text-zinc-400">
                Positive placeholder token
              </label>
              <input
                id="positive-token"
                value={settings.positiveToken ?? ""}
                onChange={(event) =>
                  updateSettings({ positiveToken: event.target.value })
                }
                placeholder="{{POSITIVE}}"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="negative-token" className="text-xs text-zinc-400">
                Negative placeholder token (optional)
              </label>
              <input
                id="negative-token"
                value={settings.negativeToken ?? ""}
                onChange={(event) =>
                  updateSettings({ negativeToken: event.target.value })
                }
                placeholder="{{NEGATIVE}}"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-zinc-400">Queue parameter placeholders</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["seed", "Seed (empty = random per job)"],
                  ["width", "Width"],
                  ["height", "Height"],
                  ["cfg", "CFG"],
                  ["steps", "Steps"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="space-y-1 text-xs text-zinc-400">
                  {label}
                  <input
                    value={settings.queueParams?.[key]?.toString() ?? ""}
                    onChange={(event) => updateQueueParam(key, event.target.value)}
                    placeholder={
                      key === "seed"
                        ? "random"
                        : key === "width" || key === "height"
                          ? "1024"
                          : key === "cfg"
                            ? "7"
                            : "20"
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-zinc-600">
              Use tokens in workflow JSON:{" "}
              {WORKFLOW_PARAM_TOKEN_HELP.map((token) => (
                <code
                  key={token}
                  className="mr-1 rounded bg-zinc-800 px-1 text-violet-300"
                >
                  {token}
                </code>
              ))}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-zinc-400">Custom workflow tokens</p>
              <button
                type="button"
                onClick={addCustomToken}
                className="text-xs text-violet-300 hover:text-violet-200"
              >
                Add token
              </button>
            </div>
            {(settings.customTokens ?? []).length === 0 ? (
              <p className="text-xs text-zinc-600">
                Optional placeholders like{" "}
                <code className="rounded bg-zinc-800 px-1 text-violet-300">
                  {"{{CHECKPOINT}}"}
                </code>{" "}
                or{" "}
                <code className="rounded bg-zinc-800 px-1 text-violet-300">
                  {"{{LORA}}"}
                </code>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {(settings.customTokens ?? []).map((entry, index) => (
                  <li
                    key={`${entry.token}-${index}`}
                    className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
                  >
                    <input
                      value={entry.token}
                      onChange={(event) =>
                        updateCustomToken(index, { token: event.target.value })
                      }
                      placeholder="{{CHECKPOINT}}"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
                    />
                    <input
                      value={entry.value}
                      onChange={(event) =>
                        updateCustomToken(index, { value: event.target.value })
                      }
                      placeholder="flux1-dev.safetensors"
                      className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomToken(index)}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-400 hover:border-rose-500 hover:text-rose-200"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="workflow-json" className="text-xs text-zinc-400">
                Workflow JSON (ComfyUI API format)
              </label>
              <label className="cursor-pointer text-xs text-violet-300 hover:text-violet-200">
                Import .json
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleImportWorkflow(file);
                    }
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              id="workflow-json"
              value={settings.workflowJson ?? ""}
              onChange={(event) => {
                updateSettings({ workflowJson: event.target.value });
                setWorkflowError(null);
              }}
              rows={12}
              spellCheck={false}
              placeholder={`Paste exported ComfyUI API JSON here.\nUse ${settings.positiveToken ?? "{{POSITIVE}}"} and ${settings.negativeToken ?? "{{NEGATIVE}}"} anywhere prompts should be injected.`}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs leading-relaxed text-emerald-200"
            />
            {workflowError && (
              <p className="text-xs text-rose-300">{workflowError}</p>
            )}
            {workflowValidation && (
              <p className="text-xs text-zinc-500">
                {workflowValidation.ok ? (
                  <>
                    Placeholders: {workflowValidation.placeholders?.positive ?? 0}×{" "}
                    {settings.positiveToken}
                    {(workflowValidation.placeholders?.negative ?? 0) > 0
                      ? ` · ${workflowValidation.placeholders?.negative}× ${settings.negativeToken}`
                      : ""}
                    {workflowValidation.nodeIds?.length
                      ? ` · nodes: ${workflowValidation.nodeIds.join(", ")}`
                      : ""}
                  </>
                ) : (
                  <span className="text-amber-400/90">{workflowValidation.error}</span>
                )}
              </p>
            )}
          </div>

          <div className="space-y-3 rounded-xl border border-cyan-900/30 bg-zinc-950/40 p-4">
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-cyan-300/90">
                Workflow dry-run preview
              </h3>
              <p className="text-xs text-zinc-500">
                Test placeholder injection without queueing a ComfyUI job. Uses the
                current settings above (save first if you changed them recently).
              </p>
            </div>
            <textarea
              value={previewPrompt}
              onChange={(event) => setPreviewPrompt(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
            <button
              type="button"
              disabled={previewLoading || !previewPrompt.trim()}
              onClick={() => void handlePreviewWorkflow()}
              className="rounded-lg border border-cyan-700/60 px-4 py-2 text-sm text-cyan-200 hover:border-cyan-500 disabled:opacity-50"
            >
              {previewLoading ? "Previewing…" : "Preview injection"}
            </button>
            <WorkflowPreviewPanel
              loading={previewLoading}
              error={previewError}
              preview={workflowPreview}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-400">
                Named workflow presets
              </h3>
              <p className="text-xs text-zinc-500">
                Save the current URL, workflow JSON, tokens, and queue params for quick
                recall.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                placeholder="Preset name"
                className="min-w-[12rem] flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
              <button
                type="button"
                onClick={handleSaveWorkflowPreset}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-500"
              >
                Save preset
              </button>
            </div>
            {workflowPresets.length > 0 ? (
              <ul className="space-y-2">
                {workflowPresets.map((preset) => (
                  <li
                    key={preset.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-zinc-200">{preset.name}</p>
                      <p className="text-xs text-zinc-600">
                        {new Date(preset.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => handleApplyWorkflowPreset(preset)}
                        className="text-violet-300 hover:text-violet-200"
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWorkflowPreset(preset.id)}
                        className="text-zinc-500 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-600">No saved presets yet.</p>
            )}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={settings.notifyOnComplete ?? false}
            disabled={notificationPermission === "unsupported"}
            onChange={(event) =>
              updateSettings({ notifyOnComplete: event.target.checked })
            }
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-violet-500"
          />
          Notify when ComfyUI jobs complete
          {notificationPermission !== "granted" &&
            notificationPermission !== "unsupported" && (
              <button
                type="button"
                onClick={() => void handleEnableNotifications()}
                className="text-xs text-violet-300 hover:text-violet-200"
              >
                Enable permission
              </button>
            )}
        </label>
        {notificationPermission === "unsupported" && (
          <p className="text-xs text-zinc-600">
            Browser notifications are not supported in this environment.
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            disabled={!mounted}
            onClick={handleSaveComfySettings}
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            Save ComfyUI settings
          </button>
          <button
            type="button"
            onClick={() => void refreshHealth()}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:border-zinc-500"
          >
            Test connection
          </button>
          <button
            type="button"
            onClick={handleResetComfySettings}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Reset to server defaults
          </button>
        </div>

        <p className="text-xs text-zinc-600">
          Export a workflow from ComfyUI (Save API format), put{" "}
          <code className="rounded bg-zinc-800 px-1 text-violet-300">
            {settings.positiveToken ?? "{{POSITIVE}}"}
          </code>{" "}
          (and optionally{" "}
          <code className="rounded bg-zinc-800 px-1 text-violet-300">
            {settings.negativeToken ?? "{{NEGATIVE}}"}
          </code>
          ) in any string field where prompts should land—CLIP text inputs, custom node
          fields, filenames, etc.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <ComfyUiGalleryPanel limit={6} compact showHeader />
      </section>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
        <h2 className="text-sm font-medium text-zinc-200">Local data</h2>
        <p className="text-sm text-zinc-400">
          Backup includes history, settings, scene presets, user templates, location
          blocklist, ComfyUI settings, gallery entries, and workflow presets (v2).
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => {
              downloadStudioBackup();
              setStatus("Studio backup downloaded.");
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:border-zinc-500"
          >
            Export backup
          </button>
          <label className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:border-zinc-500">
            Import backup
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImport(file);
                }
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "Clear all local prompt history, settings, presets, and templates?",
                )
              ) {
                clearAllLocalPromptData();
                resetComfyUiSettings();
                updateSettings(DEFAULT_COMFYUI_SETTINGS);
                setStatus("Local data cleared. Reload the page.");
              }
            }}
            className="rounded-lg border border-rose-800/60 px-4 py-2 text-rose-200 hover:border-rose-500"
          >
            Reset local data
          </button>
        </div>
        <p className="text-xs text-zinc-600">
          Keys: {LOCAL_DATA_KEYS.join(", ")}
        </p>
      </section>

      {status && <p className="text-sm text-zinc-500">{status}</p>}
    </div>
  );
}

function HealthCard({
  title,
  ok,
  detail,
}: {
  title: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`}
        />
        <h3 className="text-sm font-medium text-zinc-200">{title}</h3>
      </div>
      <p className="mt-2 break-all text-xs text-zinc-500">{detail || "—"}</p>
    </div>
  );
}
