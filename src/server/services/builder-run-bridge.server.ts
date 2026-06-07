import {
  emitRunStarted,
  translateBuilderEventToRunStreamEvent,
  type BuilderTranslatorContext,
  type PersistDirective,
  type ProgressTimelineDirective,
  type TerminalKind,
} from "@/server/services/builder-run-translator.server";
import type {
  BuilderRunEvent,
  BuilderRunFailureCode,
} from "@/features/agents/ui/builder-events";
import type { AgentMessageKind, RunStreamEvent } from "@/shared/project-types";

export type BridgePersistAdapter = {
  saveAgentMessage(input: {
    runId: string;
    kind: Extract<AgentMessageKind, "answer" | "error" | "agent_question" | "plan">;
    content: string;
    metadata?: { questionType: string; options: { id: string; label: string }[] } | null;
  }): Promise<void>;
  appendProgressTimeline(input: {
    runId: string;
    event: ProgressTimelineDirective;
  }): Promise<void>;
  setRunStatus(input: {
    runId: string;
    terminal: TerminalKind;
    failureCode?: BuilderRunFailureCode;
  }): Promise<void>;
};

export type BridgeEmitter = (event: RunStreamEvent) => void;

export type BridgeRunInput = {
  ctx: BuilderTranslatorContext;
  events: AsyncIterable<BuilderRunEvent>;
  emit: BridgeEmitter;
  persist: BridgePersistAdapter;
};

/**
 * Phase 1 bridge orchestrator. Consumes a stream of BuilderRunEvent values,
 * translates each into RunStreamEvent shapes for the SSE consumer, and
 * persists answer/error messages + progress timeline directives via the adapter.
 *
 * Pure with respect to side-effects: every external call funnels through `emit`
 * or `persist`. Testable by feeding scripted events.
 */
export async function runBuilderBridge(input: BridgeRunInput): Promise<{
  terminal: TerminalKind | null;
  failureCode?: BuilderRunFailureCode;
}> {
  const { ctx, events, emit, persist } = input;
  emit(emitRunStarted(ctx));

  let terminal: TerminalKind | null = null;
  let lastFailureCode: BuilderRunFailureCode | undefined;

  for await (const event of events) {
    const outcome = translateBuilderEventToRunStreamEvent(event, ctx);
    for (const e of outcome.events) emit(e);

    if (outcome.timeline) {
      await persist.appendProgressTimeline({ runId: ctx.runId, event: outcome.timeline });
    }

    if (outcome.persist) {
      const directive: PersistDirective = outcome.persist;
      if (directive.kind === "answer") {
        await persist.saveAgentMessage({
          runId: ctx.runId,
          kind: "answer",
          content: directive.content,
        });
      } else if (directive.kind === "error") {
        await persist.saveAgentMessage({
          runId: ctx.runId,
          kind: "error",
          content: directive.content,
        });
      } else if (directive.kind === "plan") {
        await persist.saveAgentMessage({
          runId: ctx.runId,
          kind: "plan",
          content: directive.content,
        });
      } else if (directive.kind === "agent_question") {
        await persist.saveAgentMessage({
          runId: ctx.runId,
          kind: "agent_question",
          content: directive.question,
          metadata: {
            questionType: "skill_clarification",
            options: directive.options,
          },
        });
      }
    }

    if (outcome.terminal) {
      terminal = outcome.terminal;
      if (event.type === "failed") lastFailureCode = event.failureCode;
      await persist.setRunStatus({
        runId: ctx.runId,
        terminal: outcome.terminal,
        failureCode: lastFailureCode,
      });
    }
  }

  return { terminal, failureCode: lastFailureCode };
}
