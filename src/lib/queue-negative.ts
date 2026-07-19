"use client";

import { modelUsesNegativePrompt } from "./prompt-pair";
import type { ComfyImageModel } from "./comfy-models";
import {
  DEFAULT_NEGATIVE_PROFILES,
  fetchNegativeWithProfile,
  resolveNegativeProfile,
} from "./negative-profiles";
import { loadComfyUiSettings } from "./comfyui-settings";
import type { AthleticSport } from "./athletic-sport-profiles";

export async function resolveQueueNegativePrompt(input: {
  model: ComfyImageModel | string;
  hints?: string;
  sport?: AthleticSport | null;
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
  const profile = resolveNegativeProfile(
    profiles,
    settings.selectedNegativeProfileId,
  );

  return (
    (await fetchNegativeWithProfile({
      profile,
      hints: input.hints,
      sport: input.sport,
    })) ?? undefined
  );
}
