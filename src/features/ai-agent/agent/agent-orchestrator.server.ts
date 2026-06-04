import type {
  AgentStreamEvent,
  BuilderIntent,
  ChangePlan,
  FileOperation,
  ProjectState,
  ValidationResult,
} from "./agent-events";
import type { ProjectRunStore } from "../project/project-run-store.server";
import type { ProjectStateStore } from "../project/project-state-store.server";
import type { ProjectFileStore } from "../project/project-file-store.server";
import type { SnapshotService } from "../project/snapshot-service.server";
import type { AgentConfig } from "./agent-config";
import type { ChatCompletionsProvider } from "../openai/chat-completions-provider.server";
import type { RuntimeService } from "../runtime/runtime-service.server";
import type { RuntimeOrchestrator } from "../runtime/runtime-orchestrator.server";
import {
  filterAssistantDeltaForUser,
  sanitizeForUser,
  redactTechnicalText,
} from "./user-facing-presenter";
import { extractWebsiteSpec } from "../planning/extract-website-spec.server";
import { buildFileManifest } from "../source/code-index-service.server";
import {
  ensureRootRouteLoadingBarContract,
  initInfrastructureSource,
  initSource,
  notFoundSource,
  productSuggestionsQuerySource,
  renderEnvSource,
  routeLoadingBarSource,
  siteHeaderShellSource,
} from "../source/init-source.server";
import {
  REQUIRED_GENERATED_STOREFRONT_FILES,
  REQUIRED_INIT_COMMERCE_ROUTE_FILES,
} from "../source/generated-project-layout";
import {
  formatInitIntegrityViolations,
  validateInitIntegrity,
} from "../source/init-integrity-service.server";
import { applyStoreSlugToEnv } from "../store-runtime/generated-project-env";
import {
  buildInitStorefrontRecoveryPrompt,
  buildRetailInitPrompt,
} from "./init-prompt.server";
import { buildVerticalInitGuidance } from "./vertical-init-guidance.server";
import { loadVerticalLayoutSpec } from "../design/vertical-layout-spec.server";
import { runDesignPipeline } from "../design/design-pipeline.server";
import { buildInitDesignPipelineSignal } from "../design/init-design-signal.server";
import { patchAppCssFromDesignSource } from "../code-tools/services/design-app-css-patch.server";
import { loadTasteSkill } from "../code-tools/services/taste-skill-loader.server";
import {
  collectPresentInitPaths,
  filterInitBackfillFiles,
  isDeterministicInitBackfillAllowed,
  isInitUiStorefrontPath,
  loopProducedInitUiFiles,
} from "../source/init-backfill-policy.server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { PromptLayerStore } from "./init-prompt-store.server";
import {
  selectTemplate,
  slugifyProjectName,
} from "../source/template-registry.server";
import { ValidationService } from "../source/validation-service.server";
import { toSafeAgentError } from "./agent-errors";
import { runThinkingLayer } from "../thinking/thinking-orchestrator.server";
import { createHeuristicThinkingResult } from "../thinking/thinking-fallback";
import {
  mapThinkingToCompletedEvent,
  mapThinkingToUserWishEvent,
} from "../thinking/thinking-events.mapper";
import { toThinkingRunSummary } from "../thinking/thinking.repository.server";
import type { ThinkingResult } from "../thinking/thinking.schema";
import { redactSecrets } from "../security/secret-redactor";
import { runAgenticLoop } from "./agentic-loop.server";
import type { AgenticLoopResult, PreloadedTasteSkill } from "./agentic-loop.types";
import { AsyncEventQueue } from "./async-event-queue";
import { isReasoningModel, selectReasoningEffort } from "./reasoning-effort";
import { executeProjectTool } from "../code-tools/code-tool-executor.server";
import {
  createDefaultCodeToolRegistry,
  createInitCodeToolRegistry,
} from "../code-tools/code-tool-registry.server";
import type { ToolExecutionContext } from "../code-tools/code-agent-types";
import {
  scanForAntiSlop,
  type AntiSlopViolation,
} from "../code-tools/services/anti-slop-scanner.server";
import {
  classifyDesignIntent,
  type DesignIntentLabel,
} from "../planning/design-intent-heuristic";
import { applyTokenPatches } from "../code-tools/services/design-rule-patch-service.server";
import { getProjectWorkspaceRoot } from "@/server/config/paths.server";
import { loadPromptDoc, renderPromptDoc } from "./prompt-template-store.server";
export type HandlePromptInput = {
  projectId: string;
  userId?: string;
  prompt: string;
  runId: string;
  parentMessageId?: string;
  clientRequestId?: string;
  signal?: AbortSignal;
};

export type AgentOrchestratorDeps = {
  projectStateStore: ProjectStateStore;
  runStore: ProjectRunStore;
  projectFileStore?: ProjectFileStore;
  snapshotService?: SnapshotService;
  validationService?: ValidationService;
  openAIProvider?: ChatCompletionsProvider;
  agentConfig?: AgentConfig;
  runtimeService?: RuntimeService;
  runtimeOrchestrator?: RuntimeOrchestrator;
  promptLayerStore?: PromptLayerStore;
  selectedStoreSlugResolver?: (
    projectId: string,
    userId?: string,
  ) => Promise<string | null>;
};

export class AgentOrchestrator {
  constructor(private readonly deps: AgentOrchestratorDeps) {}

