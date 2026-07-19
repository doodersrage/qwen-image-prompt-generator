import fs from "node:fs";
import path from "node:path";
import { parseWorkflowJson } from "./comfyui-config";

export type ServerWorkflowFile = {
  id: string;
  name: string;
  path: string;
};

function resolveWorkflowPath(filePath: string): string {
  return path.isAbsolute(filePath)
    ? filePath
    : path.join(/* turbopackIgnore: true */ process.cwd(), filePath);
}

function readWorkflowPathsFromDirectory(dirPath: string): string[] {
  try {
    const resolvedDir = resolveWorkflowPath(dirPath);
    return fs
      .readdirSync(resolvedDir)
      .filter((entry) => entry.toLowerCase().endsWith(".json"))
      .map((entry) => path.join(dirPath, entry).replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

export function listServerWorkflowPaths(): string[] {
  const paths = new Set<string>();

  const workflowDir = process.env.COMFYUI_WORKFLOW_DIR?.trim();
  if (workflowDir) {
    for (const entry of readWorkflowPathsFromDirectory(workflowDir)) {
      paths.add(entry);
    }
  }

  const workflowPaths = process.env.COMFYUI_WORKFLOW_PATHS?.trim();
  if (workflowPaths) {
    for (const entry of workflowPaths.split(",")) {
      const trimmed = entry.trim();
      if (trimmed) {
        paths.add(trimmed);
      }
    }
  }

  const defaultPath = process.env.COMFYUI_WORKFLOW_PATH?.trim();
  if (defaultPath) {
    paths.add(defaultPath);
  }

  return [...paths].sort((left, right) => left.localeCompare(right));
}

export function listServerWorkflowFiles(): ServerWorkflowFile[] {
  return listServerWorkflowPaths().map((filePath) => ({
    id: filePath,
    name: path.basename(filePath).replace(/\.api\.json$/i, "").replace(/\.json$/i, ""),
    path: filePath,
  }));
}

export function loadServerWorkflowJson(filePath: string): Record<string, unknown> | null {
  try {
    const resolved = resolveWorkflowPath(filePath);
    return parseWorkflowJson(fs.readFileSync(resolved, "utf8"));
  } catch {
    return null;
  }
}
