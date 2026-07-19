import { DEFAULT_QWEN_MODEL, type ComfyImageModel } from "./comfy-models";
import { DEFAULT_VARIATION_SETTINGS } from "./variation-settings";
import type { DetailLevel } from "./detail-level";

export const SETTINGS_CACHE_KEY = "comfy-prompt-tool-settings-v1";

export type SharedToolSettings = {
  model: ComfyImageModel;
  detail: DetailLevel;
  /** Shared across people-focused tools; rolls catalog wardrobe when enabled. */
  alwaysIncludeClothing?: boolean;
  /** Pin catalog wardrobe across Character/Duo/Batch generations. */
  lockedWardrobeId?: string;
  /** Pin scene location across people-focused generators. */
  lockedLocation?: string;
  /** Pin variation/environment seed for reproducible rolls. */
  lockedVariationSeed?: string;
  /** Auto-apply rule fixes when lint reports errors after generation. */
  autoFixRules?: boolean;
  /** Saved workflow assignment used when queueing from generators. */
  selectedWorkflowFileId?: string;
  /** @deprecated Use selectedWorkflowFileId */
  selectedWorkflowPresetId?: string;
};

export type GenerateToolCache = {
  mode?: "positive" | "negative";
  variationEnabled?: boolean;
  variationStrength?: number;
  distinctPeople?: boolean;
  sportPresetId?: string;
};

export type FormatToolCache = {
  mode?: "positive" | "negative";
  smartFormat?: boolean;
};

export type RandomSceneToolCache = {
  genre?: string;
  includePeople?: boolean;
  wildness?: number;
};

import type { CharacterPresetOptions } from "./character-options";

export type CharacterToolCache = {
  hints?: string;
  portraitStyle?: "portrait" | "full-body" | "action";
  variationStrength?: number;
} & Partial<CharacterPresetOptions>;

import type { BackgroundPresetOptions } from "./background-options";

export type BackgroundToolCache = {
  settingType?: string;
  timeOfDay?: string;
  mood?: string;
  surfaceMaterials?: string;
} & Partial<Omit<BackgroundPresetOptions, "surfaceMaterials">>;

export type ImagePromptToolCache = {
  focus?: "full" | "subject" | "background" | "style";
  extraHints?: string;
};

export type TopicToolCache = {
  seedTopic?: string;
  count?: number;
  variety?: number;
  batchTarget?: "generate" | "duo";
};

export type DuoToolCache = {
  hints?: string;
  portraitStyle?: "portrait" | "full-body" | "action";
  variationStrength?: number;
  sportPresetId?: string;
  teamKit?: boolean;
  batchCount?: number;
};

export type NegativeToolCache = {
  sport?: string;
  preserveSubject?: boolean;
  extra?: string;
};

export type ComposeToolCache = {
  hints?: string;
  subjectMode?: "character" | "duo";
  portraitStyle?: "portrait" | "full-body" | "action";
  variationStrength?: number;
  teamKit?: boolean;
  composeStyle?: "layered" | "inline";
  settingType?: string;
  timeOfDay?: string;
  mood?: string;
} & Partial<CharacterPresetOptions> &
  Partial<Omit<BackgroundPresetOptions, "surfaceMaterials">> & {
    surfaceMaterials?: string;
  };

export type StudioToolCache = {
  compareModelB?: string;
  templateId?: string;
  templateSlots?: Record<string, string>;
  catalogTab?: "clothing" | "locations";
  locationBlocklist?: string[];
};

export type VariationsToolCache = {
  hints?: string;
  count?: number;
  variationStrength?: number;
  target?: "generate" | "character" | "duo";
  portraitStyle?: "portrait" | "full-body" | "action";
  sportPresetId?: string;
};

export type ToolSettingsCache = {
  generate?: GenerateToolCache;
  format?: FormatToolCache;
  randomScene?: RandomSceneToolCache;
  background?: BackgroundToolCache;
  character?: CharacterToolCache;
  imagePrompt?: ImagePromptToolCache;
  topics?: TopicToolCache;
  duo?: DuoToolCache;
  negative?: NegativeToolCache;
  compose?: ComposeToolCache;
  studio?: StudioToolCache;
  variations?: VariationsToolCache;
};

export type SettingsCache = {
  shared: SharedToolSettings;
  tools: ToolSettingsCache;
};

export const DEFAULT_SHARED_SETTINGS: SharedToolSettings = {
  model: DEFAULT_QWEN_MODEL,
  detail: "balanced",
  alwaysIncludeClothing: true,
  autoFixRules: true,
};

