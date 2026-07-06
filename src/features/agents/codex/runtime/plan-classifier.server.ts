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

// Fail fast: this is a quick triage call, not a heavy build turn. Inheriting
// the default 10-attempt/60s-backoff policy meant for multi-step builds made
// a single triage call spend up to a minute retrying transport errors before
// falling back to "complex".
const CLASSIFIER_THREAD_RETRY_ATTEMPTS = 2;
// One extra turn if the model's output didn't parse as valid JSON, mirroring
// the planner's retry-on-invalid-output behavior instead of permanently
// defaulting to "complex" on the first format hiccup.
const CLASSIFIER_PARSE_RETRY_ATTEMPTS = 1;

const CLASSIFIER_PROMPT = `You are a fast triage classifier. Output ONLY a JSON object — no prose, no fence.

Return:
{ "complexity": "simple" | "complex", "language": "<ISO-639-1 lowercase>" }

- "simple" = a single visual/content tweak to ONE existing element or component, with no structural change: recoloring, resizing, restyling, retexting, or toggling visibility.
  Examples: "change the button color to blue", "make the title bigger", "hide the promo banner", "update the hero heading text".
- "complex" = adding/removing a page or section, changing layout/structure, wiring up new behavior (forms, cart, navigation), or touching more than one component.
  Examples: "add a contact form", "add a new FAQ page", "restructure the header", "add a newsletter signup flow".
- If genuinely torn between the two, prefer "simple" — treating a small request as complex costs the user an unnecessary planning step.
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

function tryParseClassifierOutput(raw: string): ClassifierOutput | null {
  try {
    const json = JSON.parse(stripFenceForJson(raw));
    const parsed = ClassifierOutputSchema.safeParse(json);
    if (parsed.success) return parsed.data;
  } catch {
    // fall through — caller decides whether to retry or fall back
  }
  return null;
}

export function parseClassifierOutput(raw: string): ClassifierOutput {
  return tryParseClassifierOutput(raw) ?? CLASSIFIER_FALLBACK;
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
      maxRetryAttempts: CLASSIFIER_THREAD_RETRY_ATTEMPTS,
    });
  try {
    let decision: ClassifierOutput | null = null;
    // Retry once on a malformed (non-JSON) response before defaulting to
    // "complex" — a single format hiccup at minimal reasoning effort
    // shouldn't permanently cost the user a planning step.
    for (let attempt = 0; attempt <= CLASSIFIER_PARSE_RETRY_ATTEMPTS; attempt++) {
      const turn = await thread.runTurn({
        prompt: `${CLASSIFIER_PROMPT}\n\n${prompt}`,
        signal,
      });
      decision = tryParseClassifierOutput(turn.finalResponse);
      if (decision) break;
      console.warn(
        JSON.stringify({
          event: "plan_classifier_parse_failed",
          runId,
          attempt: attempt + 1,
          willRetry: attempt < CLASSIFIER_PARSE_RETRY_ATTEMPTS,
        }),
      );
    }
    if (!decision) {
      // Distinguish from plan_classifier_failed_fallback below: this is a
      // parse failure (model responded, output didn't fit the schema), not a
      // transport/thread error. Logged separately so "genuine complex" vs
      // "guessed complex because we couldn't parse" is no longer ambiguous.
      console.warn(
        JSON.stringify({
          event: "plan_classifier_parse_failed_fallback",
          runId,
          prompt_length: prompt.length,
        }),
      );
      decision = CLASSIFIER_FALLBACK;
    }
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
