"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import {
  formatGallerySlideshowInterval,
  GALLERY_SLIDESHOW_TRANSITION_LABELS,
  GALLERY_SLIDESHOW_TRANSITION_OPTIONS,
  resolveGallerySlideshowTransitionMs,
  type GallerySlideshowTransition,
} from "@/lib/comfyui-gallery";

export type ImageLightboxState = {
  images: string[];
  index: number;
  title?: string;
  /** Optional per-image titles; falls back to `title` when omitted. */
  titles?: string[];
};

export type ImageLightboxSlideshowOptions = {
  playing: boolean;
  intervalMs: number;
  intervalOptions?: readonly number[];
  transition: GallerySlideshowTransition;
  transitionOptions?: readonly GallerySlideshowTransition[];
  onPlayingChange: (playing: boolean) => void;
  onIntervalChange?: (intervalMs: number) => void;
  onTransitionChange?: (transition: GallerySlideshowTransition) => void;
};

type ImageLightboxProps = {
  state: ImageLightboxState | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  slideshow?: ImageLightboxSlideshowOptions;
};

function resolveSlideDirection(
  fromIndex: number,
  toIndex: number,
  totalImages: number,
  slideshowPlaying: boolean,
): 1 | -1 {
  if (toIndex > fromIndex) {
    return 1;
  }

  if (toIndex < fromIndex) {
    if (toIndex === 0 && fromIndex === totalImages - 1 && slideshowPlaying) {
      return 1;
    }

    return -1;
  }

  return 1;
}

function resolveTransitionClasses(
  transition: GallerySlideshowTransition,
  direction: 1 | -1,
): { enter: string; exit: string } {
  switch (transition) {
    case "fade":
      return { enter: "lightbox-fade-enter", exit: "lightbox-fade-exit" };
    case "zoom":
      return { enter: "lightbox-zoom-enter", exit: "lightbox-zoom-exit" };
    case "none":
      return { enter: "", exit: "" };
    case "slide":
    default:
      return direction === 1
        ? {
            enter: "lightbox-slide-enter-forward",
            exit: "lightbox-slide-exit-forward",
          }
        : {
            enter: "lightbox-slide-enter-back",
            exit: "lightbox-slide-exit-back",
          };
  }
}