  async *handlePromptStream(
    input: HandlePromptInput,
  ): AsyncGenerator<AgentStreamEvent> {
    const run = await this.deps.runStore.load(input.runId, input.userId);

    try {
      yield {
        type: "agent_started",
        runId: run.id,
        projectId: input.projectId,
        message: "AI Agent is analyzing the storefront request...",
      };

      const projectState = await this.deps.projectStateStore.loadOrCreate(
        input.projectId,
        input.userId,
      );
      yield { type: "state_loaded", status: projectState.status };

      const selectedStoreSlug = await this.resolveSelectedStoreSlug(
        input.projectId,
        input.userId,
      );

      yield {
        type: "thinking_started",
        runId: run.id,
        message: "Analyzing your request...",
      };
      yield {
        type: "thinking_context_loaded",
        runId: run.id,
        projectStatus: projectState.status,
        hasInitializedSource: canApplyIncrementalUpdate(projectState),
      };
      const thinking = await runThinkingLayer({
        projectId: input.projectId,
        run,
        userId: input.userId,
        userPrompt: input.prompt,
        projectState,
        provider: this.deps.openAIProvider,
        agentConfig: this.deps.agentConfig,
        runStore: this.deps.runStore,
      });
      yield mapThinkingToUserWishEvent(thinking);
      if (thinking.downstreamTask.taskType === "needs_clarification") {
        yield {
          type: "thinking_needs_clarification",
          runId: run.id,
          question:
            thinking.downstreamTask.clarification?.question ??
            "Please confirm before continuing.",
          reason:
            thinking.downstreamTask.clarification?.reason ??
            "Thinking layer requires clarification.",
        };
        await this.deps.runStore.waitForClarification(run, {
          thinking: toThinkingRunSummary(thinking),
        });
        return;
      }
      yield mapThinkingToCompletedEvent(thinking);

      const storefrontMode = getStorefrontExecutionMode(thinking);
      if (storefrontMode && storefrontMode !== "apply") {
        const plan = createNonApplyPlan(thinking, storefrontMode);
        yield { type: "plan_created", plan };
        const summary = nonApplySummary(storefrontMode, thinking);
        yield { type: "assistant_message_delta", delta: summary };
        yield { type: "done", runId: run.id, summary, changedFiles: [] };
        await this.deps.runStore.complete(run, {
          plan,
          affectedFiles: [],
          thinking: toThinkingRunSummary(thinking),
        });
        return;
      }

      const intent = builderIntentFromThinking(thinking);
      yield { type: "intent_detected", intent };

      if (intent.shouldAskClarifyingQuestion && intent.riskLevel === "high") {
        const plan = createClarificationPlan(intent);
        yield {
          type: "clarification_required",
          question:
            intent.clarificationQuestion ??
            "Please confirm before applying this high-risk storefront change.",
        };
        await this.deps.runStore.waitForClarification(run, {
          intent,
          plan,
          affectedFiles: [],
        });
        return;
      }

      if (shouldInitializeProject(projectState, intent)) {
        yield* this.initProjectWorkflow({
          input,
          runId: run.id,
          projectState,
          intent,
        });
        const plan = createInitPlan(intent);
        await this.deps.runStore.complete(run, {
          intent,
          plan,
          affectedFiles: [],
          thinking: toThinkingRunSummary(thinking),
        });
        return;
      }

      let activeProjectState = projectState;
      let effectiveUserPrompt = input.prompt;
      let redesignedHash: string | undefined;
      const designIntent: DesignIntentLabel = classifyDesignIntent({
        prompt: input.prompt,
        projectStatus: projectState.status,
      });
      console.info(
        JSON.stringify({
          event: "design_intent_classified",
          kind: designIntent.kind,
          tokenHintsCount:
            designIntent.kind === "update_token"
              ? designIntent.tokenHints.length
              : designIntent.kind === "redesign"
                ? (designIntent.tokenHints?.length ?? 0)
                : 0,
        }),
      );

      if (
        designIntent.kind === "update_token" &&
        projectState.status === "initialized"
      ) {
        if (designIntent.tokenHints.length === 0) {
          const plan = createClarificationPlan(intent);
          yield {
            type: "clarification_required",
            question:
              "Bạn muốn đổi token nào? Hãy nêu rõ giá trị cụ thể (ví dụ: 'đổi màu primary thành #1F3A2E' hoặc 'đổi font sang \"Crimson Pro\"').",
          };
          await this.deps.runStore.waitForClarification(run, {
            intent,
            plan,
            affectedFiles: [],
          });
          return;
        }
        const patchResult = await applyTokenPatches({
          projectId: input.projectId,
          workspaceRoot: getProjectWorkspaceRoot(input.projectId),
          tokenHints: designIntent.tokenHints,
        });
        if (!patchResult.ok) {
          const plan = createClarificationPlan(intent);
          yield {
            type: "clarification_required",
            question:
              patchResult.code === "DESIGN_PATCH_TOKEN_ROLE_NOT_FOUND"
                ? `Không tìm thấy role tương ứng trong DESIGN.md (${patchResult.message}). Nếu bạn muốn thêm role mới, hãy gửi prompt redesign tổng thể.`
                : patchResult.message,
          };
          await this.deps.runStore.waitForClarification(run, {
            intent,
            plan,
            affectedFiles: [],
          });
          return;
        }
        yield {
          type: "design_file_token_patched",
          projectId: input.projectId,
          messageId: run.id,
          data: {
            destinationPath: patchResult.destinationPath,
            appliedRoles: patchResult.appliedRoles,
            previousHash: patchResult.previousHash,
            hash: patchResult.hash,
            byteSize: patchResult.byteSize,
          },
        };
        activeProjectState = await this.deps.projectStateStore.patch(
          input.projectId,
          {
            designState: {
              templateId:
                projectState.designState?.templateId ?? "ai-generated",
              designSourcePath: "DESIGN.md",
              designSourceHash: patchResult.hash,
              designCopiedAt: new Date().toISOString(),
            },
          },
          input.userId,
        );
        redesignedHash = patchResult.hash;
        effectiveUserPrompt = buildTokenPatchRewritePrompt(
          input.prompt,
          patchResult.appliedRoles,
        );
        yield {
          type: "project_state_updated",
          projectState: activeProjectState,
        };
      } else if (
        designIntent.kind === "redesign" &&
        projectState.status === "initialized"
      ) {
        // The agent re-authors DESIGN.md inside the loop (no server-side design
        // generation). We still refresh brand/spec from the prompt so project
        // state stays accurate; the project_create_file hook re-patches app.css
        // tokens when the agent rewrites DESIGN.md.
        const redesignWebsiteSpec = await extractWebsiteSpec({
          prompt: input.prompt,
          projectState,
          provider: this.deps.openAIProvider,
          model: this.deps.agentConfig?.plannerModel,
        });
        activeProjectState = await this.deps.projectStateStore.patch(
          input.projectId,
          {
            brand: redesignWebsiteSpec.brand,
          },
          input.userId,
        );
        effectiveUserPrompt = buildRedesignRewritePrompt(
          input.prompt,
          designIntent.tokenHints,
        );
        yield {
          type: "project_state_updated",
          projectState: activeProjectState,
        };
      }

      const toolExecutionContext: ToolExecutionContext = {
        userId: input.userId ?? "",
        projectId: input.projectId,
        messageId: run.id,
        workspaceRoot: getProjectWorkspaceRoot(input.projectId),
        projectState: activeProjectState,
      };
      (
        toolExecutionContext as unknown as { __codeToolSnapshotId: string }
      ).__codeToolSnapshotId = `update-${run.id}`;

      const registry = createDefaultCodeToolRegistry();

      const preloadedTasteSkill = await loadTasteSkill();
      toolExecutionContext.flags = {
        ...(toolExecutionContext.flags ?? {}),
        tasteSkillLoaded: true,
        designRulesLoaded: toolExecutionContext.flags?.designRulesLoaded ?? false,
      };
      toolExecutionContext.tasteSkillHash = preloadedTasteSkill.hash;

      let loopResult = yield* this.runAgenticEditPass({
        userPrompt: effectiveUserPrompt,
        projectId: input.projectId,
        userId: input.userId,
        runId: run.id,
        projectState: activeProjectState,
        selectedStoreSlug,
        thinking,
        toolExecutionContext,
        registry,
        preloadedTasteSkill,
        signal: input.signal,
      });

      // Anti-slop enforcement: scan changed UI files, run bounded repair passes,
      // then surface any remaining violations to the user (never loop forever).
      loopResult = yield* this.enforceAntiSlop({
        loopResult,
        projectId: input.projectId,
        userId: input.userId,
        runId: run.id,
        projectState: activeProjectState,
        selectedStoreSlug,
        thinking,
        toolExecutionContext,
        registry,
        preloadedTasteSkill,
        signal: input.signal,
      });

      const nextProjectState = await this.deps.projectStateStore.patch(
        input.projectId,
        {
          status: loopResult.status === "completed" ? "initialized" : "failed",
          fileManifest: mergeManifest(
            activeProjectState,
            loopResult.changedFiles.map((path) => ({
              type: "create_file" as const,
              path,
              content: "",
            })),
          ),
          recentChanges: [
            ...activeProjectState.recentChanges,
            {
              at: new Date().toISOString(),
              runId: run.id,
              userPrompt: input.prompt,
              summary: loopResult.summary,
              changedFiles: loopResult.changedFiles,
              validationStatus:
                loopResult.status === "completed"
                  ? ("passed" as const)
                  : ("failed" as const),
            },
          ].slice(-10),
        },
        input.userId,
      );
      void redesignedHash;
      yield { type: "project_state_updated", projectState: nextProjectState };

      const summary = yield* this.streamUserFacingSummary({
        fallbackSummary: loopResult.summary,
        input,
        intent: builderIntentFromThinking(thinking),
        plan: createLoopPlan(loopResult),
        changedFiles: loopResult.changedFiles,
        validation: {
          ok: loopResult.status === "completed",
          commands: [],
          summary: loopResult.summary,
          errors: [],
        },
      });

      yield {
        type: "done",
        runId: run.id,
        summary,
        changedFiles: loopResult.changedFiles,
      };
      await this.deps.runStore.complete(run, {
        intent,
        plan: createLoopPlan(loopResult),
        affectedFiles: loopResult.changedFiles,
        validationResult: {
          ok: loopResult.status === "completed",
          commands: [],
          summary: loopResult.summary,
          errors: [],
        },
        thinking: toThinkingRunSummary(thinking),
      });
    } catch (error) {
      const safeError = toSafeAgentError(error, "AGENT_STREAM_FAILED");
      await this.deps.runStore.fail(run, safeError);
      yield { type: "error", ...safeError };
    }
  }

