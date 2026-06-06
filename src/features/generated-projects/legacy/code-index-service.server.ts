import { isProtectedProjectEnvPath } from "@/features/ai-agent/code-tools/services/project-path-guard.server";
import type { FileManifestEntry } from "@/features/projects/legacy/project-state.schema";
import type { GeneratedFile } from "./init-source.server";

export function buildFileManifest(files: GeneratedFile[]): FileManifestEntry[] {
  return files.filter((file) => !isProtectedProjectEnvPath(file.path)).map((file) => ({
    path: file.path,
    kind: inferKind(file.path),
    purpose: inferPurpose(file.path),
    symbols: inferSymbols(file.content),
    lastModifiedByAgentAt: new Date().toISOString(),
  }));
}

function inferKind(path: string): FileManifestEntry["kind"] {
  if (path.includes("/routes/") || path === "src/router.tsx") return "route";
  if (path.includes("/components/")) return "component";
  if (path.includes("/data/")) return "data";
  if (path.includes("/lib/")) return "other";
  if (path.includes("styles") || path.endsWith(".css")) return "style";
  if (path.endsWith("config.ts") || path.includes("config")) return "config";
  return "other";
}

function inferPurpose(path: string) {
  if (path === "package.json") return "Generated storefront package manifest.";
  if (path.includes("products")) return "Product discovery and product data.";
  if (path.includes("cart")) return "Shopping cart experience.";
  if (path.includes("checkout")) return "Mock checkout experience.";
  return "Generated storefront source file.";
}

function inferSymbols(content: string) {
  return [...content.matchAll(/(?:export\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g)].map((match) => match[1]);
}
