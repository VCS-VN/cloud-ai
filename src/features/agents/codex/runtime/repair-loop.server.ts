import type { BoundedCodexThread } from "./codex-thread.server";
import type { ValidationOutcome } from "@/features/agents/codex/validation/typecheck.server";

export const REPAIR_MAX_CYCLES = 2;

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
};

export async function runRepairLoop(input: RepairLoopInput): Promise<RepairCycleOutcome> {
  let outcome = await input.validate();
  let cycles = 0;

  while (!outcome.ok && cycles < REPAIR_MAX_CYCLES) {
    cycles++;
    input.onCycleStart?.(cycles);
    if (input.signal?.aborted) break;
    const summary = "summary" in outcome ? outcome.summary : "validation_failed";
    await input.thread.runTurn({
      prompt:
        "Validation failed. Address only the failures below within the draft workspace.\n\n" +
        "<validation_summary>\n" +
        summary +
        "\n</validation_summary>",
      signal: input.signal,
    });
    outcome = await input.validate();
  }

  return { cyclesUsed: cycles, finalOutcome: outcome };
}
