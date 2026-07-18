import {
  generatePrompt,
  type PromptMode,
} from "@/lib/prompt-generator";
import { normalizeGenerationSettings } from "@/lib/generation-settings";
import {
  apiError,
  apiJson,
  apiMethodNotAllowed,
} from "@/lib/api/response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GenerateRequestBody = {
  input?: string;
  mode?: PromptMode;
  variation?: {
    enabled?: boolean;
    strength?: number;
  };
  detail?: string;
  distinctPeople?: boolean;
  alwaysIncludeClothing?: boolean;
  model?: string;
};

export async function GET() {
  return apiMethodNotAllowed(["POST"], "/api/generate");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const input = body.input?.trim();
    const mode: PromptMode = body.mode === "negative" ? "negative" : "positive";
    const settings = normalizeGenerationSettings({
      variation: body.variation,
      distinctPeople: body.distinctPeople,
      alwaysIncludeClothing: body.alwaysIncludeClothing,
      detail: body.detail,
      model: body.model,
    });

    if (!input) {
      return apiError("Input is required.", 400);
    }

    if (input.length > 4000) {
      return apiError("Input must be 4000 characters or fewer.", 400);
    }

    const result = await generatePrompt(input, mode, settings);

    return apiJson(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate prompt.";

    return apiError(message, 500);
  }
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
