"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { galleryEntryViewUrls, loadComfyGallery } from "@/lib/comfyui-gallery";
import { loadScheduledBatchConfig } from "@/lib/scheduled-batch";
import { loadActiveProjectId, loadPromptProjects } from "@/lib/prompt-projects";
import { usePromptHistory } from "@/hooks/usePromptHistory";
import { Button } from "@/components/ui/Button";

export default function HomeDashboard() {
  const { entries } = usePromptHistory();
  const [gallery, setGallery] = useState(() => loadComfyGallery());
  const [scheduled, setScheduled] = useState(loadScheduledBatchConfig());
  const [activeProjectId, setActiveProjectId] = useState<string | undefined>();
  const [projects, setProjects] = useState(loadPromptProjects());

  useEffect(() => {
    const refresh = () => {
      setGallery(loadComfyGallery());
      setScheduled(loadScheduledBatchConfig());
      setActiveProjectId(loadActiveProjectId());
      setProjects(loadPromptProjects());
    };
    refresh();
    window.addEventListener("comfyui-gallery-updated", refresh);
    return () => window.removeEventListener("comfyui-gallery-updated", refresh);
  }, []);

  const pending = useMemo(
    () => gallery.filter((entry) => entry.status === "pending" || entry.status === "running"),
    [gallery],
  );
  const recentCompleted = useMemo(
    () =>
      gallery
        .filter((entry) => entry.status === "completed")
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
        .slice(0, 6),
    [gallery],
  );
  const activeProject = projects.find((project) => project.id === activeProjectId);

  return (
    <section className="mb-8 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Dashboard</h2>
          <p className="text-sm text-zinc-500">
            Pending jobs, recent outputs, and active project at a glance.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/gallery" className="ui-btn-secondary !min-h-9 px-4 text-sm">
            Gallery
          </Link>
          <Link href="/studio" className="ui-btn-secondary !min-h-9 px-4 text-sm">
            Studio
          </Link>
          <Link href="/settings" className="ui-btn-secondary !min-h-9 px-4 text-sm">
            Settings
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending ComfyUI" value={String(pending.length)} />
        <StatCard label="History entries" value={String(entries.length)} />
        <StatCard
          label="Scheduled batch"
          value={scheduled.enabled ? `Every ${scheduled.intervalMinutes}m` : "Off"}
        />
        <StatCard label="Active project" value={activeProject?.name ?? "None"} />
      </div>

      {recentCompleted.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Recent outputs
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {recentCompleted.map((entry) => {
              const thumb = galleryEntryViewUrls(entry)[0];
              return (
                <Link
                  key={entry.id}
                  href="/gallery"
                  className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center p-2 text-xs text-zinc-500">
                      No preview
                    </div>
                  )}
                  <p className="line-clamp-2 p-2 text-[11px] text-zinc-400">{entry.prompt}</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/topics">
          <Button variant="secondary" className="!min-h-9">
            Topics batch
          </Button>
        </Link>
        <Link href="/variations?matrix=1">
          <Button variant="secondary" className="!min-h-9">
            Prompt matrix
          </Button>
        </Link>
        <Link href="/variations">
          <Button variant="secondary" className="!min-h-9">
            Variations
          </Button>
        </Link>
      </div>
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
