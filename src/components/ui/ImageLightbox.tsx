"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";

export type ImageLightboxState = {
  images: string[];
  index: number;
  title?: string;
};

type ImageLightboxProps = {
  state: ImageLightboxState | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export default function ImageLightbox({
  state,
  onClose,
  onIndexChange,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const open = Boolean(state && state.images.length > 0);
  const images = state?.images ?? [];
  const index = state?.index ?? 0;
  const currentUrl = images[index] ?? images[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
        return;
      }

      if (event.key === "ArrowRight" && index < images.length - 1) {
        onIndexChange(index + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, index, images.length, onClose, onIndexChange]);

  if (!mounted || !open || !currentUrl) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={state?.title ?? "Image preview"}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close image preview"
      />

      <div
        className="relative z-10 flex max-h-[92vh] w-full max-w-6xl flex-col gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <p className="type-overline text-[var(--text-muted)]">Image preview</p>
            {state?.title ? (
              <p className="type-caption line-clamp-2 text-[var(--text-secondary)]">
                {state.title}
              </p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            className="!min-h-9 shrink-0 px-3 type-caption"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

        <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-overlay,0_24px_80px_rgb(0_0_0/0.45))]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={state?.title ?? "Gallery image preview"}
            className="max-h-[min(72vh,900px)] w-full object-contain bg-[var(--bg-subtle)]"
          />

          {images.length > 1 ? (
            <>
              <Button
                variant="secondary"
                className="absolute left-3 top-1/2 !min-h-9 -translate-y-1/2 px-3 type-caption"
                disabled={index <= 0}
                onClick={() => onIndexChange(index - 1)}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                className="absolute right-3 top-1/2 !min-h-9 -translate-y-1/2 px-3 type-caption"
                disabled={index >= images.length - 1}
                onClick={() => onIndexChange(index + 1)}
              >
                Next
              </Button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {images.length > 1 ? (
            <p className="type-caption text-[var(--text-tertiary)]">
              Image {index + 1} of {images.length}
            </p>
          ) : (
            <span />
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={currentUrl}
              target="_blank"
              rel="noreferrer"
              className="ui-btn-ghost !min-h-9 px-4 type-caption"
            >
              Open in new tab
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