  private async *initProjectWorkflow(args: {
    input: HandlePromptInput;
    runId: string;
    projectState: ProjectState;
    intent: BuilderIntent;
  }): AsyncGenerator<AgentStreamEvent> {
    const { input, projectState, intent } = args;
    const phaseContext = {
      runId: args.runId,
      projectId: input.projectId,
      messageId: args.runId,
    };
    const runPhase = async <T>(
      name: string,
      operation: () => Promise<T> | T,
    ): Promise<T> => {
      logAgentPhase("started", name, phaseContext);
      try {
        const result = await operation();
        logAgentPhase("finished", name, phaseContext);
        return result;
      } catch (error) {
        logAgentPhase("failed", name, phaseContext, error);
        throw error;
      }
    };

    logAgentPhase("started", "create_plan", phaseContext);
    const plan = createInitPlan(intent);
    logAgentPhase("finished", "create_plan", phaseContext);
    yield { type: "plan_created", plan };
    const selectedStoreSlug = await this.resolveSelectedStoreSlug(
      input.projectId,
      input.userId,
    );

    const websiteSpec = await runPhase("extract_website_spec", () =>
      extractWebsiteSpec({
        prompt: input.prompt,
        projectState,
        provider: this.deps.openAIProvider,
        model: this.deps.agentConfig?.plannerModel,
      }),
    );
    const templateId = await runPhase("select_template", () =>
      selectTemplate(websiteSpec),
    );
    const verticalLayout = await runPhase("load_vertical_layout", () =>
      loadVerticalLayoutSpec(templateId),
    );
    console.info(
      JSON.stringify({
        event: "vertical_layout_loaded",
        projectId: input.projectId,
        templateId,
        verticalLabel: verticalLayout.verticalLabel,
        rhythm: verticalLayout.homepage.rhythm,
        storeType: websiteSpec.store.type,
      }),
    );

    yield {
      type: "source_generation_started",
      message: "Đang chuẩn bị cấu trúc cửa hàng",
    };

    // Write .env with VITE_API_BASE_URL. The AI Agent is NOT allowed to read or
    // write .env; the app process owns it. DESIGN.md is now authored by the agent
    // inside the agentic loop (no server-side design generation); the
    // project_create_file hook patches app.css tokens when the agent writes it.
    await runPhase("write_project_env", () =>
      this.deps.projectFileStore?.writeManagedEnvFile(
        input.projectId,
        applyStoreSlugToEnv(renderEnvSource(), selectedStoreSlug),
      ),
    );
    yield { type: "file_changed", path: ".env", operation: "created" };

    const initResult = await runPhase("init_infrastructure", () =>
      initInfrastructureSource({
        projectSlug: slugifyProjectName(websiteSpec.store.name),
        packageManager: projectState.stack.packageManager,
        packageRegistryVersion: "initial-v1",
        templateId,
        websiteSpec,
      }),
    );

    logAgentPhase("started", "write_infrastructure_files", phaseContext);
    try {
      for (const file of initResult.files) {
        await this.deps.projectFileStore?.writeTextFile(
          input.projectId,
          file.path,
          file.content,
        );
        yield { type: "file_changed", path: file.path, operation: "created" };
      }
      logAgentPhase("finished", "write_infrastructure_files", phaseContext);
    } catch (error) {
      logAgentPhase(
        "failed",
        "write_infrastructure_files",
        phaseContext,
        error,
      );
      throw error;
    }

    yield {
      type: "source_generation_started",
      message: "Đang tạo giao diện storefront",
    };

    const preloadedTasteSkill = await runPhase("preload_taste_skill", () =>
      loadTasteSkill(),
    );
    console.info(
      JSON.stringify({
        event: "taste_skill_preloaded_init",
        projectId: input.projectId,
        hash: preloadedTasteSkill.hash,
        contentChars: preloadedTasteSkill.content.length,
      }),
    );

    const workspaceRoot = getProjectWorkspaceRoot(input.projectId);
    const serverDesignPaths: string[] = [];
    let serverDesignGuidance = "";
    let serverDesignSourceHash: string | undefined;

    const designPipelineResult = await runPhase("init_design_pipeline", () =>
      runDesignPipeline({
        projectId: input.projectId,
        intent: "init",
        workspacePath: workspaceRoot,
        templateId,
        signal: buildInitDesignPipelineSignal(websiteSpec, input.prompt),
      }),
    );

    if (designPipelineResult.status === "ok") {
      serverDesignPaths.push("DESIGN.md", "blocks.json");
      serverDesignSourceHash = designPipelineResult.designSourceHash;
      const designSource = await fs.readFile(
        path.join(workspaceRoot, "DESIGN.md"),
        "utf8",
      );
      const cssPatch = await patchAppCssFromDesignSource(
        workspaceRoot,
        designSource,
      );
      if (cssPatch.ok) {
        serverDesignPaths.push("src/styles/app.css");
      } else {
        console.warn(
          `[init] app.css token patch skipped: ${cssPatch.message}`,
        );
      }
      console.info(
        JSON.stringify({
          event: "init_design_pipeline_ok",
          projectId: input.projectId,
          templateId,
          designSourceHash: designPipelineResult.designSourceHash,
        }),
      );
      for (const designPath of serverDesignPaths) {
        yield { type: "file_changed", path: designPath, operation: "created" };
      }
      serverDesignGuidance =
        "\n\n" +
        loadPromptDoc("templates/init-recovery/server-design-guidance.md");
    } else {
      console.warn(
        JSON.stringify({
          event: "init_design_pipeline_skipped",
          projectId: input.projectId,
          status: designPipelineResult.status,
          reason:
            designPipelineResult.status === "needs-manual-review"
              ? designPipelineResult.reason
              : "no-op",
          details:
            designPipelineResult.status === "needs-manual-review"
              ? designPipelineResult.details
              : undefined,
          templateId,
        }),
      );
    }

    const initPathsFromStart = new Set([
      ...initResult.files.map((file) => file.path),
      ...serverDesignPaths,
    ]);

    const toolExecutionContext: ToolExecutionContext = {
      userId: input.userId ?? "",
      projectId: input.projectId,
      messageId: args.runId,
      workspaceRoot,
      projectState,
      flags: {
        tasteSkillLoaded: true,
        designRulesLoaded: serverDesignPaths.includes("DESIGN.md"),
      },
      tasteSkillHash: preloadedTasteSkill.hash,
    };
    (toolExecutionContext as any).__codeToolSnapshotId = "init-snapshot";
    if (serverDesignSourceHash) {
      (toolExecutionContext as any).__designSourceHash = serverDesignSourceHash;
    }

    const registry = createInitCodeToolRegistry();
    const retailInitPrompt =
      (this.deps.promptLayerStore
        ? this.deps.promptLayerStore.assembleInitPrompt({ websiteSpec })
        : buildRetailInitPrompt({ userPrompt: input.prompt, websiteSpec })) +
      buildVerticalInitGuidance(verticalLayout) +
      serverDesignGuidance;

    const thinking = createHeuristicThinkingResult({
      projectId: input.projectId,
      runId: args.runId,
      userId: input.userId,
      userPrompt: retailInitPrompt,
      projectState,
      conversationContext: {
        recentUserMessages: [],
        recentAssistantSummaries: [],
      },
      projectContext: {
        status: projectState.status === "empty" ? "empty" : "initialized",
        fileManifest: projectState.fileManifest.map((f) => ({
          path: f.path,
          purpose: f.purpose,
          kind: f.kind as
            | "route"
            | "component"
            | "data"
            | "config"
            | "style"
            | "server"
            | "state"
            | "unknown",
        })),
        recentChanges: projectState.recentChanges.map((c) => ({
          runId: c.runId,
          userPrompt: c.userPrompt,
          summary: c.summary,
          changedFiles: c.changedFiles,
          validationStatus: c.validationStatus,
        })),
      },
    });

    console.info(
      JSON.stringify({
        event: "init_agentic_loop_starting",
        projectId: input.projectId,
        promptLength: retailInitPrompt.length,
        toolCount: registry.list().length,
        toolNames: registry.list().map((t) => t.name),
        model: this.deps.agentConfig?.coderModel ?? "gpt-5.4",
      }),
    );

    let loopResult = yield* this.runInitAgenticLoopPass({
      input,
      runId: args.runId,
      projectState,
      selectedStoreSlug,
      thinking,
      toolExecutionContext,
      registry,
      preloadedTasteSkill,
      userPrompt: retailInitPrompt,
      pathsSatisfiedAtRunStart: initPathsFromStart,
      signal: input.signal,
    });

    console.info(
      JSON.stringify({
        event: "init_agentic_loop_completed",
        projectId: input.projectId,
        status: loopResult.status,
        totalToolCalls: loopResult.totalToolCalls,
        changedFileCount: loopResult.changedFiles.length,
        changedFiles: loopResult.changedFiles.slice(0, 40),
        producedStorefrontImplementation: loopProducedInitUiFiles(
          loopResult.changedFiles,
        ),
        iterations: loopResult.iterations,
        summary: loopResult.summary?.substring(0, 200),
      }),
    );

    const missingRequiredFiles = REQUIRED_GENERATED_STOREFRONT_FILES.filter(
      (requiredPath) =>
        !initPathsFromStart.has(requiredPath) &&
        !loopResult.changedFiles.includes(requiredPath),
    );

    const loopFailed =
      loopResult.status === "failed" || loopResult.status === "aborted";
    if (loopFailed && !loopProducedInitUiFiles(loopResult.changedFiles)) {
      const message =
        loopResult.status === "aborted"
          ? "Project initialization was cancelled before storefront UI could be generated."
          : "Project initialization failed: the coding agent did not produce storefront UI. Check model/API errors in logs (init_agentic_loop_completed).";
      console.error(
        JSON.stringify({
          event: "init_agentic_loop_failed_no_ui",
          projectId: input.projectId,
          status: loopResult.status,
          summary: loopResult.summary?.substring(0, 300),
          totalToolCalls: loopResult.totalToolCalls,
        }),
      );
      yield {
        type: "error",
        code: "INIT_AGENTIC_LOOP_FAILED",
        message,
        recoverable: false,
      };
      throw new Error(message);
    }

    const shouldBackfill =
      missingRequiredFiles.length > 0 &&
      isDeterministicInitBackfillAllowed(loopResult);

    if (shouldBackfill) {
      console.info(
        JSON.stringify({
          event: "init_backfill_required_files",
          projectId: input.projectId,
          reason:
            "Backfilling non-UI required files only (no generic template UI overwrite)",
          missingRequiredFiles,
          loopStatus: loopResult.status,
        }),
      );

      yield {
        type: "source_generation_started",
        message:
          "Đang bổ sung dữ liệu và luồng mua hàng cần thiết",
      };

      const fallbackResult = await runPhase("backfill_init_source", () =>
        initSource({
          projectSlug: slugifyProjectName(websiteSpec.store.name),
          packageManager: projectState.stack.packageManager,
          packageRegistryVersion: "initial-v1",
          templateId,
          websiteSpec,
        }),
      );

      const existingChangedFiles = new Set([
        ...initPathsFromStart,
        ...loopResult.changedFiles,
      ]);
      const filesToBackfill = filterInitBackfillFiles(
        fallbackResult.files,
        existingChangedFiles,
      );
      const backfilledFiles: string[] = [];

      logAgentPhase("started", "write_backfill_files", phaseContext);
      try {
        for (const file of filesToBackfill) {
          if (await this.projectFileExists(input.projectId, file.path))
            continue;
          await this.deps.projectFileStore?.writeTextFile(
            input.projectId,
            file.path,
            file.content,
          );
          backfilledFiles.push(file.path);
          yield { type: "file_changed", path: file.path, operation: "created" };
        }
        logAgentPhase("finished", "write_backfill_files", phaseContext);
      } catch (error) {
        logAgentPhase("failed", "write_backfill_files", phaseContext, error);
      }

      loopResult = {
        ...loopResult,
        status: loopResult.status === "max_iterations" ? "max_iterations" : "completed",
        summary: `${loopResult.summary} Infrastructure backfill wrote ${backfilledFiles.length} file(s); generic UI template paths were not overwritten.`,
        changedFiles: [...loopResult.changedFiles, ...backfilledFiles],
      };
    }

    const stillMissingRequired: string[] = [];
    for (const requiredPath of REQUIRED_GENERATED_STOREFRONT_FILES) {
      if (initPathsFromStart.has(requiredPath)) continue;
      if (loopResult.changedFiles.includes(requiredPath)) continue;
      if (await this.projectFileExists(input.projectId, requiredPath)) continue;
      stillMissingRequired.push(requiredPath);
    }
    let missingUi = stillMissingRequired.filter(isInitUiStorefrontPath);
    const presentAfterLoop = collectPresentInitPaths(
      initPathsFromStart,
      loopResult.changedFiles,
    );
    if (missingUi.length > 0) {
      console.warn(
        JSON.stringify({
          event: "init_ui_recovery_pass_starting",
          projectId: input.projectId,
          missingCount: missingUi.length,
          missingCommerceRoutes: REQUIRED_INIT_COMMERCE_ROUTE_FILES.filter(
            (p) => !presentAfterLoop.has(p),
          ),
          loopStatus: loopResult.status,
        }),
      );
      yield {
        type: "source_generation_started",
        message: "Đang hoàn thiện các trang còn thiếu",
      };
      for (const requiredPath of REQUIRED_INIT_COMMERCE_ROUTE_FILES) {
        if (presentAfterLoop.has(requiredPath)) continue;
        if (await this.projectFileExists(input.projectId, requiredPath)) {
          presentAfterLoop.add(requiredPath);
        }
      }
      const recoveryResult = yield* this.runInitAgenticLoopPass({
        input,
        runId: args.runId,
        projectState,
        selectedStoreSlug,
        thinking,
        toolExecutionContext,
        registry,
        userPrompt: buildInitStorefrontRecoveryPrompt({
          missingPaths: missingUi,
          hasServerDesign: serverDesignPaths.includes("DESIGN.md"),
        }),
        pathsSatisfiedAtRunStart: presentAfterLoop,
        signal: input.signal,
      });
      loopResult = {
        ...recoveryResult,
        changedFiles: [
          ...new Set([
            ...loopResult.changedFiles,
            ...recoveryResult.changedFiles,
          ]),
        ],
        summary: `${loopResult.summary} Recovery pass: ${recoveryResult.summary}`,
      };
      stillMissingRequired.length = 0;
      for (const requiredPath of REQUIRED_GENERATED_STOREFRONT_FILES) {
        if (initPathsFromStart.has(requiredPath)) continue;
        if (loopResult.changedFiles.includes(requiredPath)) continue;
        if (await this.projectFileExists(input.projectId, requiredPath))
          continue;
        stillMissingRequired.push(requiredPath);
      }
      missingUi = stillMissingRequired.filter(isInitUiStorefrontPath);
    }
    const presentFinal = collectPresentInitPaths(
      initPathsFromStart,
      loopResult.changedFiles,
    );
    for (const requiredPath of REQUIRED_GENERATED_STOREFRONT_FILES) {
      if (presentFinal.has(requiredPath)) continue;
      if (await this.projectFileExists(input.projectId, requiredPath)) {
        presentFinal.add(requiredPath);
      }
    }
    const missingCommerceRoutes = REQUIRED_INIT_COMMERCE_ROUTE_FILES.filter(
      (p) => !presentFinal.has(p),
    );
    if (missingUi.length > 0 || missingCommerceRoutes.length > 0) {
      const message = `Storefront UI was not generated (${missingUi.length} required paths missing; commerce routes missing: ${missingCommerceRoutes.join(", ") || "none"}). Agent loop status=${loopResult.status}. Retry init or check OPENAI_API_KEY / model errors.`;
      console.error(
        JSON.stringify({
          event: "init_missing_ui_after_backfill",
          projectId: input.projectId,
          missingUi,
          missingCommerceRoutes,
          loopStatus: loopResult.status,
        }),
      );
      yield {
        type: "error",
        code: "INIT_MISSING_UI",
        message,
        recoverable: false,
      };
      throw new Error(message);
    }

    const invariantFixes = await this.ensureGeneratedProjectInvariants(
      input.projectId,
    );
    for (const path of invariantFixes) {
      yield { type: "file_changed", path, operation: "modified" };
    }

    const integrity = await runPhase("validate_init_integrity", () =>
      validateInitIntegrity({ workspaceRoot }),
    );
    if (!integrity.ok) {
      const message = `Generated storefront integrity check failed:\n${formatInitIntegrityViolations(integrity.violations)}`;
      console.error(
        JSON.stringify({
          event: "init_integrity_failed",
          projectId: input.projectId,
          violations: integrity.violations,
        }),
      );
      yield {
        type: "error",
        code: "INIT_INTEGRITY_FAILED",
        message,
        recoverable: false,
      };
      throw new Error(message);
    }

    // Anti-slop enforcement on init output (LLM-generated + backfilled UI files):
    // scan, run bounded repair passes, then surface any remaining violations.
    loopResult = yield* this.enforceAntiSlop({
      loopResult,
      projectId: input.projectId,
      userId: input.userId,
      runId: args.runId,
      projectState,
      selectedStoreSlug,
      thinking,
      toolExecutionContext,
      registry,
      signal: input.signal,
    });

    const allChangedFiles = [
      ...initResult.files.map((f) => f.path),
      ...serverDesignPaths,
      ...loopResult.changedFiles,
      ...invariantFixes,
    ];
    const uniqueChangedFiles = [...new Set(allChangedFiles)];
    const infraManifest = buildFileManifest(initResult.files);
    const uiManifest = buildFileManifest(
      loopResult.changedFiles.map((path) => ({ path, content: "" })),
    );
    const mergedManifest = [
      ...infraManifest,
      ...uiManifest.filter(
        (ui) => !infraManifest.some((infra) => infra.path === ui.path),
      ),
    ];

    yield { type: "validation_started", commands: plan.validationCommands };
    const validation = await runPhase("validate", () =>
      this.validate(input.projectId, plan.validationCommands),
    );
    yield {
      type: "validation_finished",
      ok: validation.ok,
      summary: validation.summary,
      errors: validation.errors,
    };

    const nextProjectState = await runPhase("save_project_state", () =>
      this.deps.projectStateStore.save(
        {
          ...projectState,
          ...initResult.projectStatePatch,
          status: "initialized",
          ecommerceSpec: {
            ...projectState.ecommerceSpec,
            storeType: websiteSpec.store.type,
            targetCustomers: websiteSpec.store.targetCustomers,
            mainProducts: websiteSpec.products,
            requiredFeatures: Object.entries(websiteSpec.features)
              .filter(([, enabled]) => Boolean(enabled))
              .map(([feature]) => feature),
          },
          brand: websiteSpec.brand,
          pages: websiteSpec.pages.map((page) => ({
            ...page,
            purpose: `Storefront page for ${page.name}`,
            status: "implemented",
          })),
          features: { ...projectState.features, ...websiteSpec.features },
          fileManifest: mergedManifest,
          designState: {
            templateId: "ai-generated",
            designSourcePath: "DESIGN.md",
            designSourceHash:
              (toolExecutionContext as any).__designSourceHash ??
              "agent-authored",
            designCopiedAt: new Date().toISOString(),
          },
        },
        input.userId,
      ),
    );
    yield { type: "project_state_updated", projectState: nextProjectState };

    await this.deps.snapshotService?.createSnapshot({
      projectId: input.projectId,
      userId: input.userId,
      runId: args.runId,
      kind: "initial",
      summary: "Initial retail storefront snapshot.",
      projectState: nextProjectState,
      fileManifest: mergedManifest,
    });

    let previewUrl: string | undefined;

    if (this.deps.runtimeOrchestrator) {
      void this.deps.runtimeOrchestrator
        .scheduleEnsureRunning({
          projectId: input.projectId,
          workspaceRoot,
          userId: input.userId,
          signal: input.signal,
        })
        .catch((error) => {
          logAgentPhase("failed", "runtime_schedule", phaseContext, error);
        });
    } else if (this.deps.runtimeService) {
      const installYield = this.deps.runtimeService.runPostInitInstall({
        projectId: input.projectId,
        workspaceRoot,
        runId: args.runId,
        signal: input.signal,
      });
      let installFailed = false;
      for await (const event of installYield) {
        yield event;
        if (event.type === "dev_install_failed") {
          installFailed = true;
        }
      }

      if (!installFailed) {
        const devYield = this.deps.runtimeService.runPostInitDev({
          projectId: input.projectId,
          workspaceRoot,
          runId: args.runId,
          signal: input.signal,
        });
        for await (const event of devYield) {
          yield event;
          if (event.type === "dev_ready") {
            previewUrl = event.previewUrl;
          }
        }
      }
    }

    const fallbackSummary = "Done.";
    logAgentPhase("started", "summary", phaseContext);
    const summary = yield* this.streamUserFacingSummary({
      fallbackSummary,
      input,
      intent,
      plan,
      changedFiles: uniqueChangedFiles,
      validation,
    });
    logAgentPhase("finished", "summary", phaseContext);
    yield {
      type: "done",
      runId: args.runId,
      summary,
      changedFiles: uniqueChangedFiles,
      previewUrl,
    };
  }

