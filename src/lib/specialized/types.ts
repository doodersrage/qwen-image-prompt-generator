import type { ComfyImageModel } from "../comfy-models";
import type { DetailLevel } from "../detail-level";

export type ToolLimits = {
  minChars?: number;
  maxChars: number;
  maxSentences: number;
  maxTokens: number;
};

export type ToolGenerateResult = {
  prompt: string;
  provider: "llm" | "template";
  model: ComfyImageModel;
  comfyNode: string;
  limits: ToolLimits;
  seed?: string;
  metadata?: Record<string, unknown>;
};

export type SharedGenerationOptions = {
  model: ComfyImageModel;
  detail: DetailLevel;
};

export type RandomSceneOptions = SharedGenerationOptions & {
  genre?: string;
  includePeople?: boolean;
  wildness?: number;
};

export type CharacterOptions = SharedGenerationOptions & {
  hints?: string;
  portraitStyle?: "portrait" | "full-body" | "action";
  variationStrength?: number;
};

export type BackgroundOptions = SharedGenerationOptions & {
  settingType?: string;
  timeOfDay?: string;
  mood?: string;
};

export type ImagePromptFocus = "full" | "subject" | "background" | "style";

export type ImagePromptOptions = SharedGenerationOptions & {
  imageDataUrl: string;
  mimeType?: string;
  focus?: ImagePromptFocus;
  extraHints?: string;
};
