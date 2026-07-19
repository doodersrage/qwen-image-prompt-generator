export const SCHEDULED_BATCH_KEY = "comfy-scheduled-batch-v1";

export type ScheduledBatchConfig = {
  enabled: boolean;
  intervalMinutes: number;
  lastRunAt?: number;
  target: "random-scene" | "topics";
  count: number;
  autoQueueComfyUi: boolean;
  genre?: string;
};

export const DEFAULT_SCHEDULED_BATCH: ScheduledBatchConfig = {
  enabled: false,
  intervalMinutes: 60,
  target: "random-scene",
  count: 3,
  autoQueueComfyUi: false,
};

export function loadScheduledBatchConfig(): ScheduledBatchConfig {
  if (typeof window === "undefined") {
    return DEFAULT_SCHEDULED_BATCH;
  }
  try {
    const raw = window.localStorage.getItem(SCHEDULED_BATCH_KEY);
    if (!raw) {
      return DEFAULT_SCHEDULED_BATCH;
    }
    return { ...DEFAULT_SCHEDULED_BATCH, ...(JSON.parse(raw) as ScheduledBatchConfig) };
  } catch {
    return DEFAULT_SCHEDULED_BATCH;
  }
}

export function saveScheduledBatchConfig(config: ScheduledBatchConfig): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(SCHEDULED_BATCH_KEY, JSON.stringify(config));
}

export function shouldRunScheduledBatch(config: ScheduledBatchConfig, now = Date.now()): boolean {
  if (!config.enabled) {
    return false;
  }
  const intervalMs = Math.max(5, config.intervalMinutes) * 60_000;
  const last = config.lastRunAt ?? 0;
  return now - last >= intervalMs;
}
