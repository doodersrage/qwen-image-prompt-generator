import type { SharedToolSettings } from "./settings-cache";

export type ShareableSceneParams = {
  hints?: string;
  sportPresetId?: string;
  lockedWardrobeId?: string;
  lockedLocation?: string;
  lockedVariationSeed?: string;
};

type CompactScenePayload = {
  h?: string;
  sp?: string;
  lw?: string;
  ll?: string;
  ls?: string;
};

export function buildShareableSceneParams(input: {
  hints?: string;
  sportPresetId?: string;
  shared: Pick<
    SharedToolSettings,
    "lockedWardrobeId" | "lockedLocation" | "lockedVariationSeed"
  >;
}): ShareableSceneParams {
  return {
    hints: input.hints?.trim() || undefined,
    sportPresetId: input.sportPresetId || undefined,
    lockedWardrobeId: input.shared.lockedWardrobeId,
    lockedLocation: input.shared.lockedLocation,
    lockedVariationSeed: input.shared.lockedVariationSeed,
  };
}

function encodePayload(payload: CompactScenePayload): string {
  const json = JSON.stringify(payload);
  if (typeof btoa === "function") {
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(json, "utf8").toString("base64url");
}

function decodePayload(encoded: string): CompactScenePayload | null {
  try {
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as CompactScenePayload;
  } catch {
    return null;
  }
}

export function buildScenePresetShareUrl(
  basePath: string,
  params: ShareableSceneParams,
): string {
  const payload: CompactScenePayload = {
    h: params.hints,
    sp: params.sportPresetId,
    lw: params.lockedWardrobeId,
    ll: params.lockedLocation,
    ls: params.lockedVariationSeed,
  };
  const url = new URL(basePath, "http://local");
  url.searchParams.set("scene", encodePayload(payload));
  return `${url.pathname}${url.search}`;
}

export function parseScenePresetFromSearch(
  search: string,
): ShareableSceneParams | null {
  const params = new URLSearchParams(search);
  const encoded = params.get("scene");
  if (!encoded) {
    return null;
  }

  const payload = decodePayload(encoded);
  if (!payload) {
    return null;
  }

  return {
    hints: payload.h,
    sportPresetId: payload.sp,
    lockedWardrobeId: payload.lw,
    lockedLocation: payload.ll,
    lockedVariationSeed: payload.ls,
  };
}

export function applyShareableSceneParams(
  params: ShareableSceneParams,
): Partial<SharedToolSettings> & {
  hints?: string;
  sportPresetId?: string;
} {
  return {
    hints: params.hints,
    sportPresetId: params.sportPresetId,
    lockedWardrobeId: params.lockedWardrobeId,
    lockedLocation: params.lockedLocation,
    lockedVariationSeed: params.lockedVariationSeed,
  };
}
