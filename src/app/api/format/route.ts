import {
  formatPrompt,
  normalizeFormatSettings,
  type FormatMode,
} from "@/lib/prompt-formatter";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type FormatRequestBody = {
  input?: string;
  model?: string;
  detail?: string;
  mode?: FormatMode;
  smartFormat?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FormatRequestBody;
    const input = body.input?.trim();
    const settings = normalizeFormatSettings({
      model: body.model,
      detail: body.detail,
      mode: body.mode,
      smartFormat: body.smartFormat,
    });

    if (!input) {
      return NextResponse.json(
        { error: "Input is required." },
        { status: 400 },
      );
    }

    if (input.length > 8000) {
      return NextResponse.json(
        { error: "Input must be 8000 characters or fewer." },
        { status: 400 },
      );
    }

    const result = await formatPrompt(input, settings);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to format prompt.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