export const DEFAULT_GENERATE_TOOL_CACHE: GenerateToolCache = {
  mode: "positive",
  variationEnabled: DEFAULT_VARIATION_SETTINGS.enabled,
  variationStrength: DEFAULT_VARIATION_SETTINGS.strength,
  distinctPeople: true,
};

export const DEFAULT_FORMAT_TOOL_CACHE: FormatToolCache = {
  mode: "positive",
  smartFormat: true,
};

export const DEFAULT_RANDOM_SCENE_TOOL_CACHE: RandomSceneToolCache = {
  genre: "",
  includePeople: true,
  wildness: 65,
};

export const DEFAULT_CHARACTER_TOOL_CACHE: CharacterToolCache = {
  hints: "",
  portraitStyle: "portrait",
  variationStrength: 50,
};

export const DEFAULT_BACKGROUND_TOOL_CACHE: BackgroundToolCache = {
  settingType: "",
  timeOfDay: "",
  mood: "",
};

export const DEFAULT_IMAGE_PROMPT_TOOL_CACHE: ImagePromptToolCache = {
  focus: "full",
  extraHints: "",
};

export const DEFAULT_TOPIC_TOOL_CACHE: TopicToolCache = {
  seedTopic: "",
  count: 10,
  variety: 50,
  batchTarget: "generate",
};

export const DEFAULT_DUO_TOOL_CACHE: DuoToolCache = {
  hints: "",
  portraitStyle: "action",
  variationStrength: 50,
  sportPresetId: "",
  teamKit: false,
  batchCount: 3,
};

export const DEFAULT_NEGATIVE_TOOL_CACHE: NegativeToolCache = {
  sport: "",
  preserveSubject: false,
  extra: "",
};

export const DEFAULT_COMPOSE_TOOL_CACHE: ComposeToolCache = {
  hints: "",
  subjectMode: "duo",
  portraitStyle: "action",
  variationStrength: 50,
  teamKit: false,
  composeStyle: "layered",
  settingType: "",
  timeOfDay: "",
  mood: "",
};

export const DEFAULT_STUDIO_TOOL_CACHE: StudioToolCache = {
  compareModelB: "flux-2-klein",
  templateId: "duo-sport-race",
  templateSlots: {},
  catalogTab: "clothing",
  locationBlocklist: [],
};

export const DEFAULT_VARIATIONS_TOOL_CACHE: VariationsToolCache = {
  hints: "",
  count: 4,
  variationStrength: 65,
  target: "generate",
  portraitStyle: "action",
  sportPresetId: "",
};

function isDetailLevel(value: unknown): value is DetailLevel {
  return value === "concise" || value === "balanced" || value === "rich";
}

export function loadSettingsCache(): SettingsCache {
  if (typeof window === "undefined") {
    return { shared: DEFAULT_SHARED_SETTINGS, tools: {} };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_CACHE_KEY);
    if (!raw) {
      return { shared: DEFAULT_SHARED_SETTINGS, tools: {} };
    }

    const parsed = JSON.parse(raw) as Partial<SettingsCache>;
    const shared = {
      ...DEFAULT_SHARED_SETTINGS,
      ...parsed.shared,
    };

    if (!isDetailLevel(shared.detail)) {
      shared.detail = DEFAULT_SHARED_SETTINGS.detail;
    }

    return {
      shared,
      tools: parsed.tools ?? {},
    };
  } catch {
    return { shared: DEFAULT_SHARED_SETTINGS, tools: {} };
  }
}

export function saveSettingsCache(cache: SettingsCache): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(cache));
}

export function saveSharedSettings(shared: SharedToolSettings): void {
  const cache = loadSettingsCache();
  saveSettingsCache({ ...cache, shared });
}

export function saveToolSettings<K extends keyof ToolSettingsCache>(
  tool: K,
  settings: ToolSettingsCache[K],
): void {
  const cache = loadSettingsCache();
  saveSettingsCache({
    ...cache,
    tools: {
      ...cache.tools,
      [tool]: {
        ...cache.tools[tool],
        ...settings,
      },
    },
  });
}

export function loadToolSettings<K extends keyof ToolSettingsCache>(
  tool: K,
  defaults: NonNullable<ToolSettingsCache[K]>,
): NonNullable<ToolSettingsCache[K]> {
  const cache = loadSettingsCache();
  return {
    ...defaults,
    ...(cache.tools[tool] ?? {}),
  } as NonNullable<ToolSettingsCache[K]>;
}
