import {
  generatePrompt,
  type PromptMode,
} from "@/lib/prompt-generator";
import { normalizeGenerationSettings } from "@/lib/generation-settings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GenerateRequestBody = {
  input?: string;
  mode?: PromptMode;
  variation?: {
    enabled?: boolean;
    strength?: number;
  };
  distinctPeople?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const input = body.input?.trim();
    const mode: PromptMode = body.mode === "negative" ? "negative" : "positive";
    const settings = normalizeGenerationSettings({
      variation: body.variation,
      distinctPeople: body.distinctPeople,
    });

    if (!input) {
      return NextResponse.json(
        { error: "Input is required." },
        { status: 400 },
      );
    }

    if (input.length > 4000) {
      return NextResponse.json(
        { error: "Input must be 4000 characters or fewer." },
        { status: 400 },
      );
    }

    const result = await generatePrompt(input, mode, settings);

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate prompt.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
