import {
  fileChangeToSection,
  isPrivacySafe,
  phaseLabel,
  sanitizeReasoningSnippet,
  sectionFraming,
  THINKING_LABEL,
  type ProgressLocale,
} from "@/server/functions/progress-mapper.server";
import { friendlyFailureMessage as friendlyFailureFromModule } from "@/server/functions/friendly-errors.server";
import type {
  BuilderRunEvent,
  BuilderRunFailureCode,
  BuilderRunMilestone,
  BuilderRunClarificationMetadata,
} from "@/features/agents/ui/builder-events";
import type {
  AgentQuestionMetadata,
  DesignVariant,
  PlanTask,
  RunStreamEvent,
  SkeletonPhase,
  TaskEstimate,
} from "@/shared/project-types";

export type BuilderTranslatorContext = {
  runId: string;
  projectId: string;
  locale: ProgressLocale;
};

export type BuilderTranslationOutcome = {
  events: RunStreamEvent[];
  persist: PersistDirective | null;
  timeline: ProgressTimelineDirective | null;
  terminal: TerminalKind | null;
};

export type TerminalKind = "completed" | "failed" | "stopped" | "awaiting_input";

export type PersistDirective =
  | {
      kind: "answer";
      messageId: string;
      content: string;
      processingStatus: "completed";
    }
  | {
      kind: "error";
      messageId: string;
      content: string;
      failureCode: BuilderRunFailureCode;
    }
  | {
      kind: "agent_question";
      messageId: string;
      question: string;
      options: { id: string; label: string }[];
      metadata: AgentQuestionMetadata | null;
    }
  | {
      kind: "plan";
      messageId: string;
      content: string;
    }
  | {
      kind: "reasoning";
      messageId: string;
      content: string;
      processingStatus: "completed";
    }
  | {
      kind: "agent_message";
      messageId: string;
      content: string;
      processingStatus: "completed";
    };

export type ProgressTimelineDirective =
  | { kind: "milestone"; milestone: string }
  | { kind: "section"; section: string; locale: ProgressLocale }
  | { kind: "summary"; text: string }
  | { kind: "error"; failureCode: BuilderRunFailureCode }
  | {
      kind: "task_plan";
      tasks: Array<{ id: string; title: string; phase: "prep" | "build" | "verify" }>;
      estimate: TaskEstimate;
    }
  | {
      kind: "task_transition";
      id: string;
      transition: "started" | "completed" | "paused" | "resumed";
    };

export function friendlyFailureMessage(
  code: BuilderRunFailureCode,
  locale: ProgressLocale,
): string {
  return friendlyFailureFromModule(code, locale);
}

const MILESTONE_TO_SKELETON: Record<
  BuilderRunMilestone,
  Exclude<SkeletonPhase, "starting"> | null
> = {
  loading_context: "understanding",
  planning: "planning",
  creating_draft: "editing",
  building_pages: "editing",
  checking_preview: "validating",
  repairing: "repairing",
  publishing: "responding",
  awaiting_clarification: "responding",
  done: "responding",
  failed: "responding",
  cancelled: "responding",
};

const TASK_PHASE_SECONDS: Record<PlanTask["phase"], number> = {
  prep: 90,
  build: 240,
  verify: 120,
};

export function estimatePlanTasks(tasks: PlanTask[]): TaskEstimate {
  const perTaskSeconds = Object.fromEntries(
    tasks.map((task) => [task.id, TASK_PHASE_SECONDS[task.phase]]),
  );
  return {
    totalSeconds: Object.values(perTaskSeconds).reduce((sum, seconds) => sum + seconds, 0),
    perTaskSeconds,
  };
}

function buildAgentQuestionMetadata(
  raw: BuilderRunClarificationMetadata | undefined,
): AgentQuestionMetadata | null {
  if (!raw) return null;
  if (raw.questionType === "design_variant") {
    return {
      questionType: "design_variant",
      options: raw.options as DesignVariant[],
      selectedOptionId: null,
    };
  }
  if (raw.questionType === "skill_clarification") {
    return {
      questionType: "clarification_options",
      options: raw.options.map((o) => ({
        id: o.id,
        label: o.label,
        description: o.label,
        pros: [],
        cons: [],
        recommended: false,
      })),
      selectedOptionId: null,
      customAnswerAllowed: raw.customAnswerAllowed,
    };
  }
  return null;
}

/**
 * Translator: BuilderRunEvent → RunStreamEvent + persistence + progress-timeline directives.
 * Pure function. Privacy filter is applied to every user-visible string before emission.
 */
