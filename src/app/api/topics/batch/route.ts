import { batchGenerateFromTopics } from "@/lib/batch-from-topics";
import {
  normalizeRecentClothing,
  normalizeLockedWardrobeId,
  normalizeLockedLocation,
  normalizeVariationSeed,
  normalizeSharedGenerationOptions,
} from "@/lib/specialized/normalize";
import { apiError, apiJson, apiMethodNotAllowed } from "@/lib/api/response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TopicsBatchRequestBody = {
  topics?: string[];
  target?: "generate" | "duo";
  model?: string;
  detail?: string;
  recentClothing?: string[];
  alwaysIncludeClothing?: boolean;
  distinctPeople?: boolean;
  teamKit?: boolean;
  blockedLocations?: string[];
  lockedWardrobeId?: string;
  lockedLocation?: string;
  variationSeed?: string;
};

export async function GET() {
  return apiMethodNotAllowed(["POST"], "/api/topics/batch");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TopicsBatchRequestBody;
    const topics = body.topics?.map((entry) => entry.trim()).filter(Boolean) ?? [];

    if (topics.length === 0) {
      return apiError("At least one topic is required.", 400);
    }

    const shared = normalizeSharedGenerationOptions(body);
    const target = body.target === "duo" ? "duo" : "generate";

    const result = await batchGenerateFromTopics({
      topics,
      target,
      model: shared.model,
      detail: shared.detail,
      lockedWardrobeId: normalizeLockedWardrobeId(body.lockedWardrobeId),
      lockedLocation: normalizeLockedLocation(body.lockedLocation),
      variationSeed: normalizeVariationSeed(body.variationSeed),
      recentClothing: normalizeRecentClothing(body.recentClothing),
      alwaysIncludeClothing: body.alwaysIncludeClothing,
      distinctPeople: body.distinctPeople,
      teamKit: body.teamKit,
    });

    return apiJson(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Topics batch failed.",
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
