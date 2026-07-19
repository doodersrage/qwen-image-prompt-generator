import { NextResponse } from "next/server";
import { apiError, apiJson, apiMethodNotAllowed } from "@/lib/api/response";

export const runtime = "nodejs";

type DispatchBody = {
  url?: string;
  secret?: string;
  payload?: Record<string, unknown>;
};

export async function GET() {
  return apiMethodNotAllowed(["POST"], "/api/webhooks/dispatch");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DispatchBody;
    const url = body.url?.trim();
    if (!url) {
      return apiError("Webhook URL is required.", 400);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (body.secret?.trim()) {
      headers["X-Prompt-Tools-Secret"] = body.secret.trim();
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body.payload ?? {}),
    });

    return apiJson({
      ok: response.ok,
      status: response.status,
    });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Webhook dispatch failed.",
      502,
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
