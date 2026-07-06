import { z } from "zod";
import {
  createBoundedCodexThread,
  type BoundedCodexThread,
} from "@/features/agents/codex/runtime/codex-thread.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

/**
 * Scope-analysis ("thinking") pass. Before the expensive high-reasoning execute
 * turn, run ONE cheap read-only turn that reads the user's prompt + the file
 * manifest and decides:
 *   - relevantFiles: the specific existing files the change should touch
 *   - approach:      a 1-3 sentence plan of what to change and where
 *
 * This result is injected into the execute turn so the model goes straight to
 * `cat <relevant file>` → overwrite, instead of re-deriving the whole project
 * structure with broad `rg/grep/ls` sweeps on every prompt (the redundant
 * processing this module exists to avoid). It is advisory, not a hard gate:
 * on any failure we return null and the execute turn falls back to its own
 * discovery, so a bad triage never blocks a legitimate edit.
 */

const ScopeAnalysisSchema = z.object({
  relevantFiles: z.array(z.string().min(1).max(256)).max(20),
  approach: z.string().min(1).max(600),
});

export type ScopeAnalysis = z.infer<typeof ScopeAnalysisSchema>;

export type AnalyzeScopeInput = {
  runId: string;
  prompt: string;
  fileManifest: string[];
  language: string;
  signal?: AbortSignal;
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
  /** Test seam — defaults to a fresh read-only BoundedCodexThread. */
  thread?: Pick<BoundedCodexThread, "runTurn">;
};

// Read-only triage — a single quick pass, not a build turn. Match the
// classifier's fail-fast retry budget so a transport hiccup doesn't burn a
// minute before falling back to unscoped execution.
const SCOPE_THREAD_RETRY_ATTEMPTS = 2;
const SCOPE_PARSE_RETRY_ATTEMPTS = 1;
// The manifest is already filtered (no node_modules/dist/.git), but cap what we
// inline so a large project doesn't blow the triage prompt back up to the cost
// we're trying to avoid.
const MAX_MANIFEST_FOR_SCOPE = 300;

function buildScopePrompt(input: {
  prompt: string;
  fileManifest: string[];
  language: string;
}): string {
  const manifest = input.fileManifest.slice(0, MAX_MANIFEST_FOR_SCOPE);
  const truncated = input.fileManifest.length - manifest.length;
  const manifestBlock =
    manifest.map((p) => `- ${p}`).join("\n") +
    (truncated > 0 ? `\n... (+${truncated} more)` : "");
  return `You are a fast scoping analyst for edits to an existing storefront project. Output ONLY a JSON object — no prose, no fence.

Given the user's request and the project's file list, decide the MINIMAL set of existing files the change should touch and a short plan. Do NOT explore or read files — reason only from the paths below and the request.

Return:
{
  "relevantFiles": ["<existing path from the list that must be edited/read>", ...],
  "approach": "<1-3 sentence plan in language: ${input.language}: what to change and in which file(s)>"
}

Rules:
- relevantFiles MUST be paths that appear in the file list. Pick the fewest that cover the change (usually 1-3). If a new file is genuinely required, include the parent directory's existing sibling so the agent knows where it goes.
- Prefer route/component files under src/routes and src/components for UI edits.
- approach is a terse plan, NOT the code. No file contents, no framework lectures.
- If the request is truly ambiguous or global, return an empty relevantFiles array and describe the uncertainty in approach.

<file_list>
${manifestBlock}
</file_list>

User request follows.`;
}

function stripFenceForJson(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fence && fence[1]) return fence[1].trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return trimmed;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed;
}

export function parseScopeAnalysis(
  raw: string,
  fileManifest: string[],
): ScopeAnalysis | null {
  let json: unknown;
  try {
    json = JSON.parse(stripFenceForJson(raw));
  } catch {
    return null;
  }
  const parsed = ScopeAnalysisSchema.safeParse(json);
  if (!parsed.success) return null;
  // Keep only files that actually exist in the manifest — the model sometimes
  // invents plausible-but-absent paths, and a hallucinated "focus here" is
  // worse than no scope hint at all.
  const manifestSet = new Set(fileManifest);
  const relevantFiles: string[] = [];
  for (const raw of parsed.data.relevantFiles) {
    const normalized = raw.replace(/^\.?\//, "");
    if (manifestSet.has(normalized)) relevantFiles.push(normalized);
  }
  return { relevantFiles, approach: parsed.data.approach.trim() };
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
    return true;
  }
  return false;
}

export async function analyzeScope(
  input: AnalyzeScopeInput,
): Promise<ScopeAnalysis | null> {
  const { runId, prompt, fileManifest, signal } = input;
  const thread =
    input.thread ??
    createBoundedCodexThread({
      env: input.env,
      draftWorkspacePath: input.draftWorkspacePath,
      sandboxMode: "read-only",
      modelReasoningEffort: "low",
      maxRetryAttempts: SCOPE_THREAD_RETRY_ATTEMPTS,
    });
  const fullPrompt = `${buildScopePrompt({
    prompt,
    fileManifest,
    language: input.language,
  })}\n\n${prompt}`;
  try {
    let result: ScopeAnalysis | null = null;
    for (let attempt = 0; attempt <= SCOPE_PARSE_RETRY_ATTEMPTS; attempt++) {
      const turn = await thread.runTurn({ prompt: fullPrompt, signal });
      result = parseScopeAnalysis(turn.finalResponse, fileManifest);
      if (result) break;
    }
    if (result) {
      console.log(
        JSON.stringify({
          event: "scope_analysis_decision",
          runId,
          relevantFileCount: result.relevantFiles.length,
          manifestSize: fileManifest.length,
        }),
      );
    } else {
      console.warn(
        JSON.stringify({ event: "scope_analysis_parse_failed_fallback", runId }),
      );
    }
    return result;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn(
      JSON.stringify({
        event: "scope_analysis_failed_fallback",
        runId,
        rawMessage: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}