  private async ensureGeneratedProjectInvariants(projectId: string) {
    if (!this.deps.projectFileStore) return [];
    const changedFiles: string[] = [];
    const rootPath = "src/routes/__root.tsx";

    try {
      const rootSource = await this.deps.projectFileStore.readTextFile(
        projectId,
        rootPath,
      );
      let nextRootSource = rootSource
        .replace(/^import\s+['\"]\.\.\/app\.css['\"];?\s*$/m, "")
        .replace(/^import\s+['\"]\.\/app\.css['\"];?\s*$/m, "")
        .replace(
          /^import\s+appCss\s+from\s+['\"]\.\.\/app\.css\?url['\"];?\s*$/m,
          "",
        )
        .replace(
          /^import\s+appCss\s+from\s+['\"]@\/styles\/app\.css\?url['\"];?\s*$/m,
          "",
        );

      // if (!nextRootSource.includes("@vitejs/plugin-react/preamble")) {
      //   nextRootSource = `import '@vitejs/plugin-react/preamble'\n${nextRootSource}`;
      // }
      if (!nextRootSource.includes("@/styles/app.css")) {
        // const preambleImport = "import '@vitejs/plugin-react/preamble'";
        nextRootSource =
          // nextRootSource.includes(preambleImport)
          //   ? nextRootSource.replace(
          //       preambleImport,
          //       `${preambleImport}\nimport '@/styles/app.css'`,
          //     )
          //   :
          `import '@/styles/app.css'\n${nextRootSource}`;
      }
      if (!nextRootSource.includes("notFoundComponent")) {
        if (!nextRootSource.includes("@/components/store/not-found")) {
          const footerImport =
            "import { SiteFooter } from '@/components/layout/site-footer'";
          nextRootSource = nextRootSource.includes(footerImport)
            ? nextRootSource.replace(
                footerImport,
                `${footerImport}\nimport { NotFound } from '@/components/store/not-found'`,
              )
            : `import { NotFound } from '@/components/store/not-found'\n${nextRootSource}`;
        }
        nextRootSource = nextRootSource.replace(
          /createRootRoute\(\{\s*component:\s*Root\s*\}\)/,
          "createRootRoute({ component: Root, notFoundComponent: NotFound })",
        );
      }
      nextRootSource = ensureRootRouteLoadingBarContract(nextRootSource);
      nextRootSource = nextRootSource.replace(/\n{3,}/g, "\n\n");

      if (nextRootSource !== rootSource) {
        await this.deps.projectFileStore.writeTextFile(
          projectId,
          rootPath,
          nextRootSource,
        );
        changedFiles.push(rootPath);
        console.info(
          JSON.stringify({
            event: "init_invariant_repaired",
            projectId,
            path: rootPath,
            invariant: "react_preamble_and_styles_alias",
          }),
        );
      }
      if (!rootSource.includes("notFoundComponent")) {
        const notFoundPath = "src/components/store/not-found.tsx";
        try {
          await this.deps.projectFileStore.readTextFile(
            projectId,
            notFoundPath,
          );
        } catch {
          await this.deps.projectFileStore.writeTextFile(
            projectId,
            notFoundPath,
            notFoundSource(),
          );
          changedFiles.push(notFoundPath);
          console.info(
            JSON.stringify({
              event: "init_invariant_repaired",
              projectId,
              path: notFoundPath,
              invariant: "root_route_not_found_component",
            }),
          );
        }
      }
      const routeLoadingBarPath = "src/components/layout/route-loading-bar.tsx";
      try {
        await this.deps.projectFileStore.readTextFile(
          projectId,
          routeLoadingBarPath,
        );
      } catch {
        await this.deps.projectFileStore.writeTextFile(
          projectId,
          routeLoadingBarPath,
          routeLoadingBarSource(),
        );
        changedFiles.push(routeLoadingBarPath);
        console.info(
          JSON.stringify({
            event: "init_invariant_repaired",
            projectId,
            path: routeLoadingBarPath,
            invariant: "root_route_loading_bar",
          }),
        );
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "init_invariant_repair_failed",
          projectId,
          path: rootPath,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : String(error).slice(0, 200),
        }),
      );
    }

    const suggestionsPath = "src/services/store/use-product-suggestions.ts";
    try {
      const suggestionsSource = await this.deps.projectFileStore.readTextFile(
        projectId,
        suggestionsPath,
      );
      if (
        suggestionsSource.includes("fetch(") ||
        !suggestionsSource.includes("@/services/http/client") ||
        !suggestionsSource.includes("apiClient.get<ProductSuggestionsList>")
      ) {
        await this.deps.projectFileStore.writeTextFile(
          projectId,
          suggestionsPath,
          productSuggestionsQuerySource(),
        );
        changedFiles.push(suggestionsPath);
        console.info(
          JSON.stringify({
            event: "init_invariant_repaired",
            projectId,
            path: suggestionsPath,
            invariant: "product_suggestions_uses_api_client",
          }),
        );
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "init_invariant_repair_failed",
          projectId,
          path: suggestionsPath,
          error:
            error instanceof Error
              ? error.message.slice(0, 200)
              : String(error).slice(0, 200),
        }),
      );
    }

    const siteHeaderPath = "src/components/layout/site-header.tsx";
    try {
      await this.deps.projectFileStore.readTextFile(projectId, siteHeaderPath);
    } catch {
      try {
        await this.deps.projectFileStore.writeTextFile(
          projectId,
          siteHeaderPath,
          siteHeaderShellSource(),
        );
        changedFiles.push(siteHeaderPath);
        console.info(
          JSON.stringify({
            event: "init_invariant_repaired",
            projectId,
            path: siteHeaderPath,
            invariant: "site_header_missing_shell",
          }),
        );
      } catch (error) {
        console.warn(
          JSON.stringify({
            event: "init_invariant_repair_failed",
            projectId,
            path: siteHeaderPath,
            error:
              error instanceof Error
                ? error.message.slice(0, 200)
                : String(error).slice(0, 200),
          }),
        );
      }
    }

    return changedFiles;
  }

  private async resolveSelectedStoreSlug(projectId: string, userId?: string) {
    return this.deps.selectedStoreSlugResolver?.(projectId, userId) ?? null;
  }

  private async validate(projectId: string, commands: string[]) {
    return (
      this.deps.validationService ?? new ValidationService()
    ).validateGeneratedProject(projectId, commands);
  }

  private async projectFileExists(projectId: string, relativePath: string) {
    if (!this.deps.projectFileStore) return false;
    try {
      await this.deps.projectFileStore.readTextFile(projectId, relativePath);
      return true;
    } catch {
      return false;
    }
  }

  private async *runInitAgenticLoopPass(args: {
    input: HandlePromptInput;
    runId: string;
    projectState: ProjectState;
    selectedStoreSlug: string | null;
    thinking: ThinkingResult;
    toolExecutionContext: ToolExecutionContext;
    registry: ReturnType<typeof createInitCodeToolRegistry>;
    userPrompt: string;
    preloadedTasteSkill?: PreloadedTasteSkill;
    pathsSatisfiedAtRunStart?: ReadonlySet<string>;
    signal?: AbortSignal;
  }): AsyncGenerator<AgentStreamEvent, AgenticLoopResult, unknown> {
    const eventQueue = new AsyncEventQueue<AgentStreamEvent>();
    const loopPromise = (async (): Promise<AgenticLoopResult> => {
      try {
        const generator = runAgenticLoop(
          {
            projectId: args.input.projectId,
            userId: args.input.userId,
            messageId: args.runId,
            runId: args.runId,
            userPrompt: args.userPrompt,
            projectState: args.projectState,
            selectedStoreSlug: args.selectedStoreSlug,
            thinkingResult: args.thinking,
            context: args.toolExecutionContext,
            preloadedTasteSkill: args.preloadedTasteSkill,
            registry: args.registry,
            requireStorefrontUiBeforeCompletion: true,
            pathsSatisfiedAtRunStart: args.pathsSatisfiedAtRunStart,
            requiredPathsBeforeCompletion: REQUIRED_INIT_COMMERCE_ROUTE_FILES,
            suppressAssistantStreaming: true,
            signal: args.signal,
          },
          {
            model: this.deps.agentConfig?.coderModel ?? "gpt-5.4",
            maxIterations: this.deps.agentConfig?.agenticMaxIterations ?? 40,
            maxConsecutiveToolErrors:
              this.deps.agentConfig?.agenticMaxConsecutiveToolErrors ?? 5,
            callModel: async (modelInput) => {
              const coderModel = this.deps.agentConfig?.coderModel ?? "gpt-5.4";
              const reasoningEffort = isReasoningModel(coderModel)
                ? selectReasoningEffort(args.thinking, { isInit: true })
                : undefined;
              return this.deps.openAIProvider!.streamCodeToolResponse({
                model: coderModel,
                input: modelInput.messages as unknown[],
                tools: modelInput.tools,
                toolChoice: "required",
                signal: args.signal,
                onTextDelta: modelInput.onTextDelta,
                reasoningEffort,
              });
            },
            executeTool: async (toolCall) => {
              return executeProjectTool({
                registry: args.registry,
                context: args.toolExecutionContext,
                toolCall,
                inspectionCompleted: true,
                mutationCompleted: false,
              });
            },
            sendEvent: (event) => {
              eventQueue.push(event as AgentStreamEvent);
            },
          },
        );
        let iterResult = await generator.next();
        while (!iterResult.done) {
          iterResult = await generator.next();
        }
        return iterResult.value;
      } finally {
        eventQueue.close();
      }
    })();

    for await (const event of eventQueue.drain()) {
      yield event;
    }
    return loopPromise;
  }

  /**
   * Run one agentic edit pass and yield its stream events, returning the loop result.
   * Extracted so anti-slop repair can re-run a pass with a corrective prompt.
   */
  private async *runAgenticEditPass(args: {
    userPrompt: string;
    projectId: string;
    userId?: string;
    runId: string;
    projectState: ProjectState;
    selectedStoreSlug: string | null;
    thinking: ThinkingResult;
    toolExecutionContext: ToolExecutionContext;
    registry: ReturnType<typeof createDefaultCodeToolRegistry>;
    preloadedTasteSkill?: PreloadedTasteSkill;
    signal?: AbortSignal;
  }): AsyncGenerator<AgentStreamEvent, AgenticLoopResult, unknown> {
    const eventQueue = new AsyncEventQueue<AgentStreamEvent>();
    const loopPromise = (async (): Promise<AgenticLoopResult> => {
      try {
        const generator = runAgenticLoop(
          {
            projectId: args.projectId,
            userId: args.userId,
            messageId: args.runId,
            runId: args.runId,
            userPrompt: args.userPrompt,
            projectState: args.projectState,
            selectedStoreSlug: args.selectedStoreSlug,
            thinkingResult: args.thinking,
            context: args.toolExecutionContext,
            registry: args.registry,
            preloadedTasteSkill: args.preloadedTasteSkill,
            signal: args.signal,
          },
          {
            model: this.deps.agentConfig?.coderModel ?? "gpt-5.4",
            maxIterations: this.deps.agentConfig?.agenticMaxIterations ?? 40,
            maxConsecutiveToolErrors:
              this.deps.agentConfig?.agenticMaxConsecutiveToolErrors ?? 5,
            callModel: async (modelInput) => {
              const coderModel = this.deps.agentConfig?.coderModel ?? "gpt-5.4";
              const reasoningEffort = isReasoningModel(coderModel)
                ? selectReasoningEffort(args.thinking)
                : undefined;
              return this.deps.openAIProvider!.streamCodeToolResponse({
                model: coderModel,
                input: modelInput.messages as unknown[],
                tools: modelInput.tools,
                toolChoice: "auto",
                signal: args.signal,
                onTextDelta: modelInput.onTextDelta,
                reasoningEffort,
              });
            },
            executeTool: async (toolCall) => {
              return executeProjectTool({
                registry: args.registry,
                context: args.toolExecutionContext,
                toolCall,
                inspectionCompleted: true,
                mutationCompleted: false,
              });
            },
            sendEvent: (event) => {
              eventQueue.push(event as AgentStreamEvent);
            },
          },
        );
        let iterResult = await generator.next();
        while (!iterResult.done) {
          iterResult = await generator.next();
        }
        return iterResult.value;
      } finally {
        eventQueue.close();
      }
    })();

    for await (const event of eventQueue.drain()) {
      yield event;
    }
    return loopPromise;
  }

  /**
   * Scan changed UI files for anti-slop violations. Cross-references DESIGN.md tokens so
   * legitimate brand colors are not flagged. Runs up to MAX_REPAIR_PASSES corrective
   * agentic passes; if violations remain, surfaces them to the user instead of looping.
   */
  private async *enforceAntiSlop(args: {
    loopResult: AgenticLoopResult;
    projectId: string;
    userId?: string;
    runId: string;
    projectState: ProjectState;
    selectedStoreSlug: string | null;
    thinking: ThinkingResult;
    toolExecutionContext: ToolExecutionContext;
    registry: ReturnType<typeof createDefaultCodeToolRegistry>;
    preloadedTasteSkill?: PreloadedTasteSkill;
    signal?: AbortSignal;
  }): AsyncGenerator<AgentStreamEvent, AgenticLoopResult, unknown> {
    const MAX_REPAIR_PASSES = 2;
    if (!this.deps.projectFileStore) return args.loopResult;

    let loopResult = args.loopResult;
    let designMarkdown: string | undefined;
    try {
      designMarkdown = await this.deps.projectFileStore.readTextFile(args.projectId, "DESIGN.md");
    } catch {
      designMarkdown = undefined;
    }

    for (let pass = 0; pass <= MAX_REPAIR_PASSES; pass += 1) {
      const uiFiles = loopResult.changedFiles.filter((path) => /\.(tsx|jsx|css)$/.test(path));
      const violations: Array<{ path: string; violation: AntiSlopViolation }> = [];
      for (const path of uiFiles) {
        let source: string;
        try {
          source = await this.deps.projectFileStore.readTextFile(args.projectId, path);
        } catch {
          continue;
        }
        const scan = scanForAntiSlop({ source, designMarkdown });
        for (const violation of scan.violations) {
          violations.push({ path, violation });
        }
      }

      if (violations.length === 0) return loopResult;

      // Out of repair passes — surface to the user and keep the code.
      if (pass === MAX_REPAIR_PASSES) {
        console.warn(
          JSON.stringify({
            event: "anti_slop_surfaced",
            projectId: args.projectId,
            runId: args.runId,
            count: violations.length,
            codes: violations.map((v) => v.violation.code),
            paths: violations.slice(0, 8).map((v) => v.path),
          }),
        );
        yield {
          type: "assistant_message_delta",
          delta:
            "\n\nA few design quality checks still need your review. Please open the preview and confirm the look matches what you want.\n",
        };
        return loopResult;
      }

      // Run a corrective pass with a focused prompt.
      const repairPrompt = buildAntiSlopRepairPrompt(violations);
      loopResult = yield* this.runAgenticEditPass({
        userPrompt: repairPrompt,
        projectId: args.projectId,
        userId: args.userId,
        runId: args.runId,
        projectState: args.projectState,
        selectedStoreSlug: args.selectedStoreSlug,
        thinking: args.thinking,
        toolExecutionContext: args.toolExecutionContext,
        registry: args.registry,
        preloadedTasteSkill: args.preloadedTasteSkill,
        signal: args.signal,
      });
    }

    return loopResult;
  }

  private async *streamUserFacingSummary(args: {
    fallbackSummary: string;
    input: HandlePromptInput;
    intent: BuilderIntent;
    plan: ChangePlan;
    changedFiles: string[];
    validation: ValidationResult;
  }): AsyncGenerator<AgentStreamEvent, string, unknown> {
    if (!this.deps.openAIProvider || !this.deps.agentConfig?.summaryModel) {
      yield { type: "assistant_message_delta", delta: args.fallbackSummary };
      return args.fallbackSummary;
    }

    let summary = "";
    try {
      for await (const event of this.deps.openAIProvider.streamText({
        model: this.deps.agentConfig.summaryModel,
        system: loadPromptDoc("templates/maintenance/post-run-summary.md"),
        input: {
          prompt: args.input.prompt,
          ok: args.validation.ok,
        },
      })) {
        if (event.type === "delta" && event.text) {
          // Redact-only per delta (keep boundary spaces); whitespace normalized once below.
          const delta = filterAssistantDeltaForUser(event.text);
          if (!delta) continue;
          summary += delta;
          yield { type: "assistant_message_delta", delta };
        }
      }
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "stream_user_facing_summary_failed_using_fallback",
          error:
            error instanceof Error
              ? error.message.slice(0, 400)
              : String(error).slice(0, 400),
        }),
      );
      const sanitizedSoFar = sanitizeForUser(summary);
      const remaining = sanitizedSoFar ? "" : args.fallbackSummary;
      if (remaining) {
        yield { type: "assistant_message_delta", delta: remaining };
        return remaining;
      }
      return sanitizedSoFar || args.fallbackSummary;
    }

