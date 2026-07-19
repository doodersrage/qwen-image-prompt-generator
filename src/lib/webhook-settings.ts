import type { WorkflowParamValues } from "./comfyui-config";
import { appendWebhookLogEntry } from "./webhook-log";

export const WEBHOOK_SETTINGS_KEY = "comfy-prompt-webhook-v1";

export type WebhookSettings = {
  enabled: boolean;
  url?: string;
  secret?: string;
};

export const DEFAULT_WEBHOOK_SETTINGS: WebhookSettings = {
  enabled: false,
  url: "",
  secret: "",
};

export function loadWebhookSettings(): WebhookSettings {
  if (typeof window === "undefined") {
    return DEFAULT_WEBHOOK_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(WEBHOOK_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_WEBHOOK_SETTINGS;
    }
    return { ...DEFAULT_WEBHOOK_SETTINGS, ...(JSON.parse(raw) as WebhookSettings) };
  } catch {
    return DEFAULT_WEBHOOK_SETTINGS;
  }
}

export function saveWebhookSettings(settings: WebhookSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WEBHOOK_SETTINGS_KEY, JSON.stringify(settings));
}

export type WebhookEvent =
  | "comfyui.job.completed"
  | "comfyui.job.error"
  | "comfyui.job.queued"
  | "comfyui.batch.completed"
  | "scheduled.batch.run"
  | "scheduled.batch.completed";

export type WebhookJobPayload = {
  event: WebhookEvent;
  promptId?: string;
  prompt?: string;
  negativePrompt?: string;
  model?: string;
  tool?: string;
  status?: string;
  imageCount?: number;
  queueParams?: WorkflowParamValues;
  queued?: number;
  failed?: number;
  completedAt: number;
  message?: string;
};

export async function dispatchWebhook(payload: WebhookJobPayload): Promise<boolean> {
  const settings = loadWebhookSettings();
  if (!settings.enabled || !settings.url?.trim()) {
    return false;
  }

  try {
    const response = await fetch("/api/webhooks/dispatch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: settings.url.trim(),
        secret: settings.secret?.trim() || undefined,
        payload,
      }),
    });
    const ok = response.ok;
    appendWebhookLogEntry({
      ok,
      url: settings.url.trim(),
      message: ok ? "Delivered" : "Dispatch failed",
      payload,
    });
    return ok;
  } catch (error) {
    appendWebhookLogEntry({
      ok: false,
      url: settings.url.trim(),
      message: error instanceof Error ? error.message : "Dispatch error",
      payload,
    });
    return false;
  }
}
