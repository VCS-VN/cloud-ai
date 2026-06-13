import { z } from "zod";
import {
  createBoundedCodexThread,
  type BoundedCodexThread,
} from "@/features/agents/codex/runtime/codex-thread.server";
import { isPrivacySafe } from "@/server/functions/progress-mapper.server";
import type { CodexEnvAvailable } from "@/server/env/codex";
import type { BuilderRunPlannedTask } from "@/features/agents/ui/builder-events";

const TaskSchema = z.object({
  id: z.string().min(1).max(64),
  title: z
    .string()
    .min(1)
    // Title is a display-only label, not code. The model (esp. cloud-ai) often
    // overshoots the ≤80 char guidance; truncating is harmless and keeps the
    // whole plan instead of rejecting it over one long title. Trim at a word
    // boundary near 80 when possible so the label reads cleanly.
    .transform((s) => {
      const t = s.trim();
      if (t.length <= 80) return t;
      const cut = t.slice(0, 80);
      const lastSpace = cut.lastIndexOf(" ");
      return (lastSpace >= 60 ? cut.slice(0, lastSpace) : cut).trimEnd();
    })
    .refine(isPrivacySafe, { message: "title must be privacy-safe" }),
  phase: z.enum(["prep", "build", "verify"]),
});

export const PlannerOutputSchema = z.object({
  tasks: z
    .array(TaskSchema)
    .min(2)
    .max(8)
    .superRefine((arr, ctx) => {
      const ids = new Set<string>();
      for (const t of arr) {
        if (ids.has(t.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "duplicate task id",
          });
        }
        ids.add(t.id);
      }
    }),
});

export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

export type GeneratePlanInput = {
  runId: string;
  prompt: string;
  language: string;
  signal?: AbortSignal;
  env: CodexEnvAvailable;
  draftWorkspacePath: string;
  /** Maximum retries on validation failure. Default 1 (retry once). */
  retryOnInvalid?: number;
  /** Test seam — defaults to a fresh BoundedCodexThread. */
  thread?: Pick<BoundedCodexThread, "runTurn">;
};

export type GeneratePlanResult =
  | { ok: true; tasks: BuilderRunPlannedTask[]; rawResponse: string }
  | { ok: false; reason: string };

const PLANNER_PROMPT = (language: string) => `You are a task planner. Output ONLY a JSON object — no prose, no fence.

Return:
{
  "tasks": [
    { "id": "<unique-slug>", "title": "<3-7 word goal in language: ${language}>", "phase": "prep" | "build" | "verify" }
  ]
}

Good titles (short, 3-7 words):
{
  "tasks": [
    { "id": "setup-structure", "title": "Set up project structure", "phase": "prep" },
    { "id": "build-storefront", "title": "Build storefront pages", "phase": "build" },
    { "id": "verify-preview", "title": "Verify preview runs", "phase": "verify" }
  ]
}

Rules:
- 2 to 8 tasks total. Pick the smallest number that captures the work.
- Title is a SHORT human-readable goal of 3 to 7 words (hard cap 80 characters) — like the examples above. Do NOT write a sentence, do NOT append "with …" clauses describing details, theme, or stack. Keep it terse: verb + object. NO file paths, NO framework names, NO code identifiers, NO file extensions.
- Title must be in language code "${language}". If "${language}" is unknown, use English.
- "phase" buckets the task: "prep" (research/setup), "build" (main change), "verify" (validation).
- When possible, distribute tasks across phases. For trivial requests, you may skew toward "build" only.
- IDs must be unique within the array.

User prompt follows.`;

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/^```(?:json|JSON)?\s*\n([\s\S]*?)\n?```\s*$/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  const objectStart = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const start =
    objectStart === -1
      ? arrayStart
      : arrayStart === -1
        ? objectStart
        : Math.min(objectStart, arrayStart);
  if (start === -1) return trimmed;
  const opener = trimmed[start];
  const closer = opener === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === opener) depth++;
    else if (ch === closer) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return trimmed;
}

export type ParsePlannerResult =
  | { ok: true; tasks: BuilderRunPlannedTask[] }
  | { ok: false; reason: string };

export function parsePlannerOutput(raw: string): ParsePlannerResult {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFence(raw));
  } catch {
    return { ok: false, reason: "invalid JSON" };
  }
  const candidate =
    Array.isArray(json) ? { tasks: json } : json;
  const parsed = PlannerOutputSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, tasks: parsed.data.tasks };
  }
  const reason = parsed.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { ok: false, reason };
}

function isAbortError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message))) {
    return true;
  }
  return false;
}

export async function generatePlan(
  input: GeneratePlanInput,
): Promise<GeneratePlanResult> {
  const { runId, prompt, language, signal } = input;
  const maxRetries = input.retryOnInvalid ?? 1;
  const thread =
    input.thread ??
    createBoundedCodexThread({
      env: input.env,
      draftWorkspacePath: input.draftWorkspacePath,
      sandboxMode: "read-only",
      modelReasoningEffort: "minimal",
    });
  const fullPrompt = `${PLANNER_PROMPT(language)}\n\n${prompt}`;
  let lastReason = "no attempt";
  let lastResponse = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let turn;
    try {
      turn = await thread.runTurn({ prompt: fullPrompt, signal });
    } catch (error) {
      if (isAbortError(error)) throw error;
      lastReason = error instanceof Error ? error.message : String(error);
      continue;
    }
    lastResponse = turn.finalResponse;
    const validation = parsePlannerOutput(turn.finalResponse);
    if (validation.ok) {
      const distribution = { prep: 0, build: 0, verify: 0 };
      for (const t of validation.tasks) distribution[t.phase]++;
      console.log(
        JSON.stringify({
          event: "plan_phase_distribution",
          runId,
          ...distribution,
          taskCount: validation.tasks.length,
        }),
      );
      return { ok: true, tasks: validation.tasks, rawResponse: turn.finalResponse };
    }
    lastReason = validation.reason;
  }
  console.warn(
    JSON.stringify({
      event: "plan_generator_validation_failed",
      runId,
      reason: lastReason,
      lastResponseLength: lastResponse.length,
    }),
  );
  return { ok: false, reason: lastReason };
}