    const finalSummary = sanitizeForUser(summary) || args.fallbackSummary;
    if (!summary.trim())
      yield { type: "assistant_message_delta", delta: finalSummary };
    return finalSummary;
  }
}

function builderIntentFromThinking(thinking: ThinkingResult): BuilderIntent {
  const intent = mapTaskTypeToBuilderIntent(
    thinking.downstreamTask.taskType,
    thinking.promptClassification.lifecycleIntent,
  );
  const clarification = thinking.downstreamTask.clarification;
  return {
    intent,
    confidence: thinking.promptClassification.confidence,
    userGoal: thinking.userFacingUnderstanding,
    normalizedRequirement: thinking.downstreamTask.normalizedGoal,
    ecommerceMeaning: {
      affectedPages: thinking.ecommerceInterpretation.affectedPages,
      affectedFeatures: thinking.ecommerceInterpretation.affectedFeatures,
      affectedDataModels: thinking.ecommerceInterpretation.affectedDataModels,
      businessImpact: thinking.ecommerceInterpretation.expectedBusinessImpact,
    },
    shouldAskClarifyingQuestion:
      Boolean(clarification?.required) ||
      thinking.riskAssessment.requiresUserConfirmation,
    clarificationQuestion: clarification?.question ?? null,
    riskLevel: thinking.riskAssessment.level,
  };
}

