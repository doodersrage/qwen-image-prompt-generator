"use client";

export type ComfyUiWebSocketProgress = {
  promptId: string;
  node?: string | null;
  status: "executing" | "finished" | "error";
  message?: string;
};

function toWebSocketUrl(comfyUrl: string): string {
  const trimmed = comfyUrl.trim().replace(/\/+$/, "");
  if (trimmed.startsWith("https://")) {
    return trimmed.replace(/^https:/, "wss:") + "/ws";
  }
  if (trimmed.startsWith("http://")) {
    return trimmed.replace(/^http:/, "ws:") + "/ws";
  }
  return `ws://${trimmed}/ws`;
}

export function subscribeComfyUiWebSocket(input: {
  comfyUrl: string;
  promptId: string;
  onProgress: (progress: ComfyUiWebSocketProgress) => void;
  onError?: (message: string) => void;
}): () => void {
  if (typeof window === "undefined" || typeof WebSocket === "undefined") {
    return () => {};
  }

  const clientId = crypto.randomUUID().replace(/-/g, "");
  let socket: WebSocket | null = null;
  let closed = false;

  try {
    socket = new WebSocket(`${toWebSocketUrl(input.comfyUrl)}?clientId=${clientId}`);
  } catch (err) {
    input.onError?.(
      err instanceof Error ? err.message : "WebSocket connection failed.",
    );
    return () => {};
  }

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(String(event.data)) as {
        type?: string;
        data?: { prompt_id?: string; node?: string | null };
      };
      if (payload.type !== "executing") {
        return;
      }
      const promptId = payload.data?.prompt_id;
      if (promptId !== input.promptId) {
        return;
      }
      const node = payload.data?.node ?? null;
      input.onProgress({
        promptId: input.promptId,
        node,
        status: node ? "executing" : "finished",
        message: node ? `Running node ${node}` : "Execution finished",
      });
    } catch {
      // ignore malformed frames
    }
  };

  socket.onerror = () => {
    if (!closed) {
      input.onError?.("WebSocket error");
    }
  };

  return () => {
    closed = true;
    socket?.close();
    socket = null;
  };
}
