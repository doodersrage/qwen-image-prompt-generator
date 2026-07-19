"use client";

import Link from "next/link";
import {
  comfyUiJobStatusLabel,
  isComfyUiJobProcessing,
  type ComfyUiJobTrackerState,
} from "@/lib/comfyui-job-status";

type ComfyUiJobStatusPanelProps = {
  job: ComfyUiJobTrackerState;
  compact?: boolean;
};

function statusTone(job: ComfyUiJobTrackerState): string {
  if (job.status === "running") {
    return "text-[var(--tint-info-text)] border-[var(--tint-info-border)] bg-[var(--tint-info-bg)]";
  }
  if (job.status === "pending") {
    return "text-[var(--accent-text)] border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]";
  }
  if (job.status === "error") {
    return "text-[var(--tint-danger-text)] border-[var(--tint-danger-border)] bg-[var(--tint-danger-bg)]";
  }
  return "text-[var(--tint-success-text)] border-[var(--tint-success-border)] bg-[var(--tint-success-bg)]";
}

export default function ComfyUiJobStatusPanel({
  job,
  compact = false,
}: ComfyUiJobStatusPanelProps) {
  const processing = isComfyUiJobProcessing(job);
  const label = comfyUiJobStatusLabel(job);

  return (
    <div
      className={`ui-card overflow-hidden border ${statusTone(job)}`}
      role="status"
      aria-live="polite"
      aria-busy={processing}
    >
      <div className={`flex items-start gap-3 ${compact ? "px-3 py-2.5" : "px-4 py-3"}`}>
        {processing ? (
          <span className="ui-spinner ui-spinner-sm mt-0.5 shrink-0" aria-hidden />
        ) : (
          <span
            className={`mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
              job.status === "error" ? "bg-[var(--tint-danger)]" : "bg-[var(--tint-success)]"
            }`}
            aria-hidden
          />
        )}

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-medium ${compact ? "type-caption" : "type-body-sm"}`}>
              {job.status === "running"
                ? "ComfyUI is generating"
                : job.status === "pending"
                  ? "ComfyUI job queued"
                  : job.status === "error"
                    ? "ComfyUI job failed"
                    : "ComfyUI job finished"}
            </p>
            <span className="rounded-full border border-current/20 px-2 py-0.5 type-overline opacity-90">
              {label}
            </span>
          </div>

          {job.statusMessage?.trim() ? (
            <p className="type-caption text-[var(--text-secondary)]">{job.statusMessage}</p>
          ) : null}

          <p className="type-caption text-[var(--text-tertiary)]">
            <span className="font-mono">{job.promptId}</span>
            {job.comfyUrl ? (
              <>
                {" · "}
                <span className="break-all">{job.comfyUrl}</span>
              </>
            ) : null}
          </p>

          {!compact ? (
            <div className="pt-1">
              <Link
                href="/gallery"
                className="type-caption text-[var(--accent-text)] transition hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]"
              >
                Open gallery
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ComfyUiGalleryJobPlaceholder({
  entry,
}: {
  entry: {
    status: ComfyUiJobTrackerState["status"];
    statusMessage?: string;
    queuePosition?: number | null;
  };
}) {
  const processing = entry.status === "pending" || entry.status === "running";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
      {processing ? (
        <span className="ui-spinner ui-spinner-lg" aria-hidden />
      ) : null}
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-violet-300">
          {entry.status === "running" ? "Running" : entry.status === "pending" ? "Queued" : "Waiting"}
        </p>
        {entry.queuePosition != null && entry.queuePosition > 0 ? (
          <p className="text-[11px] text-zinc-400">
            Position {entry.queuePosition} in queue
          </p>
        ) : entry.status === "running" ? (
          <p className="text-[11px] text-zinc-400">Executing workflow…</p>
        ) : null}
        {entry.statusMessage?.trim() ? (
          <p className="text-[11px] text-zinc-600">{entry.statusMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