function mapTaskTypeToBuilderIntent(
  taskType: ThinkingResult["downstreamTask"]["taskType"],
  lifecycleIntent: ThinkingResult["promptClassification"]["lifecycleIntent"],
): BuilderIntent["intent"] {
  if (taskType === "init_storefront_project") return "init_project";
  if (taskType === "content_update") return "modify_content";
  if (taskType === "design_update") return "modify_design";
  if (taskType === "product_data_update") return "modify_products";
  if (taskType === "bug_fix") return "fix_bug";
  if (taskType === "answer_question") return "explain_project";
  if (lifecycleIntent === "update_project") return "add_feature";
  return lifecycleIntent;
}

const CORE_STOREFRONT_FILES = [
  "package.json",
  "src/router.tsx",
  "src/routes/__root.tsx",
  "src/routes/index.tsx",
] as const;

const REDESIGN_REWRITE_PROMPT = "templates/redesign/redesign-rewrite.md";
const TOKEN_PATCH_REWRITE_PROMPT = "templates/redesign/token-patch-rewrite.md";
const ANTI_SLOP_REPAIR_PROMPT = "templates/redesign/anti-slop-repair.md";

function shouldInitializeProject(
  projectState: ProjectState,
  intent: BuilderIntent,
) {
  return (
    intent.intent === "init_project" || !canApplyIncrementalUpdate(projectState)
  );
}

