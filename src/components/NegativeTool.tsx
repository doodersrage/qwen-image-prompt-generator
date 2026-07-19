"use client";

import { useCallback, useState } from "react";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { DEFAULT_NEGATIVE_TOOL_CACHE } from "@/lib/settings-cache";
import { SPORT_PRESETS } from "@/lib/sport-presets";

export default function NegativeTool() {
  const { mounted, shared, toolSettings, updateShared, updateToolSettings } =
    useCachedSettings("negative", DEFAULT_NEGATIVE_TOOL_CACHE);
  const actions = usePromptResultActions({
    tool: "negative",
    model: shared.model,
    detail: shared.detail,
    hints: toolSettings.sport,
  });
  const [output, setOutput] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setCopied(false);
    actions.resetStatuses();

    try {
      const response = await fetch("/api/negative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: toolSettings.sport,
          preserveSubject: toolSettings.preserveSubject,
          extra: toolSettings.extra,
        }),
      });

      const data = (await response.json()) as {
        prompt?: string;
        sport?: string | null;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Generation failed.");
      }

      setOutput(data.prompt ?? "");
      setSport(data.sport ?? null);
    } catch (err) {
      setOutput("");
      setSport(null);
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }, [toolSettings]);

  const copyOutput = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [output]);

  if (!mounted) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-rose-300">
          Negative / preserve
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50 sm:text-4xl">
          Negative Prompt Builder
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-zinc-400">
          Sport-aware negative prompts for SD-family models. Use preserve mode
          when refining an existing subject in Qwen edit workflows.
        </p>
      </header>

      <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          detailHelp="Detail level affects compact-to-limit when trimming long negatives."
        />

        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <label className="text-sm font-medium text-zinc-200">Sport context</label>
          <select
            value={toolSettings.sport ?? ""}
            onChange={(event) =>
              updateToolSettings({ sport: event.target.value })
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-zinc-100"
          >
            <option value="">Auto / general</option>
            {SPORT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.category}>
                {preset.label} ({preset.category})
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={toolSettings.preserveSubject === true}
            onChange={(event) =>
              updateToolSettings({ preserveSubject: event.target.checked })
            }
            className="mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 accent-rose-500"
          />
          <span className="space-y-1">
            <span className="text-sm font-medium text-zinc-200">
              Preserve subject mode
            </span>
            <span className="block text-xs text-zinc-500">
              Adds identity-preservation negatives for edit/refine workflows.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-200">Extra negatives</label>
          <textarea
            rows={3}
            value={toolSettings.extra ?? ""}
            onChange={(event) =>
              updateToolSettings({ extra: event.target.value })
            }
            placeholder="watermark, text, duplicate limbs"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100"
          />
        </div>

        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="inline-flex h-11 items-center rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:opacity-50"
        >
          {loading ? "Building…" : "Build negative prompt"}
        </button>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        )}
      </section>

      <EnhancedPromptResult
        output={output}
        provider="template"
        copied={copied}
        onCopy={copyOutput}
        extraMeta={sport ? `sport: ${sport}` : undefined}
        onSaveHistory={() =>
          actions.saveHistory({
            prompt: output,
            hints: toolSettings.sport,
          })
        }
        onCompact={() => void actions.compactPrompt(output, setOutput)}
        onExportSidecar={() => void actions.exportSidecar(output)}
        compactStatus={actions.compactStatus}
        historySaved={actions.historySaved}
      />
    </div>
  );
}
