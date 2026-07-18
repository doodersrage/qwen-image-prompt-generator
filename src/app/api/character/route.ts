import { generateCharacterPrompt } from "@/lib/specialized/character-generator";
import { normalizeSharedGenerationOptions } from "@/lib/specialized/normalize";
import { apiError, apiJson, apiMethodNotAllowed } from "@/lib/api/response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CharacterRequestBody = {
  model?: string;
  detail?: string;
  hints?: string;
  portraitStyle?: "portrait" | "full-body" | "action";
  variationStrength?: number;
};

export async function GET() {
  return apiMethodNotAllowed(["POST"], "/api/character");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CharacterRequestBody;
    const shared = normalizeSharedGenerationOptions(body);

    const portraitStyle =
      body.portraitStyle === "full-body" ||
      body.portraitStyle === "action" ||
      body.portraitStyle === "portrait"
        ? body.portraitStyle
        : "portrait";

    const result = await generateCharacterPrompt({
      ...shared,
      hints: body.hints?.trim(),
      portraitStyle,
      variationStrength:
        typeof body.variationStrength === "number"
          ? Math.min(100, Math.max(0, body.variationStrength))
          : 50,
    });

    return apiJson(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Character generation failed.",
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
