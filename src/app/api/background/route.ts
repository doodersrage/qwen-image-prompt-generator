import { generateBackgroundPrompt } from "@/lib/specialized/background-generator";
import { normalizeSharedGenerationOptions } from "@/lib/specialized/normalize";
import { apiError, apiJson, apiMethodNotAllowed } from "@/lib/api/response";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type BackgroundRequestBody = {
  model?: string;
  detail?: string;
  settingType?: string;
  timeOfDay?: string;
  mood?: string;
};

export async function GET() {
  return apiMethodNotAllowed(["POST"], "/api/background");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BackgroundRequestBody;
    const shared = normalizeSharedGenerationOptions(body);

    const result = await generateBackgroundPrompt({
      ...shared,
      settingType: body.settingType?.trim(),
      timeOfDay: body.timeOfDay?.trim(),
      mood: body.mood?.trim(),
    });

    return apiJson(result);
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Background generation failed.",
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
