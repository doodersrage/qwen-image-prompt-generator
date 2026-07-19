import {
  type ComfyUiRuntimeConfig,
  stripEmptyComfyUiRuntime,
  DEFAULT_NEGATIVE_TOKEN,
  DEFAULT_POSITIVE_TOKEN,
  type CustomWorkflowToken,
  type WorkflowParamValues,
} from "./comfyui-config";

export const COMFYUI_SETTINGS_KEY = "comfyui-settings-v4";

export type LoraLibraryEntry = {
  id: string;
  label: string;
  triggerPhrase: string;
  tokenValue: string;
};

export type ComfyUiSettings = {
  useServerDefaults: boolean;
  apiUrl?: string;
  positiveToken?: string;
  negativeToken?: string;
  workflowJson?: string;
  queueParams?: WorkflowParamValues;
  customTokens?: CustomWorkflowToken[];
  loraLibrary?: LoraLibraryEntry[];
  notifyOnComplete?: boolean;
  /** Auto-fetch negative prompt when queueing SD-family models. */
  autoNegativeOnQueue?: boolean;
  /** Prefer ComfyUI WebSocket progress updates over polling-only status. */
  useWebSocketProgress?: boolean;
  /** Saved negative presets for queue / copy pair. */
  negativeProfiles?: import("./negative-profiles").NegativeProfile[];
  selectedNegativeProfileId?: string;
};

export const DEFAULT_COMFYUI_SETTINGS: ComfyUiSettings = {
  useServerDefaults: true,
  apiUrl: "",
  positiveToken: DEFAULT_POSITIVE_TOKEN,
  negativeToken: DEFAULT_NEGATIVE_TOKEN,
  workflowJson: "",
  queueParams: {
    width: "1024",
    height: "1024",
    cfg: "7",
    steps: "20",
  },
  customTokens: [],
  loraLibrary: [],
  notifyOnComplete: false,
  autoNegativeOnQueue: true,
  useWebSocketProgress: false,
  negativeProfiles: [],
  selectedNegativeProfileId: "general-sd",
};

const LORA_TOKEN_PREFIX = "{{LORA_";

export function mergeLoraLibraryIntoCustomTokens(
  settings: ComfyUiSettings,
): ComfyUiSettings {
  const library = settings.loraLibrary ?? [];
  const manualTokens = (settings.customTokens ?? []).filter(
    (entry) => !entry.token.trim().startsWith(LORA_TOKEN_PREFIX),
  );
  const loraTokens: CustomWorkflowToken[] = library
    .filter((entry) => entry.id.trim())
    .map((entry) => ({
      token: `{{LORA_${entry.id.trim()}}}`,
      value: entry.tokenValue,
    }));

  return {
    ...settings,
    customTokens: [...manualTokens, ...loraTokens],
  };
}

const LEGACY_SETTINGS_KEYS = [
  "comfyui-settings-v3",
  "comfyui-settings-v2",
  "comfyui-settings-v1",
];

function migrateLegacySettings(raw: string): ComfyUiSettings {
  try {
    const parsed = JSON.parse(raw) as Partial<
      ComfyUiSettings & { positiveNodeId?: string; negativeNodeId?: string }
    >;
    return {
      ...DEFAULT_COMFYUI_SETTINGS,
      useServerDefaults: parsed.useServerDefaults ?? true,
      apiUrl: parsed.apiUrl ?? "",
      positiveToken: parsed.positiveToken ?? DEFAULT_POSITIVE_TOKEN,
      negativeToken: parsed.negativeToken ?? DEFAULT_NEGATIVE_TOKEN,
      workflowJson: parsed.workflowJson ?? "",
      queueParams: parsed.queueParams ?? DEFAULT_COMFYUI_SETTINGS.queueParams,
      customTokens: parsed.customTokens ?? [],
      loraLibrary: parsed.loraLibrary ?? [],
      notifyOnComplete: parsed.notifyOnComplete ?? false,
    };
  } catch {
    return DEFAULT_COMFYUI_SETTINGS;
  }
}

export function loadComfyUiSettings(): ComfyUiSettings {
  if (typeof window === "undefined") {
    return DEFAULT_COMFYUI_SETTINGS;
  }

  try {
    const current = window.localStorage.getItem(COMFYUI_SETTINGS_KEY);
    if (current) {
      const parsed = JSON.parse(current) as Partial<ComfyUiSettings>;
      return { ...DEFAULT_COMFYUI_SETTINGS, ...parsed };
    }

    for (const legacyKey of LEGACY_SETTINGS_KEYS) {
      const legacy = window.localStorage.getItem(legacyKey);
      if (legacy) {
        const migrated = migrateLegacySettings(legacy);
        saveComfyUiSettings(migrated);
        return migrated;
      }
    }

    return DEFAULT_COMFYUI_SETTINGS;
  } catch {
    return DEFAULT_COMFYUI_SETTINGS;
  }
}

export function saveComfyUiSettings(settings: ComfyUiSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(COMFYUI_SETTINGS_KEY, JSON.stringify(settings));
  for (const legacyKey of LEGACY_SETTINGS_KEYS) {
    window.localStorage.removeItem(legacyKey);
  }
}

export function resetComfyUiSettings(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(COMFYUI_SETTINGS_KEY);
  for (const legacyKey of LEGACY_SETTINGS_KEYS) {
    window.localStorage.removeItem(legacyKey);
  }
}

export function comfyUiSettingsToRuntime(
  settings: ComfyUiSettings,
): ComfyUiRuntimeConfig | undefined {
  if (settings.useServerDefaults) {
    return undefined;
  }

  return stripEmptyComfyUiRuntime({
    apiUrl: settings.apiUrl,
    workflowJson: settings.workflowJson,
    positiveToken:
      settings.positiveToken === DEFAULT_POSITIVE_TOKEN
        ? undefined
        : settings.positiveToken,
    negativeToken:
      settings.negativeToken === DEFAULT_NEGATIVE_TOKEN
        ? undefined
        : settings.negativeToken,
    queueParams: settings.queueParams,
    customTokens: settings.customTokens,
  });
}

export function placeholderTokensFromSettings(
  settings: ComfyUiSettings,
): { positive: string; negative: string } {
  return {
    positive: settings.positiveToken?.trim() || DEFAULT_POSITIVE_TOKEN,
    negative: settings.negativeToken?.trim() || DEFAULT_NEGATIVE_TOKEN,
  };
}
