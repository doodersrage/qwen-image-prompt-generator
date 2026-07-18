"use client";

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
    <section className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl shadow-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-zinc-200">Generated prompt</h2>
          {provider && (
            <p className="mt-1 text-xs text-zinc-500">
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
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-zinc-700 px-4 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
        >
          {copied ? "Copied!" : "Copy for ComfyUI"}
        </button>
      </div>

      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed text-emerald-300">
        {output}
      </pre>

      {comfyNode && (
        <p className="text-xs text-zinc-500">
          Paste into{" "}
          <code className="rounded bg-zinc-800 px-1 text-violet-300">{comfyNode}</code>
        </p>
      )}
    </section>
  );
}
