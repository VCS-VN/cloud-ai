import type { ProjectState } from "../project/project-state.schema";

export type RetrievedFile = { path: string; content: string; reason: string; tokenEstimate: number };

export const RETRIEVAL_LIMITS = {
  maxFiles: 12,
  maxTotalChars: 128000,
  alwaysInclude: ["src/lib/website-config.ts", "src/data/products.ts"],
};

export async function retrieveRelevantContext(args: {
  prompt: string;
  projectState: ProjectState;
  readFile: (path: string) => Promise<string>;
}): Promise<RetrievedFile[]> {
  const lower = args.prompt.toLowerCase();
  const candidates = new Map<string, string>();
  for (const path of RETRIEVAL_LIMITS.alwaysInclude) candidates.set(path, "Always included storefront context.");
  for (const entry of args.projectState.fileManifest) {
    const haystack = `${entry.path} ${entry.purpose} ${entry.symbols.join(" ")}`.toLowerCase();
    if ((/filter|lọc|size|color|price|product/.test(lower) && /product|filter|website-config/.test(haystack)) || lower.includes(entry.path.toLowerCase())) {
      candidates.set(entry.path, "Matched prompt keywords and file manifest metadata.");
    }
  }
  const files: RetrievedFile[] = [];
  let totalChars = 0;
  for (const [path, reason] of candidates) {
    if (files.length >= RETRIEVAL_LIMITS.maxFiles) break;
    const content = await args.readFile(path).catch(() => "");
    if (totalChars + content.length > RETRIEVAL_LIMITS.maxTotalChars) continue;
    totalChars += content.length;
    files.push({ path, content, reason, tokenEstimate: Math.ceil(content.length / 4) });
  }
  return files;
}
