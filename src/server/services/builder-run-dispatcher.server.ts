import path from "node:path";
import fs from "node:fs/promises";
import { getProjectWorkspaceRoot } from "@/server/config/paths.server";
import {
  ActiveRunExistsError,
  createBuilderRunHandle,
  publishBuilderRunEvent,
  type BuilderRunHandle,
} from "@/features/agents/codex/runtime/builder-run-registry.server";
import {
  newRunId,
  resolveBuilderRunKind,
  runInitBuilderRun,
  runNewRouteBuilderRun,
  runSmallUpdateBuilderRun,
  runWithPlanModeIfRequested,
  type BuilderRunContext,
} from "@/features/agents/codex/runtime";
import { getCodexEnv, isCodexFeatureAvailable } from "@/features/agents/codex/runtime/feature-flag.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import type {
  AgentMessageKind,
  ComposerReasoningEffort,
  Project,
  ProjectMessageRepository,
  ProjectRepository,
  RunStreamEvent,
} from "@/shared/project-types";
import {
  translateBuilderEventToRunStreamEvent,
  emitRunStarted,
  type ProgressTimelineDirective,
  type TerminalKind,
} from "@/server/services/builder-run-translator.server";
import { publishChatEvent } from "@/server/services/chat-event-channel.server";
import type { ProgressLocale } from "@/server/functions/progress-mapper.server";
import type { PgAgentRunRepository } from "@/server/repositories/agent-run-repository";
import type { ProjectRunStore } from "@/features/projects/legacy/project-run-store.server";

export type BuilderRunStartInput = {
  projectId: string;
  userId: string | undefined;
  prompt: string;
  locale: string;
  reasoningEffort?: ComposerReasoningEffort | null;
  planMode?: boolean;
  project: Pick<Project, "status">;
  /** Existing agent_runs row id to attach the codex driver run to. */
  runId?: string;
  /** Optional callback fired after R5 resolves the kind, before the driver starts. */
  onKindResolved?: (kind: "init" | "update" | "new_route") => Promise<void> | void;
  /** Persistence wiring for the bridge (translator → message repo + run store + agent run repo). */
  persistence?: BuilderRunPersistence;
  /**
   * The user's parent message id, used to link agent answers back to the prompt
   * via parentMessageId. Optional but recommended.
   */
  parentMessageId?: string;
};

export type BuilderRunPersistence = {
  messageRepository: ProjectMessageRepository;
  projectRepository: ProjectRepository;
  runStore: ProjectRunStore;
  agentRunRepository?: PgAgentRunRepository;
};

export type BuilderRunStartOutcome =
  | { ok: true; runId: string; events: AsyncIterable<BuilderRunEvent>; signal: AbortSignal }
  | {
      ok: false;
      code: "config_unavailable" | "active_run_exists" | "blocked_request";
      message: string;
    };

async function listWorkspaceFiles(projectId: string): Promise<string[]> {
  const root = path.join(getProjectWorkspaceRoot(projectId), "published");
  const out: string[] = [];
  async function walk(dir: string, base: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full);
      if (entry.isDirectory()) {
        await walk(full, base);
      } else if (entry.isFile()) {
        out.push(rel);
      }
    }
  }
  await walk(root, root);
  return out.sort();
}

function subscribeAsAsyncIterable(handle: BuilderRunHandle): AsyncIterable<BuilderRunEvent> {
  const queue: BuilderRunEvent[] = [...handle.events];
  let resolveNext: ((value: IteratorResult<BuilderRunEvent>) => void) | null = null;
  let closed = false;

  const isTerminal = (e: BuilderRunEvent) =>
    e.type === "done" || e.type === "failed" || e.type === "cancelled";

  const subscriber = (event: BuilderRunEvent) => {
    queue.push(event);
    if (isTerminal(event)) closed = true;
    if (resolveNext) {
      const next = queue.shift();
      if (next) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: next, done: false });
      }
    }
  };
  handle.subscribers.add(subscriber);

  return {
    [Symbol.asyncIterator]() {
      return {
        next(): Promise<IteratorResult<BuilderRunEvent>> {
          if (queue.length > 0) {
            const value = queue.shift()!;
            return Promise.resolve({ value, done: false });
          }
          if (closed) {
            handle.subscribers.delete(subscriber);
            return Promise.resolve({ value: undefined as never, done: true });
          }
          return new Promise((resolve) => {
            resolveNext = resolve;
          });
        },
        return(): Promise<IteratorResult<BuilderRunEvent>> {
          handle.subscribers.delete(subscriber);
          return Promise.resolve({ value: undefined as never, done: true });
        },
      };
    },
  };
}