function canApplyIncrementalUpdate(projectState: ProjectState) {
  if (projectState.status !== "initialized") return false;
  const manifestPaths = new Set(
    projectState.fileManifest.map((file) => file.path),
  );
  return CORE_STOREFRONT_FILES.every((path) => manifestPaths.has(path));
}

function createInitPlan(intent: BuilderIntent): ChangePlan {
  return {
    summary:
      "Initialize storefront source from the selected ecommerce template.",
    changeType: "init_source",
    affectedFiles: [],
    operations: [
      { type: "create_file", reason: "Render storefront template files." },
      {
        type: "run_validation",
        reason: "Validate generated storefront source.",
      },
    ],
    acceptanceCriteria: [
      "Storefront source is generated in the project workspace.",
    ],
    validationCommands: [],
    riskLevel: intent.riskLevel,
    requiresUserConfirmation: false,
  };
}

function createClarificationPlan(intent: BuilderIntent): ChangePlan {
  return {
    summary: "Wait for user confirmation before applying high-risk changes.",
    changeType: "explain_only",
    affectedFiles: [],
    operations: [],
    acceptanceCriteria: ["High-risk changes are not auto-applied."],
    validationCommands: [],
    riskLevel: intent.riskLevel,
    requiresUserConfirmation: true,
  };
}

