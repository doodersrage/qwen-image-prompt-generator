"use client";

import { ToolSection } from "@/components/ui/ToolPageShell";
import { Button } from "@/components/ui/Button";

type PromptResultPanelProps = {
  output: string;
  provider: "llm" | "template" | "rules" | null;
  comfyNode?: string;
  limits?: {
    minChars?: number;
    maxChars: number;
  };
  copied: boolean;
  onCopy: () => void;
  extraMeta?: string;
};

export default function PromptResultPanel({
  output,
  provider,
  comfyNode,
  limits,
  copied,
  onCopy,
  extraMeta,
}: PromptResultPanelProps) {
  if (!output) {
    return null;
  }

  return (
    <ToolSection>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="type-heading">Generated prompt</h2>
          {provider && (
            <p className="type-caption mt-1">
              via {provider === "llm" ? "LLM" : provider === "rules" ? "rules" : "template"}
              {limits && (
                <>
                  {" "}
                  · {limits.minChars ? `${limits.minChars}–` : ""}
                  {limits.maxChars} char limit · {output.length} chars
                </>
              )}
              {extraMeta ? ` · ${extraMeta}` : ""}
            </p>
          )}
        </div>
        <Button variant="secondary" onClick={onCopy}>
          {copied ? "Copied!" : "Copy for ComfyUI"}
        </Button>
      </div>

      <pre className="type-code overflow-x-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-5 !text-[var(--tint-success-text)]">
        {output}
      </pre>

      {comfyNode && (
        <p className="type-caption">
          Paste into <code className="type-code">{comfyNode}</code>
        </p>
      )}
    </ToolSection>
  );
}