/**
 * Phase 1 entrypoint used by MessageService.runOrchestrator.
 *
 * Resolves the run kind server-side (R5), creates a BuilderRunHandle, kicks off
 * the matching driver, and exposes the event stream the bridge will translate.
 */
export async function startBuilderRunForChat(
  input: BuilderRunStartInput,
): Promise<BuilderRunStartOutcome> {
  console.log(
    JSON.stringify({
      event: "builder_run_dispatch_invoked",
      projectId: input.projectId,
      runId: input.runId,
      hasUserId: Boolean(input.userId),
      planMode: Boolean(input.planMode),
    }),
  );
  if (!isCodexFeatureAvailable()) {
    console.warn(
      JSON.stringify({
        event: "builder_run_dispatch_codex_feature_disabled",
        projectId: input.projectId,
      }),
    );
    return {
      ok: false,
      code: "config_unavailable",
      message: "AI builder is unavailable. Try again later.",
    };
  }
  const env = getCodexEnv();
  if (!env.available) {
    console.warn(
      JSON.stringify({
        event: "builder_run_dispatch_env_unavailable",
        projectId: input.projectId,
        reason: env.reason,
        missing: env.missing,
      }),
    );
    return {
      ok: false,
      code: "config_unavailable",
      message: "AI builder is unavailable. Try again later.",
    };
  }

  const workspaceFiles = await listWorkspaceFiles(input.projectId);
  const kind = resolveBuilderRunKind({
    project: input.project,
    workspaceFiles,
    prompt: input.prompt,
  });
  console.log(
    JSON.stringify({
      event: "builder_run_dispatch_kind_resolved",
      projectId: input.projectId,
      kind,
      workspaceFileCount: workspaceFiles.length,
      projectStatus: input.project.status,
    }),
  );
  if (kind === "unsupported") {
    return {
      ok: false,
      code: "blocked_request",
      message: "Yêu cầu nằm ngoài phạm vi.",
    };
  }

  if (input.onKindResolved) {
    await input.onKindResolved(kind);
  }

  const runId = input.runId ?? newRunId();
  let handle: BuilderRunHandle;
  try {
    handle = createBuilderRunHandle({ runId, projectId: input.projectId, userId: input.userId });
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "builder_run_dispatch_handle_create_failed",
        projectId: input.projectId,
        runId,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    if (error instanceof ActiveRunExistsError) {
      return {
        ok: false,
        code: "active_run_exists",
        message: "This project already has an active builder run.",
      };
    }
    throw error;
  }

  const ctx: BuilderRunContext = {
    projectId: input.projectId,
    userId: input.userId,
    runId,
    kind,
    userPrompt: input.prompt,
    locale: input.locale,
    env,
    projectSummary: null,
    signal: handle.abortController.signal,
    reasoningEffort: input.reasoningEffort ?? null,
    planMode: input.planMode ?? false,
  };

  const driver =
    kind === "init"
      ? runInitBuilderRun
      : kind === "new_route"
        ? runNewRouteBuilderRun
        : runSmallUpdateBuilderRun;

  const events = subscribeAsAsyncIterable(handle);

  // Set up the chat-side bridge: subscribe to BuilderRunHandle events,
  // translate to RunStreamEvent, persist messages + timeline + status, push
  // translated events into the chat event channel for SSE consumers.
  const ctxPersistence = input.persistence;
  const locale: ProgressLocale = input.locale.startsWith("vi") ? "vi" : "en";
  const translatorCtx = { runId, projectId: input.projectId, locale };
  // run.started fires immediately so SSE consumers see the run is alive
  publishChatEvent(runId, emitRunStarted(translatorCtx));

  const bridgeSubscriber = async (event: BuilderRunEvent) => {
    try {
      const outcome = translateBuilderEventToRunStreamEvent(event, translatorCtx);
      for (const e of outcome.events) {
        publishChatEvent(runId, e);
      }
      if (ctxPersistence && outcome.persist) {
        await persistAgentMessage(
          ctxPersistence,
          input.projectId,
          runId,
          input.userId,
          input.parentMessageId,
          outcome.persist,
        );
      }
      if (ctxPersistence?.agentRunRepository && outcome.timeline) {
        await persistTimeline(ctxPersistence.agentRunRepository, runId, outcome.timeline).catch(
          () => undefined,
        );
      }
      if (ctxPersistence && outcome.terminal) {
        await persistRunTerminal(
          ctxPersistence,
          input.projectId,
          runId,
          input.userId,
          outcome.terminal,
          event.type === "failed" ? event.failureCode : undefined,
        ).catch(() => undefined);
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "builder_run_bridge_subscriber_error",
          projectId: input.projectId,
          runId,
          error: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
  };
  // Replay any events that already arrived between handle creation and now.
  for (const buffered of handle.events) {
    void bridgeSubscriber(buffered);
  }
  handle.subscribers.add((event) => {
    void bridgeSubscriber(event);
  });

  console.log(
    JSON.stringify({
      event: "builder_run_dispatch_driver_starting",
      projectId: input.projectId,
      runId,
      kind,
      driverName: kind === "init" ? "runInitBuilderRun" : kind === "new_route" ? "runNewRouteBuilderRun" : "runSmallUpdateBuilderRun",
    }),
  );

  void runWithPlanModeIfRequested(
    ctx,
    (event) => {
      console.log(
        JSON.stringify({
          event: "builder_run_event",
          projectId: input.projectId,
          runId,
          eventType: event.type,
          milestone: "milestone" in event ? event.milestone : undefined,
          failureCode: event.type === "failed" ? event.failureCode : undefined,
        }),
      );
      publishBuilderRunEvent(handle, event);
    },
    driver,
  )
    .then(() => {
      console.log(
        JSON.stringify({
          event: "builder_run_driver_resolved",
          projectId: input.projectId,
          runId,
        }),
      );
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          event: "builder_run_driver_threw",
          projectId: input.projectId,
          runId,
          error: error instanceof Error ? error.message : "unexpected error",
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
      publishBuilderRunEvent(handle, {
        type: "failed",
        runId,
        milestone: "failed",
        failureCode: "codex_runtime_failed",
        message: error instanceof Error ? error.message : "unexpected error",
        at: Date.now(),
      });
    });

  return { ok: true, runId, events, signal: handle.abortController.signal };
}

async function persistAgentMessage(
  persistence: BuilderRunPersistence,
  projectId: string,
  runId: string,
  userId: string | undefined,
  parentMessageId: string | undefined,
  directive: NonNullable<
    ReturnType<typeof translateBuilderEventToRunStreamEvent>["persist"]
  >,
): Promise<void> {
  const now = new Date().toISOString();
  const kind: AgentMessageKind =
    directive.kind === "answer"
      ? "answer"
      : directive.kind === "error"
        ? "error"
        : directive.kind === "plan"
          ? "plan"
          : "agent_question";
  const content =
    "content" in directive ? directive.content : (directive as { question: string }).question;
  const planMetadata =
    directive.kind === "plan"
      ? ({ planPhase: "plan_ready" } as never)
      : null;
  await persistence.messageRepository.saveMessage(
    {
      id: crypto.randomUUID(),
      userId,
      projectId,
      role: "agent",
      content,
      status: "completed",
      processingStatus: "completed",
      parentMessageId,
      runId,
      kind,
      metadata: planMetadata,
      provider: "codex-sdk",
      createdAt: now,
      updatedAt: now,
    },
    userId,
  );
}

async function persistTimeline(
  agentRunRepository: PgAgentRunRepository,
  runId: string,
  directive: ProgressTimelineDirective,
): Promise<void> {
  const ev = directive as { kind: string; [k: string]: unknown };
  await agentRunRepository.appendProgressTimelineEvent(runId, {
    at: Date.now(),
    ...ev,
  } as never);
}

async function persistRunTerminal(
  persistence: BuilderRunPersistence,
  projectId: string,
  runId: string,
  userId: string | undefined,
  terminal: TerminalKind,
  failureCode?: string,
): Promise<void> {
  const run = await persistence.runStore.load(runId, userId).catch(() => undefined);
  if (!run) return;
  if (terminal === "completed" && run.status === "streaming") {
    await persistence.runStore.update(run, { status: "completed" });
    await persistence.projectRepository
      .updateProjectProcessingState(projectId, "idle", userId)
      .catch(() => undefined);
  } else if (terminal === "failed" && run.status === "streaming") {
    await persistence.runStore.fail(run, {
      code: failureCode ?? "PROVIDER_STREAM_FAILED",
      message: failureCode ?? "failed",
      recoverable: true,
    });
    await persistence.projectRepository
      .updateProjectProcessingState(projectId, "idle", userId)
      .catch(() => undefined);
  } else if (terminal === "stopped" && run.status === "streaming") {
    await persistence.runStore.stop(run);
    await persistence.projectRepository
      .updateProjectProcessingState(projectId, "idle", userId)
      .catch(() => undefined);
  } else if (terminal === "awaiting_input" && run.status !== "awaiting_input") {
    await persistence.runStore.update(run, { status: "awaiting_input" });
  }
}
