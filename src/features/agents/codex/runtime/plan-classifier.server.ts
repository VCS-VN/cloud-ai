import { z } from "zod";
import {
  createBoundedCodexThread,
  type BoundedCodexThread,
} from "@/features/agents/codex/runtime/codex-thread.server";
import type { CodexEnvAvailable } from "@/server/env/codex";

const ClassifierOutputSchema = z.object({
  complexity: z.enum(["simple", "complex"]),
  language: z
    .string()
    .regex(/^[a-z]{2}$/)
    .catch("en"),
});

export type ClassifierOutput = z.infer<typeof ClassifierOutputSchema>;

export type ClassifyPromptComplexityInput = {
  runId: string;
  prompt: string;
  signal?: AbortSignal;
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
  /** Test seam — defaults to a fresh BoundedCodexThread. */
  thread?: Pick<BoundedCodexThread, "runTurn">;
};

export const CLASSIFIER_FALLBACK: ClassifierOutput = {
  complexity: "complex",
  language: "en",
};

const CLASSIFIER_PROMPT = `You are a fast triage classifier. Output ONLY a JSON object — no prose, no fence.

Return:
{ "complexity": "simple" | "complex", "language": "<ISO-639-1 lowercase>" }

- "simple" = a single trivial change, one section, no multi-step reasoning needed.
- "complex" = anything that touches multiple sections, requires planning, or involves more than one step.
- "language" = the dominant natural language of the user's prompt as a 2-letter lowercase code (e.g. "en", "vi", "ja").

User prompt follows.`;

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
    return true;
  }
  return false;
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

export function parseClassifierOutput(raw: string): ClassifierOutput {
  try {
    const json = JSON.parse(stripFenceForJson(raw));
    const parsed = ClassifierOutputSchema.safeParse(json);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through to fallback
  }
  return CLASSIFIER_FALLBACK;
}

export async function classifyPromptComplexity(
  input: ClassifyPromptComplexityInput,
): Promise<ClassifierOutput> {
  const { runId, prompt, signal } = input;
  const thread =
    input.thread ??
    createBoundedCodexThread({
      env: input.env,
      draftWorkspacePath: input.draftWorkspacePath,
      sandboxMode: "read-only",
      modelReasoningEffort: "minimal",
    });
  try {
    const turn = await thread.runTurn({
      prompt: `${CLASSIFIER_PROMPT}\n\n${prompt}`,
      signal,
    });
    const decision = parseClassifierOutput(turn.finalResponse);
    console.log(
      JSON.stringify({
        event: "plan_classifier_decision",
        runId,
        prompt_length: prompt.length,
        decision,
      }),
    );
    return decision;
  } catch (error) {
    if (isAbortError(error)) throw error;
    console.warn(
      JSON.stringify({
        event: "plan_classifier_failed_fallback",
        runId,
        prompt_length: prompt.length,
        rawMessage: error instanceof Error ? error.message : String(error),
      }),
    );
    return CLASSIFIER_FALLBACK;
  }
}