export default function ImageLightbox({
  state,
  onClose,
  onIndexChange,
  slideshow,
}: ImageLightboxProps) {
  const [mounted, setMounted] = useState(false);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [previousIndex, setPreviousIndex] = useState<number | null>(null);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [titleAnimating, setTitleAnimating] = useState(false);
  const playlistKeyRef = useRef("");
  const open = Boolean(state && state.images.length > 0);
  const images = state?.images ?? [];
  const index = state?.index ?? 0;
  const transition = slideshow?.transition ?? "slide";
  const transitionMs = resolveGallerySlideshowTransitionMs(transition);
  const currentUrl = images[displayIndex] ?? images[0];
  const currentTitle = state?.titles?.[displayIndex] ?? state?.title;
  const canGoPrevious = index > 0;
  const canGoNext = index < images.length - 1;
  const slideshowEnabled = Boolean(slideshow && images.length > 1);
  const isTransitioning = previousIndex !== null && transitionMs > 0;
  const transitionOptions =
    slideshow?.transitionOptions ?? GALLERY_SLIDESHOW_TRANSITION_OPTIONS;

  const pauseSlideshow = () => {
    if (slideshow?.playing) {
      slideshow.onPlayingChange(false);
    }
  };

  const goToIndex = (nextIndex: number, manual = false) => {
    if (manual) {
      pauseSlideshow();
    }
    onIndexChange(nextIndex);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPreviousIndex(null);
      setDisplayIndex(0);
      setTitleAnimating(false);
      return;
    }

    const playlistKey = images.join("\u0000");
    if (playlistKeyRef.current !== playlistKey) {
      playlistKeyRef.current = playlistKey;
      setPreviousIndex(null);
      setDisplayIndex(index);
      setTitleAnimating(false);
      return;
    }

    if (index === displayIndex) {
      return;
    }

    if (transition === "none") {
      setDisplayIndex(index);
      return;
    }

    const direction = resolveSlideDirection(
      displayIndex,
      index,
      images.length,
      Boolean(slideshow?.playing),
    );

    setSlideDirection(direction);
    setPreviousIndex(displayIndex);
    setDisplayIndex(index);
    setTitleAnimating(true);
  }, [
    open,
    index,
    displayIndex,
    images,
    slideshow?.playing,
    transition,
  ]);

  useEffect(() => {
    if (previousIndex === null || transitionMs === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPreviousIndex(null);
      setTitleAnimating(false);
    }, transitionMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [previousIndex, transitionMs]);

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

      if (slideshowEnabled && event.key === " ") {
        event.preventDefault();
        slideshow?.onPlayingChange(!slideshow.playing);
        return;
      }

      if (event.key === "ArrowLeft" && index > 0) {
        goToIndex(index - 1, true);
        return;
      }

      if (event.key === "ArrowRight" && index < images.length - 1) {
        goToIndex(index + 1, true);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, index, images.length, onClose, slideshow, slideshowEnabled]);

  useEffect(() => {
    if (
      !open ||
      !slideshow?.playing ||
      images.length <= 1 ||
      isTransitioning
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      const nextIndex = index < images.length - 1 ? index + 1 : 0;
      onIndexChange(nextIndex);
    }, slideshow.intervalMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    open,
    slideshow?.playing,
    slideshow?.intervalMs,
    index,
    images.length,
    onIndexChange,
    isTransitioning,
  ]);

  if (!mounted || !open || !currentUrl) {
    return null;
  }

  const { enter: enterClass, exit: exitClass } = resolveTransitionClasses(
    transition,
    slideDirection,
  );
  const imageClassName =
    "mx-auto max-h-[min(72vh,900px)] w-full object-contain bg-[var(--bg-subtle)]";

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={state?.title ?? "Image preview"}
      style={
        {
          "--lightbox-transition-duration": `${transitionMs}ms`,
        } as CSSProperties
      }
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
            <p className="type-overline text-[var(--text-muted)]">
              {slideshow?.playing ? "Slideshow" : "Image preview"}
            </p>
            {currentTitle ? (
              <p
                key={`${displayIndex}-${currentTitle}`}
                className={`type-caption line-clamp-2 text-[var(--text-secondary)]${
                  titleAnimating && transitionMs > 0
                    ? " lightbox-title-fade-in"
                    : ""
                }`}
              >
                {currentTitle}
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

        <div className="relative min-h-[min(40vh,420px)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-[var(--shadow-overlay,0_24px_80px_rgb(0_0_0/0.45))]">
          <div className="relative flex min-h-[min(40vh,420px)] items-center justify-center">
            {previousIndex !== null && images[previousIndex] ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={images[previousIndex]}
                  alt=""
                  aria-hidden
                  className={`absolute inset-x-0 top-1/2 -translate-y-1/2 ${imageClassName} ${exitClass}`}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentUrl}
                  alt={currentTitle ?? "Gallery image preview"}
                  className={`relative z-[1] ${imageClassName} ${enterClass}`}
                />
              </>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentUrl}
                alt={currentTitle ?? "Gallery image preview"}
                className={`relative ${imageClassName}`}
              />
            )}
          </div>

          {images.length > 1 ? (
            <>
              <Button
                variant="secondary"
                className="absolute left-3 top-1/2 z-[2] !min-h-9 -translate-y-1/2 px-3 type-caption"
                disabled={!canGoPrevious || isTransitioning}
                onClick={() => goToIndex(index - 1, true)}
                aria-label="Previous image"
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                className="absolute right-3 top-1/2 z-[2] !min-h-9 -translate-y-1/2 px-3 type-caption"
                disabled={!canGoNext || isTransitioning}
                onClick={() => goToIndex(index + 1, true)}
                aria-label="Next image"
              >
                Next
              </Button>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {images.length > 1 ? (
            <div className="flex flex-wrap items-center gap-2">
              {slideshowEnabled ? (
                <>
                  <Button
                    variant="secondary"
                    className="!min-h-9 px-3 type-caption"
                    onClick={() =>
                      slideshow?.onPlayingChange(!slideshow.playing)
                    }
                  >
                    {slideshow?.playing ? "Pause" : "Play"}
                  </Button>
                  {slideshow?.onIntervalChange &&
                  slideshow.intervalOptions &&
                  slideshow.intervalOptions.length > 0 ? (
                    <label className="flex items-center gap-2 type-caption text-[var(--text-tertiary)]">
                      Every
                      <select
                        value={slideshow.intervalMs}
                        onChange={(event) => {
                          pauseSlideshow();
                          slideshow.onIntervalChange?.(
                            Number(event.target.value),
                          );
                        }}
                        className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-1 text-[var(--text-secondary)]"
                      >
                        {slideshow.intervalOptions.map((option) => (
                          <option key={option} value={option}>
                            {formatGallerySlideshowInterval(option)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {slideshow?.onTransitionChange &&
                  transitionOptions.length > 0 ? (
                    <label className="flex items-center gap-2 type-caption text-[var(--text-tertiary)]">
                      Effect
                      <select
                        value={transition}
                        onChange={(event) => {
                          pauseSlideshow();
                          slideshow.onTransitionChange?.(
                            event.target.value as GallerySlideshowTransition,
                          );
                        }}
                        className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-1 text-[var(--text-secondary)]"
                      >
                        {transitionOptions.map((option) => (
                          <option key={option} value={option}>
                            {GALLERY_SLIDESHOW_TRANSITION_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}
              <Button
                variant="secondary"
                className="!min-h-9 px-3 type-caption"
                disabled={!canGoPrevious || isTransitioning}
                onClick={() => goToIndex(index - 1, true)}
              >
                Previous
              </Button>
              <p className="type-caption text-[var(--text-tertiary)]">
                Image {index + 1} of {images.length}
              </p>
              <Button
                variant="secondary"
                className="!min-h-9 px-3 type-caption"
                disabled={!canGoNext || isTransitioning}
                onClick={() => goToIndex(index + 1, true)}
              >
                Next
              </Button>
            </div>
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
