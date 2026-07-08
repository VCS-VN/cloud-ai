import path from "node:path";
import fs from "node:fs/promises";
import { getProjectWorkspaceRoot } from "@/server/config/paths.server";
import { isIgnoredWorkspaceDir } from "@/features/agents/codex/boundary/protected-paths";
import {
  ActiveRunExistsError,
  createBuilderRunHandle,
  publishBuilderRunEvent,
  type BuilderRunHandle,
} from "@/features/agents/codex/runtime/builder-run-registry.server";
import {
  newRunId,
  resolveBuilderRunKind,
  runGeneratePageBuilderRun,
  runInitBuilderRun,
  runNewRouteBuilderRun,
  runSmallUpdateBuilderRun,
  runWithPlanModeIfRequested,
  type BuilderRunContext,
  type ResolvedBuilderRunKind,
} from "@/features/agents/codex/runtime";
import {
  parseGeneratePageCommand,
  type GeneratePageTarget,
} from "@/features/agents/codex/runtime/generate-page";
import { getCodexEnv, isCodexFeatureAvailable } from "@/features/agents/codex/runtime/feature-flag.server";
import type { BuilderRunEvent } from "@/features/agents/ui/builder-events";
import {
  shouldForceTerminalOnDriverResolve,
} from "@/features/agents/ui/builder-run-status";
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
  onKindResolved?: (
    kind: "init" | "update" | "new_route" | "generate_page",
  ) => Promise<void> | void;
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
  // Source of truth is the project workspace root (projects/<id>/) — the same
  // cwd the preview pm2 process binds to and the directory all drivers write
  // into. `drafts/` (in-flight run scratch) and the legacy `published/` mirror
  // are excluded so a populated existing project is never misread as empty.
  const root = getProjectWorkspaceRoot(projectId);
  const out: string[] = [];
  async function walk(dir: string, base: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (
        isIgnoredWorkspaceDir(entry.name) ||
        (dir === base && (entry.name === "drafts" || entry.name === "published"))
      ) {
        continue;
      }
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
  // A /generate-page command routes straight to the generate_page driver — the
  // intent is explicit, so skip the classifier's heuristics. If the workspace
  // is still empty/draft, fall through to normal resolution (init must run
  // first before any single page can be generated).
  const generatePage = parseGeneratePageCommand(input.prompt);
  const isEmptyOrDraft =
    workspaceFiles.length === 0 || input.project.status === "draft";
  let generatePageTarget: GeneratePageTarget | undefined;
  let runPrompt = input.prompt;
  let kind: ResolvedBuilderRunKind;
  if (generatePage && !isEmptyOrDraft) {
    kind = "generate_page";
    generatePageTarget = generatePage.target;
    runPrompt = generatePage.restPrompt;
  } else {
    kind = resolveBuilderRunKind({
      project: input.project,
      workspaceFiles,
      prompt: input.prompt,
    });
  }
  console.log(
    JSON.stringify({
      event: "builder_run_dispatch_kind_resolved",
      projectId: input.projectId,
      kind,
      generatePageSlug: generatePageTarget?.slug,
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
    userPrompt: runPrompt,
    locale: input.locale,
    env,
    projectSummary: null,
    signal: handle.abortController.signal,
    reasoningEffort: input.reasoningEffort ?? null,
    planMode: input.planMode ?? false,
    generatePageTarget,
  };

  const driver =
    kind === "init"
      ? runInitBuilderRun
      : kind === "generate_page"
        ? runGeneratePageBuilderRun
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

  const handleBridgeEvent = async (event: BuilderRunEvent) => {
    try {
      const outcome = translateBuilderEventToRunStreamEvent(event, translatorCtx);
      // Persist BEFORE publishing the translated events. A terminal event marks
      // the SSE channel evictable the moment it is published, so the DB writes
      // (agent_runs.status + project.processingStatus=idle) must already be
      // committed — otherwise a refresh that falls through to the archived
      // replay path reads stale "streaming"/"processing" state and the UI hangs.
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
      for (const e of outcome.events) {
        publishChatEvent(runId, e);
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

  // Serialize the bridge. Each builder event must be translated, persisted, and
  // published in arrival order — a previous fire-and-forget (`void
  // bridgeSubscriber`) let a fast terminal event race ahead of the answer
  // message it should follow, so the SSE channel evicted before the message was
  // published and the client never saw the terminal (project stuck processing).
  // Chaining on a single tail promise guarantees one-at-a-time, in-order work.
  let bridgeQueue: Promise<void> = Promise.resolve();
  const enqueueBridgeEvent = (event: BuilderRunEvent) => {
    bridgeQueue = bridgeQueue.then(() => handleBridgeEvent(event));
  };
  // Replay any events that already arrived between handle creation and now.
  for (const buffered of handle.events) {
    enqueueBridgeEvent(buffered);
  }
  handle.subscribers.add((event) => {
    enqueueBridgeEvent(event);
  });

  console.log(
    JSON.stringify({
      event: "builder_run_dispatch_driver_starting",
      projectId: input.projectId,
      runId,
      kind,
      driverName:
        kind === "init"
          ? "runInitBuilderRun"
          : kind === "generate_page"
            ? "runGeneratePageBuilderRun"
            : kind === "new_route"
              ? "runNewRouteBuilderRun"
              : "runSmallUpdateBuilderRun",
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
          stepKind: event.type === "step" ? event.kind : undefined,
          stepStatus: event.type === "step" ? event.status : undefined,
          stepLabel: event.type === "step" ? event.label : undefined,
        }),
      );
      publishBuilderRunEvent(handle, event);
    },
    driver,
  )
    .then(async () => {
      if (shouldForceTerminalOnDriverResolve(handle.status)) {
        publishBuilderRunEvent(handle, {
          type: "failed",
          runId,
          milestone: "failed",
          failureCode: "codex_runtime_failed",
          message: "Builder driver ended before emitting a terminal event.",
          at: Date.now(),
        });
      }
      // Record the authored page slug once a generate_page run completes so the
      // /generate-page menu can mark it "designed". Best-effort — a failure to
      // persist must not surface as a run error.
      // init authors home + product-detail; generate_page authors one slug.
      // Record whichever applies so the /generate-page menu status is accurate.
      const authoredSlugs =
        handle.status !== "done"
          ? []
          : kind === "init"
            ? ["home", "product-detail"]
            : kind === "generate_page" && generatePageTarget
              ? [generatePageTarget.slug]
              : [];
      if (authoredSlugs.length > 0) {
        try {
          const { projectStateStore } = await (
            await import("@/server/services/project-services")
          ).getProjectServices();
          for (const slug of authoredSlugs) {
            await projectStateStore.appendGeneratedPage(
              input.projectId,
              slug,
              input.userId,
            );
          }
        } catch (error) {
          console.warn(
            JSON.stringify({
              event: "generated_pages_persist_failed",
              projectId: input.projectId,
              runId,
              slugs: authoredSlugs,
              error: error instanceof Error ? error.message : "unknown",
            }),
          );
        }
      }
      console.log(
        JSON.stringify({
          event: "builder_run_driver_resolved",
          projectId: input.projectId,
          runId,
          status: handle.status,
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
  const metadata =
    directive.kind === "plan"
      ? ({ planPhase: "plan_ready" } as never)
      : directive.kind === "agent_question"
        ? directive.metadata
        : null;

  // Deterministic id (msg-${runId}-{answer|error|question|plan}) so a single run
  // produces exactly one row per kind even when internal Codex turns + replay +
  // SSE reconnects all flow through this path. Update first; fall back to
  // insert when the row does not exist yet.
  const id = directive.messageId;
  const updates = {
    content,
    processingStatus: "completed" as const,
    runId,
    kind,
    provider: "codex-sdk",
    metadata,
    updatedAt: now,
  };
  const updated = await persistence.messageRepository
    .updateMessage(id, updates)
    .catch(() => undefined);
  if (updated) return;
  try {
    await persistence.messageRepository.saveMessage(
      {
        id,
        userId,
        projectId,
        role: "agent",
        content,
        status: "completed",
        processingStatus: "completed",
        parentMessageId,
        runId,
        kind,
        metadata,
        provider: "codex-sdk",
        createdAt: now,
        updatedAt: now,
      },
      userId,
    );
  } catch {
    // Race: another emit raced ahead and inserted; collapse via update.
    await persistence.messageRepository.updateMessage(id, updates).catch(() => undefined);
  }
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
  if (!run) {
    await clearProjectProcessingState(persistence, projectId, runId, userId, terminal);
    return;
  }
  if (terminal === "completed" && run.status === "streaming") {
    await persistence.runStore.update(run, { status: "completed" });
  } else if (terminal === "failed" && run.status === "streaming") {
    await persistence.runStore.fail(run, {
      code: failureCode ?? "PROVIDER_STREAM_FAILED",
      message: failureCode ?? "failed",
      recoverable: true,
    });
  } else if (terminal === "stopped" && run.status === "streaming") {
    await persistence.runStore.stop(run);
  } else if (terminal === "awaiting_input" && run.status !== "awaiting_input") {
    await persistence.runStore.update(run, { status: "awaiting_input" });
  }
  if (terminal === "completed" || terminal === "failed" || terminal === "stopped") {
    await clearProjectProcessingState(persistence, projectId, runId, userId, terminal);
  }
}

async function clearProjectProcessingState(
  persistence: BuilderRunPersistence,
  projectId: string,
  runId: string,
  userId: string | undefined,
  terminal: TerminalKind,
): Promise<void> {
  try {
    const project = await persistence.projectRepository.updateProjectProcessingState(
      projectId,
      "idle",
      userId,
    );
    if (!project) {
      console.warn(
        JSON.stringify({
          event: "builder_run_project_idle_update_missed",
          projectId,
          runId,
          terminal,
        }),
      );
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "builder_run_project_idle_update_failed",
        projectId,
        runId,
        terminal,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

export const __builderRunDispatcherTestables = {
  persistRunTerminal,
};
