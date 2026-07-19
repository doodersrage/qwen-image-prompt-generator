import type { WebhookJobPayload } from "./webhook-settings";
import { dispatchWebhook } from "./webhook-settings";

export const WEBHOOK_LOG_KEY = "comfy-prompt-webhook-log-v1";
export const WEBHOOK_LOG_UPDATED_EVENT = "webhook-log-updated";

export type WebhookLogEntry = {
  id: string;
  timestamp: number;
  event: WebhookJobPayload["event"];
  ok: boolean;
  url?: string;
  message?: string;
  payload: WebhookJobPayload;
};

const MAX_LOG_ENTRIES = 40;

export function loadWebhookLog(): WebhookLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(WEBHOOK_LOG_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw) as WebhookLogEntry[];
  } catch {
    return [];
  }
}

function saveWebhookLog(entries: WebhookLogEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(WEBHOOK_LOG_KEY, JSON.stringify(entries.slice(0, MAX_LOG_ENTRIES)));
  window.dispatchEvent(new CustomEvent(WEBHOOK_LOG_UPDATED_EVENT));
}

export function appendWebhookLogEntry(input: {
  ok: boolean;
  url?: string;
  message?: string;
  payload: WebhookJobPayload;
}): WebhookLogEntry {
  const entry: WebhookLogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    event: input.payload.event,
    ok: input.ok,
    url: input.url,
    message: input.message,
    payload: input.payload,
  };
  saveWebhookLog([entry, ...loadWebhookLog()]);
  return entry;
}

export function clearWebhookLog(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(WEBHOOK_LOG_KEY);
  window.dispatchEvent(new CustomEvent(WEBHOOK_LOG_UPDATED_EVENT));
}

export async function retryWebhookLogEntry(entry: WebhookLogEntry): Promise<boolean> {
  const ok = await dispatchWebhook(entry.payload);
  appendWebhookLogEntry({
    ok,
    url: entry.url,
    message: ok ? "Retried successfully" : "Retry failed",
    payload: entry.payload,
  });
  return ok;
}