export function translateBuilderEventToRunStreamEvent(
  event: BuilderRunEvent,
  ctx: BuilderTranslatorContext,
): BuilderTranslationOutcome {
  const { runId, locale } = ctx;
  switch (event.type) {
    case "milestone": {
      const phase = MILESTONE_TO_SKELETON[event.milestone];
      const label = phaseLabel(event.milestone, locale);
      const events: RunStreamEvent[] = phase
        ? [{ type: "skeleton.update", runId, phase, label }]
        : [];
      return {
        events,
        persist: null,
        timeline: { kind: "milestone", milestone: event.milestone },
        terminal: null,
      };
    }
    case "file_change": {
      const section = fileChangeToSection(event.path, locale);
      if (!section) {
        return { events: [], persist: null, timeline: null, terminal: null };
      }
      const label = sectionFraming(section, locale);
      if (!isPrivacySafe(label)) {
        return { events: [], persist: null, timeline: null, terminal: null };
      }
      return {
        events: [
          {
            type: "skeleton.update",
            runId,
            phase: "editing",
            label,
          },
        ],
        persist: null,
        timeline: { kind: "section", section, locale },
        terminal: null,
      };
    }
    case "step": {
      // Live step-progress signal during a streamed codex turn. Maps to a
      // single ephemeral skeleton.update so the UI bar replaces in place
      // and never accumulates persistent bubbles for transient activity.
      if (event.status !== "in_progress") {
        // Completion is implied by the next started event replacing the
        // bar; emitting a "completed" label would just flicker.
        return { events: [], persist: null, timeline: null, terminal: null };
      }
      if (!isPrivacySafe(event.label)) {
        return { events: [], persist: null, timeline: null, terminal: null };
      }
      const stepPhase: Exclude<SkeletonPhase, "starting"> =
        event.kind === "command"
          ? "validating"
          : event.kind === "mcp_tool"
            ? "understanding"
            : "editing";
      return {
        events: [
          {
            type: "skeleton.update",
            runId,
            phase: stepPhase,
            label: event.label,
          },
        ],
        persist: null,
        timeline: null,
        terminal: null,
      };
    }
    case "thinking": {
      // Live "Thinking…" skeleton (privacy-safe snippet only) AND a persisted
      // reasoning bubble carrying the full raw text. The skeleton stays a
      // transient indicator; the message is the durable record.
      const detail = sanitizeReasoningSnippet(event.text) ?? undefined;
      const messageId = `msg-${runId}-reasoning-${event.at}`;
      const content = event.text;
      const events: RunStreamEvent[] = [
        {
          type: "skeleton.update",
          runId,
          phase: "understanding",
          label: THINKING_LABEL[locale] ?? THINKING_LABEL.en,
          detail,
        },
        {
          type: "message.created",
          runId,
          messageId,
          kind: "reasoning",
          content,
          processingStatus: "completed",
          createdAt: new Date(event.at).toISOString(),
          metadata: null,
        },
        {
          type: "message.completed",
          runId,
          messageId,
          content,
        },
      ];
      return {
        events,
        persist: { kind: "reasoning", messageId, content, processingStatus: "completed" },
        timeline: null,
        terminal: null,
      };
    }
    case "agent_message": {
      const messageId = `msg-${runId}-agent-${event.at}`;
      const content = event.text;
      const events: RunStreamEvent[] = [
        {
          type: "message.created",
          runId,
          messageId,
          kind: "agent_message",
          content,
          processingStatus: "completed",
          createdAt: new Date(event.at).toISOString(),
          metadata: null,
        },
        {
          type: "message.completed",
          runId,
          messageId,
          content,
        },
      ];
      return {
        events,
        persist: { kind: "agent_message", messageId, content, processingStatus: "completed" },
        timeline: null,
        terminal: null,
      };
    }
    case "turn_completed": {
      const raw = event.finalResponse.trim();
      const safe =
        raw ||
        (locale === "vi"
          ? "Đã hoàn tất yêu cầu của bạn."
          : "Done with your request.");
      const messageId = `msg-${runId}-answer`;
      const events: RunStreamEvent[] = [
        {
          type: "message.created",
          runId,
          messageId,
          kind: "answer",
          content: safe,
          processingStatus: "completed",
          createdAt: new Date(event.at).toISOString(),
          metadata: null,
        },
        {
          type: "message.completed",
          runId,
          messageId,
          content: safe,
        },
      ];
      return {
        events,
        persist: { kind: "answer", messageId, content: safe, processingStatus: "completed" },
        timeline: { kind: "summary", text: safe },
        terminal: null,
      };
    }
    case "awaiting_clarification": {
      const messageId = `msg-${runId}-question`;
      // Plan-mode review: surface the plan markdown as kind=plan so the chat
      // history retains the plan even after Approve/Reject.
      const isPlanReview =
        event.metadata?.questionType === "plan_review" &&
        typeof (event.metadata as { planMarkdown?: unknown }).planMarkdown === "string";
      if (isPlanReview) {
        const planMarkdown = (event.metadata as { planMarkdown: string }).planMarkdown;
        const planMessageId = `msg-${runId}-plan`;
        return {
          events: [
            {
              type: "message.created",
              runId,
              messageId: planMessageId,
              kind: "plan",
              content: planMarkdown,
              processingStatus: "completed",
              createdAt: new Date(event.at).toISOString(),
              metadata: null,
            },
            { type: "run.awaiting_input", runId },
          ],
          persist: {
            kind: "plan",
            messageId: planMessageId,
            content: planMarkdown,
          },
          timeline: null,
          terminal: "awaiting_input",
        };
      }
      const questionMetadata = buildAgentQuestionMetadata(event.metadata);
      // Observability: surface the metadata shape that's actually flowing
      // through. The init flow's variant-pick run was reported with
      // `metadata: null` despite the driver attaching design_variant data —
      // this log makes the truth obvious in server output.
      const rawMeta = event.metadata;
      const rawOptionsCount =
        rawMeta && "options" in rawMeta && Array.isArray(rawMeta.options)
          ? rawMeta.options.length
          : 0;
      console.log(
        JSON.stringify({
          event: "translator_agent_question_emitted",
          runId,
          rawQuestionType: rawMeta?.questionType ?? null,
          rawOptionsCount,
          mappedMetadataNull: questionMetadata === null,
          mappedQuestionType:
            questionMetadata && "questionType" in questionMetadata
              ? questionMetadata.questionType
              : null,
        }),
      );
      return {
        events: [
          {
            type: "message.created",
            runId,
            messageId,
            kind: "agent_question",
            content: event.question,
            processingStatus: "completed",
            createdAt: new Date(event.at).toISOString(),
            metadata: questionMetadata,
          },
          { type: "run.awaiting_input", runId },
        ],
        persist: {
          kind: "agent_question",
          messageId,
          question: event.question,
          options: event.options,
          metadata: questionMetadata,
        },
        timeline: null,
        terminal: "awaiting_input",
      };
    }
    case "done": {
      return {
        events: [
          { type: "run.completed", runId, projectProcessingStatus: "idle" },
        ],
        persist: null,
        timeline: null,
        terminal: "completed",
      };
    }
    case "failed": {
      // Audit: log raw cause for internal observability before redacting it.
      // The user-visible payload uses ONLY the friendly mapping; raw event.message
      // never reaches the chat (FR-007 / SC-002).
      if (event.message) {
        console.error(
          JSON.stringify({
            event: "builder_run_failed_internal",
            runId,
            projectId: ctx.projectId,
            failureCode: event.failureCode,
            rawMessage: event.message,
          }),
        );
      }
      const friendly = friendlyFailureMessage(event.failureCode, locale);
      const messageId = `msg-${runId}-error`;
      const createdAt = new Date(event.at).toISOString();
      return {
        events: [
          {
            type: "message.created",
            runId,
            messageId,
            kind: "error",
            content: friendly,
            processingStatus: "completed",
            createdAt,
            metadata: null,
          },
          {
            type: "message.completed",
            runId,
            messageId,
            content: friendly,
          },
          {
            type: "run.failed",
            runId,
            projectProcessingStatus: "idle",
            error: { code: "PROVIDER_STREAM_FAILED", message: friendly },
          },
        ],
        persist: { kind: "error", messageId, content: friendly, failureCode: event.failureCode },
        timeline: { kind: "error", failureCode: event.failureCode },
        terminal: "failed",
      };
    }
    case "cancelled": {
      return {
        events: [{ type: "run.stopped", runId, projectProcessingStatus: "idle" }],
        persist: null,
        timeline: null,
        terminal: "stopped",
      };
    }
    case "plan.created": {
      const estimate = estimatePlanTasks(event.tasks);
      return {
        events: [
          {
            type: "plan.created",
            runId,
            tasks: event.tasks,
            estimate,
            at: event.at,
          },
        ],
        persist: null,
        timeline: { kind: "task_plan", tasks: event.tasks, estimate },
        terminal: null,
      };
    }
    case "plan.task.started":
    case "plan.task.completed":
    case "plan.task.paused":
    case "plan.task.resumed": {
      const transition =
        event.type === "plan.task.started"
          ? "started"
          : event.type === "plan.task.completed"
            ? "completed"
            : event.type === "plan.task.paused"
              ? "paused"
              : "resumed";
      return {
        events: [
          {
            type: event.type,
            runId,
            taskId: event.taskId,
            at: event.at,
          },
        ],
        persist: null,
        timeline: { kind: "task_transition", id: event.taskId, transition },
        terminal: null,
      };
    }
  }
}

export function emitRunStarted(ctx: BuilderTranslatorContext): RunStreamEvent {
  return { type: "run.started", runId: ctx.runId, projectId: ctx.projectId };
}