function getStorefrontExecutionMode(thinking: ThinkingResult) {
  return thinking.downstreamTask.storefront?.executionMode;
}

function createNonApplyPlan(
  thinking: ThinkingResult,
  mode: NonNullable<ReturnType<typeof getStorefrontExecutionMode>>,
): ChangePlan {
  return {
    summary: nonApplySummary(mode, thinking),
    changeType: "explain_only",
    affectedFiles: [],
    operations: [],
    acceptanceCriteria: thinking.downstreamTask.storefront?.acceptanceCriteria
      .length
      ? thinking.downstreamTask.storefront.acceptanceCriteria
      : ["No project files are mutated for explicit non-apply requests."],
    validationCommands: [],
    riskLevel: thinking.riskAssessment.level,
    requiresUserConfirmation: false,
  };
}

function nonApplySummary(
  mode: NonNullable<ReturnType<typeof getStorefrontExecutionMode>>,
  _thinking: ThinkingResult,
) {
  if (mode === "plan") return "Here is the plan for your request.";
  if (mode === "review") return "Here is the review for your request.";
  return "Here is the explanation for your request.";
}

function mergeManifest(
  projectState: ProjectState,
  operations: FileOperation[],
) {
  const now = new Date().toISOString();
  const manifest = new Map(
    projectState.fileManifest.map((entry) => [entry.path, entry]),
  );
  for (const operation of operations) {
    if (operation.type === "delete_file") {
      manifest.delete(operation.path);
      continue;
    }
    manifest.set(operation.path, {
      path: operation.path,
      kind: inferManifestKind(operation.path),
      purpose: inferManifestPurpose(operation.path),
      symbols: inferSymbols(operation.content),
      lastModifiedByAgentAt: now,
    });
  }
  return [...manifest.values()];
}

function inferManifestKind(
  path: string,
): ProjectState["fileManifest"][number]["kind"] {
  if (path.includes("/routes/") || path === "src/router.tsx") return "route";
  if (path.includes("/components/")) return "component";
  if (path.includes("/data/")) return "data";
  if (path.includes("/lib/")) return "other";
  if (path.includes("styles") || path.endsWith(".css")) return "style";
  if (path.endsWith("config.ts") || path.includes("config")) return "config";
  return "other";
}

function inferManifestPurpose(path: string) {
  if (path.includes("product-filter"))
    return "Product filtering controls and logic.";
  if (path.includes("product-grid")) return "Product discovery grid.";
  if (path.includes("products"))
    return "Product data and product listing experience.";
  return "Incrementally updated storefront source file.";
}

function inferSymbols(content: string) {
  return [
    ...content.matchAll(
      /(?:export\s+)?(?:function|const|class)\s+([A-Za-z0-9_]+)/g,
    ),
  ].map((match) => match[1]);
}

function createLoopPlan(result: AgenticLoopResult): ChangePlan {
  return {
    summary: result.summary,
    changeType: "modify_files",
    affectedFiles: result.changedFiles,
    operations: result.changedFiles.map((path) => ({
      type: "create_file" as const,
      path,
      reason: "Applied by agentic loop",
    })),
    acceptanceCriteria: ["Changes applied and validated"],
    validationCommands: [],
    riskLevel: "low",
    requiresUserConfirmation: false,
  };
}

function logAgentPhase(
  status: "started" | "finished" | "failed",
  phase: string,
  context: { runId: string; projectId: string; messageId?: string },
  error?: unknown,
) {
  const payload = {
    event: `agent_phase_${status}`,
    phase,
    runId: context.runId,
    projectId: context.projectId,
    messageId: context.messageId,
    ...(error
      ? {
          error: redactSecrets(
            error instanceof Error
              ? error.message
              : "Unknown agent phase error.",
          ),
          stack: redactSecrets(
            error instanceof Error && error.stack ? error.stack : "",
          ),
        }
      : {}),
  };
  if (status === "failed") {
    console.error(JSON.stringify(payload));
    return;
  }
  console.info(JSON.stringify(payload));
}

function buildStorefrontCompliancePrompt(
  designHash: string,
  scope: "full-storefront" | "changed-files",
): string {
  const scopeNote =
    scope === "full-storefront"
      ? "Validate the FULL customer-facing storefront against current DESIGN.md."
      : "Validate only changed customer-facing UI files against current DESIGN.md.";

  return [
    "Storefront Design Compliance Check",
    `DESIGN.md hash: ${designHash}`,
    `Validation scope: ${scope}`,
    "",
    scopeNote,
    "",
    "Rules:",
    "1. No raw color values (hex, rgb, hsl, oklch) in storefront UI files.",
    "2. No palette utilities outside approved token utility set.",
    "3. No inline styles for color, background, border-radius, shadow, or font-family.",
    "4. No raw font family strings.",
    "5. No raw shadow values.",
    "6. Use approved semantic token utilities derived from project DESIGN.md.",
    "",
    "If violations are found, replace raw values with mapped token utilities from DESIGN.md.",
    "Call project_read_design_rules to load current design rules before patching.",
  ].join("\n");
}

function buildTokenPatchRewritePrompt(
  originalPrompt: string,
  appliedRoles: ReadonlyArray<string>,
): string {
  return renderPromptDoc(TOKEN_PATCH_REWRITE_PROMPT, {
    originalPrompt,
    appliedRoles: appliedRoles.join(", "),
  });
}

function buildRedesignRewritePrompt(
  originalPrompt: string,
  tokenHints?: ReadonlyArray<{ role: string; value: string }>,
): string {
  const tokenHintBlock =
    tokenHints && tokenHints.length > 0
      ? [
          "\n\nUser-specified token values honored in the new DESIGN.md:",
          ...tokenHints.map((h) => `   - ${h.role}: ${h.value}`),
        ].join("\n")
      : "";
  return renderPromptDoc(REDESIGN_REWRITE_PROMPT, {
    originalPrompt,
    tokenHints: tokenHintBlock,
  });
}

function buildAntiSlopRepairPrompt(
  violations: ReadonlyArray<{ path: string; violation: AntiSlopViolation }>,
): string {
  const byPath = new Map<string, AntiSlopViolation[]>();
  for (const { path, violation } of violations) {
    const list = byPath.get(path) ?? [];
    list.push(violation);
    byPath.set(path, list);
  }
  const fileLines = Array.from(byPath.entries()).flatMap(([path, list]) => [
    `   - ${path}:`,
    ...list.map((v) => `     - ${v.message} (matched: ${v.sample})`),
  ]);
  return renderPromptDoc(ANTI_SLOP_REPAIR_PROMPT, {
    violations: fileLines.join("\n"),
  });
}

