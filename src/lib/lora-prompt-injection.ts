"use client";

import { loadComfyUiSettings } from "./comfyui-settings";

export function injectLoraTriggers(prompt: string): string {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return trimmed;
  }

  const library = loadComfyUiSettings().loraLibrary ?? [];
  const triggers = library
    .map((entry) => entry.triggerPhrase?.trim())
    .filter(Boolean) as string[];

  if (triggers.length === 0) {
    return trimmed;
  }

  const lower = trimmed.toLowerCase();
  const missing = triggers.filter(
    (trigger) => !lower.includes(trigger.toLowerCase()),
  );

  if (missing.length === 0) {
    return trimmed;
  }

  return `${trimmed}, ${missing.join(", ")}`;
}
