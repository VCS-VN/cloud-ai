import type { BoundedCodexThread, CodexProgressEvent } from "./codex-thread.server";
import type { ValidationOutcome } from "@/features/agents/codex/validation/typecheck.server";

export const REPAIR_MAX_CYCLES = 1;
const REPAIR_HEARTBEAT_MS = 30_000;

export type RepairValidationFn = () => Promise<ValidationOutcome>;

export type RepairCycleOutcome = {
  cyclesUsed: number;
  finalOutcome: ValidationOutcome;
};

export type RepairLoopInput = {
  thread: BoundedCodexThread;
  validate: RepairValidationFn;
  signal?: AbortSignal;
  onCycleStart?: (cycle: number) => void;
  onProgress?: (event: CodexProgressEvent) => void;
  createRepairThread?: () => BoundedCodexThread;
  shouldRepair?: (outcome: ValidationOutcome) => boolean;
  stage?: string;
  runId?: string;
  projectId?: string;
  changedFilesCount?: number;
  context?: string;
  maxSummaryBytes?: number;
  heartbeatMs?: number;
};

function trimUtf8(value: string, maxBytes: number): string {
  const bytes = Buffer.byteLength(value, "utf8");
  if (bytes <= maxBytes) return value;
  let out = "";
  let used = 0;
  for (const char of value) {
    const size = Buffer.byteLength(char, "utf8");
    if (used + size > maxBytes) break;
    out += char;
    used += size;
  }
  return `${out}\n...[truncated ${bytes - used} bytes]`;
}

export async function runRepairLoop(input: RepairLoopInput): Promise<RepairCycleOutcome> {
  let outcome = await input.validate();
  let cycles = 0;

  while (
    !outcome.ok &&
    cycles < REPAIR_MAX_CYCLES &&
    (input.shouldRepair?.(outcome) ?? true)
  ) {
    cycles++;
    input.onCycleStart?.(cycles);
    if (input.signal?.aborted) break;
    const summary = trimUtf8(
      "summary" in outcome ? outcome.summary : "validation_failed",
      input.maxSummaryBytes ?? 2500,
    );
    const stage = input.stage ?? "unknown";
    const heartbeatMs = input.heartbeatMs ?? REPAIR_HEARTBEAT_MS;
    console.warn(
      JSON.stringify({
        event: "repair_cycle_started",
        runId: input.runId,
        projectId: input.projectId,
        repair_stage: stage,
        cycle: cycles,
        validation_summary: summary,
        changedFilesCount: input.changedFilesCount ?? 0,
      }),
    );
    const thread = input.createRepairThread?.() ?? input.thread;
    const prompt =
        "Validation failed. Repair code only. Keep the change minimal and confined to the draft workspace.\n\n" +
        (input.context ? `<repair_context>\n${input.context}\n</repair_context>\n\n` : "") +
        "<validation_summary>\n" +
        summary +
        "\n</validation_summary>";
    const startedAt = Date.now();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    console.warn(
      JSON.stringify({
        event: "repair_turn_started",
        runId: input.runId,
        projectId: input.projectId,
        repair_stage: stage,
        cycle: cycles,
        promptLength: prompt.length,
      }),
    );
    if (heartbeatMs > 0) {
      heartbeat = setInterval(() => {
        console.warn(
          JSON.stringify({
            event: "repair_turn_heartbeat",
            runId: input.runId,
            projectId: input.projectId,
            repair_stage: stage,
            cycle: cycles,
            durationMs: Date.now() - startedAt,
          }),
        );
      }, heartbeatMs);
      if (typeof heartbeat === "object" && "unref" in heartbeat) {
        heartbeat.unref();
      }
    }
    try {
      const repairSummary = await thread.runTurnStreamed({
        prompt,
        signal: input.signal,
      }, (event) => input.onProgress?.(event));
      console.warn(
        JSON.stringify({
          event: "repair_turn_completed",
          runId: input.runId,
          projectId: input.projectId,
          repair_stage: stage,
          cycle: cycles,
          durationMs: Date.now() - startedAt,
          fileChangesCount: repairSummary.fileChanges.length,
          finalResponseLength: repairSummary.finalResponse.length,
        }),
      );
    } finally {
      if (heartbeat) clearInterval(heartbeat);
    }
    outcome = await input.validate();
  }

  return { cyclesUsed: cycles, finalOutcome: outcome };
}
