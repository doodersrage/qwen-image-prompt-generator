"use client";

import { useEffect } from "react";

const SHORTCUTS: Array<{ combo: string; action: string; selector?: string }> = [
  { combo: "Ctrl+Enter", action: "generate", selector: "[data-action='primary-generate']" },
  { combo: "Ctrl+Shift+C", action: "copy-pair", selector: "[data-action='copy-pair']" },
  { combo: "Ctrl+Shift+G", action: "queue-comfyui", selector: "[data-action='send-comfyui']" },
];

export default function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const ctrl = event.ctrlKey || event.metaKey;
      if (ctrl && event.shiftKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        document.querySelector<HTMLElement>("[data-action='send-comfyui']")?.click();
        return;
      }
      if (ctrl && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        document.querySelector<HTMLElement>("[data-action='copy-pair']")?.click();
        return;
      }
      if (ctrl && event.key === "Enter") {
        event.preventDefault();
        document.querySelector<HTMLElement>("[data-action='primary-generate']")?.click();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return null;
}

export function keyboardShortcutHelp(): string {
  return SHORTCUTS.map((entry) => `${entry.combo}: ${entry.action}`).join(" · ");
}
