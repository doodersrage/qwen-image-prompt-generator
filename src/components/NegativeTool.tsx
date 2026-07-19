"use client";

import { useCallback, useState } from "react";
import EnhancedPromptResult from "@/components/EnhancedPromptResult";
import SharedToolControls from "@/components/SharedToolControls";
import { useCachedSettings } from "@/hooks/useCachedSettings";
import { usePromptResultActions } from "@/hooks/usePromptResultActions";
import { DEFAULT_NEGATIVE_TOOL_CACHE } from "@/lib/settings-cache";
import { SPORT_PRESETS } from "@/lib/sport-presets";
import {
  ToolBadge,
  ToolLayout,
  ToolSection,
  accentButtonClass,
  accentFocusClass,
  accentRingClass,
} from "@/components/ui/ToolPageShell";
import { FieldError, FieldLabel, TextArea } from "@/components/ui/Field";
import { PrimaryButton } from "@/components/ui/Button";

const ACCENT = "rose" as const;

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
    <ToolLayout
      accent={ACCENT}
      badge={<ToolBadge accent={ACCENT}>Negative / preserve</ToolBadge>}
      title="Negative Prompt Builder"
      description={
        <>
          Sport-aware negative prompts for SD-family models. Use preserve mode
          when refining an existing subject in Qwen edit workflows.
        </>
      }
      sidebar={
        <SharedToolControls
          shared={shared}
          onModelChange={(model) => updateShared({ model })}
          onDetailChange={(detail) => updateShared({ detail })}
          onWorkflowPresetChange={(id) => updateShared({ selectedWorkflowFileId: id })}
          detailHelp="Detail level affects compact-to-limit when trimming long negatives."
        />
      }
    >
      <ToolSection>
        <FieldLabel>Sport context</FieldLabel>
        <select
          value={toolSettings.sport ?? ""}
          onChange={(event) =>
            updateToolSettings({ sport: event.target.value })
          }
          className="ui-input w-full px-4 py-2 text-sm"
        >
          <option value="">Auto / general</option>
          {SPORT_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.category}>
              {preset.label} ({preset.category})
            </option>
          ))}
        </select>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={toolSettings.preserveSubject === true}
            onChange={(event) =>
              updateToolSettings({ preserveSubject: event.target.checked })
            }
            className={`mt-1 h-4 w-4 rounded border-zinc-600 bg-zinc-950 ${accentRingClass(ACCENT)}`}
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

        <FieldLabel>Extra negatives</FieldLabel>
        <TextArea
          rows={3}
          value={toolSettings.extra ?? ""}
          onChange={(event) =>
            updateToolSettings({ extra: event.target.value })
          }
          placeholder="watermark, text, duplicate limbs"
          className={accentFocusClass(ACCENT)}
        />

        <PrimaryButton
          accentClassName={accentButtonClass(ACCENT)}
          onClick={generate}
          loading={loading}
          loadingLabel="Building negative prompt"
        >
          Build negative prompt
        </PrimaryButton>

        <FieldError>{error}</FieldError>
      </ToolSection>

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
    </ToolLayout>
  );
}
