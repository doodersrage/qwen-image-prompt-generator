"use client";

import { modelUsesNegativePrompt } from "./prompt-pair";
import type { ComfyImageModel } from "./comfy-models";
import {
  DEFAULT_NEGATIVE_PROFILES,
  fetchNegativeWithProfile,
} from "./negative-profiles";
import { resolveContextNegativeProfile } from "./context-negative-profile";
import { loadComfyUiSettings } from "./comfyui-settings";
import type { AthleticSport } from "./athletic-sport-profiles";

export async function resolveQueueNegativePrompt(input: {
  model: ComfyImageModel | string;
  hints?: string;
  sport?: AthleticSport | null;
  tool?: string;
  explicitNegative?: string;
}): Promise<string | undefined> {
  const explicit = input.explicitNegative?.trim();
  if (explicit) {
    return explicit;
  }

  const settings = loadComfyUiSettings();
  if (settings.autoNegativeOnQueue === false) {
    return undefined;
  }

  if (!modelUsesNegativePrompt(input.model)) {
    return undefined;
  }

  const profiles =
    settings.negativeProfiles?.length
      ? settings.negativeProfiles
      : DEFAULT_NEGATIVE_PROFILES;
  const profile = resolveContextNegativeProfile(
    profiles,
    settings.selectedNegativeProfileId,
    {
      tool: input.tool,
      model: input.model,
      hints: input.hints,
      sport: input.sport,
    },
  );

  return (
    (await fetchNegativeWithProfile({
      profile,
      hints: input.hints,
      sport: input.sport,
    })) ?? undefined
  );
}
