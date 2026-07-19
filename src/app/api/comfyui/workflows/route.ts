import { listServerWorkflowFiles } from "@/lib/comfyui-server-workflows";
import { apiJson } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  const workflows = listServerWorkflowFiles().map((entry) => ({
    id: `server:${entry.id}`,
    name: entry.name,
    path: entry.path,
    source: "server" as const,
  }));

  return apiJson({ workflows });
}
