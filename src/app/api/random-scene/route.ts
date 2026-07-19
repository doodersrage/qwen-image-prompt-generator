import { generateRandomScene } from "@/lib/specialized/random-scene";
import { normalizeSharedGenerationOptions, normalizeRecentLocations, normalizeRecentClothing, normalizeBlockedLocations, normalizeLockedWardrobeId, normalizeLockedLocation, normalizeVariationSeed } from "@/lib/specialized/normalize";
import { apiError, apiJson, apiMethodNotAllowed } from "@/lib/api/response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RandomSceneRequestBody = {
  model?: string;
  detail?: string;
  genre?: string;
  includePeople?: boolean;
  wildness?: number;
  recentLocations?: string[];
  recentClothing?: string[];
  alwaysIncludeClothing?: boolean;
  blockedLocations?: string[];
  lockedWardrobeId?: string;
  lockedLocation?: string;
  variationSeed?: string;
};

export async function GET() {
  return apiMethodNotAllowed(["POST"], "/api/random-scene");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RandomSceneRequestBody;
    const shared = normalizeSharedGenerationOptions(body);

    const alwaysIncludeClothing = body.alwaysIncludeClothing !== false;

    const result = await generateRandomScene({
      ...shared,
      genre: body.genre,
      includePeople:
        typeof body.includePeople === "boolean" ? body.includePeople : true,
      wildness:
        typeof body.wildness === "number"
          ? Math.min(100, Math.max(0, body.wildness))
          : 65,
      recentLocations: normalizeRecentLocations(body.recentLocations),
      recentClothing: normalizeRecentClothing(body.recentClothing),
      alwaysIncludeClothing,
      blockedLocations: normalizeBlockedLocations(body.blockedLocations),
      lockedWardrobeId: normalizeLockedWardrobeId(body.lockedWardrobeId),
      lockedLocation: normalizeLockedLocation(body.lockedLocation),
      variationSeed: normalizeVariationSeed(body.variationSeed),
    });

    return apiJson(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Random scene generation failed.",
      500,
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
