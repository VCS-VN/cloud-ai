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
import type { OpenAIProvider } from "../openai/openai-provider.server";
import type { RuntimeService } from "../runtime/runtime-service.server";
import type { RuntimeOrchestrator } from "../runtime/runtime-orchestrator.server";
import { sanitizeForUser } from "./user-facing-presenter";
import { extractWebsiteSpec } from "../planning/extract-website-spec.server";
import { buildFileManifest } from "../source/code-index-service.server";
import { hasSiteHeaderSearchSuggestionContract, initInfrastructureSource, initSource, productSuggestionsQuerySource, renderEnvSource, siteHeaderSource } from "../source/init-source.server";
import { REQUIRED_GENERATED_STOREFRONT_FILES } from "../source/generated-project-layout";
import { applyStoreSlugToEnv } from "../store-runtime/generated-project-env";
import { buildRetailInitPrompt } from "./init-prompt.server";
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
import type { AgenticLoopResult } from "./agentic-loop.types";
import { AsyncEventQueue } from "./async-event-queue";
import { isReasoningModel, selectReasoningEffort } from "./reasoning-effort";
import { executeProjectTool } from "../code-tools/code-tool-executor.server";
import { createDefaultCodeToolRegistry, createInitCodeToolRegistry } from "../code-tools/code-tool-registry.server";
import type { ToolExecutionContext } from "../code-tools/code-agent-types";
import {
  generateAndWriteDesignFile,
  loadProjectDesignRules,
} from "../code-tools/services/design-file-service.server";
import {
  extractUserProvenanceTokens,
  doesPromptConflictWithUserToken,
} from "../code-tools/services/design-generation-service.server";
import { buildCssVariableMapping, replaceOwnedDesignTokenRegion } from "../code-tools/services/design-token-mapping-service.server";
import {
  classifyDesignIntent,
  extractTokenHints,
  type DesignIntentLabel,
} from "../planning/design-intent-heuristic";
import { applyTokenPatches } from "../code-tools/services/design-rule-patch-service.server";
import { getProjectWorkspaceRoot } from "@/server/config/paths.server";
import {
  runProjectDesignComplianceValidation,
  resolveDesignComplianceScope,
} from "../code-tools/services/project-validation-service.server";

export type HandlePromptInput = {
  projectId: string;
  userId?: string;
  prompt: string;
  messageId?: string;
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
  openAIProvider?: OpenAIProvider;
  agentConfig?: AgentConfig;
  runtimeService?: RuntimeService;
  runtimeOrchestrator?: RuntimeOrchestrator;
  selectedStoreSlugResolver?: (projectId: string, userId?: string) => Promise<string | null>;
};

export class AgentOrchestrator {
  constructor(private readonly deps: AgentOrchestratorDeps) {}

  async *handlePromptStream(
    input: HandlePromptInput,
  ): AsyncGenerator<AgentStreamEvent> {
    const run = await this.deps.runStore.create({
      projectId: input.projectId,
      userId: input.userId,
      messageId: input.messageId,
      parentMessageId: input.parentMessageId,
      userPrompt: input.prompt,
      status: "running",
    });

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
                ? designIntent.tokenHints?.length ?? 0
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
          messageId: input.messageId ?? run.id,
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
              templateId: projectState.designState?.templateId ?? "ai-generated",
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
        yield { type: "project_state_updated", projectState: activeProjectState };
      } else if (
        designIntent.kind === "redesign" &&
        projectState.status === "initialized"
      ) {
        // Extract existing user-provenance tokens that should be preserved
        // unless the current redesign prompt explicitly conflicts with them.
        const existingDesign = await loadProjectDesignRules({
          projectId: input.projectId,
          workspaceRoot: getProjectWorkspaceRoot(input.projectId),
        }).catch(() => null);
        const userTokens = existingDesign
          ? extractUserProvenanceTokens(existingDesign.markdown)
          : [];
        const preservedTokens = userTokens.filter(
          (t) => !doesPromptConflictWithUserToken(input.prompt, t),
        );
        if (preservedTokens.length > 0) {
          console.info(
            JSON.stringify({
              event: "redesign_preserving_user_tokens",
              count: preservedTokens.length,
              roles: preservedTokens.map((t) => t.role),
            }),
          );
        }

        const redesignWebsiteSpec = await extractWebsiteSpec({
          prompt: input.prompt,
          projectState,
          provider: this.deps.openAIProvider,
          model: this.deps.agentConfig?.plannerModel,
        });
        const redesignResult = await generateAndWriteDesignFile({
          projectId: input.projectId,
          workspaceRoot: getProjectWorkspaceRoot(input.projectId),
          websiteSpec: redesignWebsiteSpec,
          userPrompt: input.prompt,
          provider: this.deps.openAIProvider,
          model: this.deps.agentConfig?.plannerModel,
          signal: input.signal,
          tokenHints: designIntent.tokenHints,
        });
        yield {
          type: "design_file_regenerated",
          projectId: input.projectId,
          messageId: input.messageId ?? run.id,
          data: {
            source: redesignResult.source,
            destinationPath: redesignResult.destinationPath,
            byteSize: redesignResult.byteSize,
          },
        };
        activeProjectState = await this.deps.projectStateStore.patch(
          input.projectId,
          {
            brand: redesignWebsiteSpec.brand,
            designState: {
              templateId: "ai-generated",
              designSourcePath: "DESIGN.md",
              designSourceHash: redesignResult.hash,
              designCopiedAt: new Date().toISOString(),
            },
          },
          input.userId,
        );
        redesignedHash = redesignResult.hash;
        effectiveUserPrompt = buildRedesignRewritePrompt(
          input.prompt,
          designIntent.tokenHints,
        );
        yield { type: "project_state_updated", projectState: activeProjectState };
      }

      const toolExecutionContext: ToolExecutionContext = {
        userId: input.userId ?? "",
        projectId: input.projectId,
        messageId: input.messageId ?? run.id,
        workspaceRoot: getProjectWorkspaceRoot(input.projectId),
        projectState: activeProjectState,
      };
      (toolExecutionContext as unknown as { __codeToolSnapshotId: string }).__codeToolSnapshotId = `update-${run.id}`;

      const registry = createDefaultCodeToolRegistry();

      const eventQueue = new AsyncEventQueue<AgentStreamEvent>();
      const loopPromise = (async (): Promise<AgenticLoopResult> => {
        try {
          const generator = runAgenticLoop(
            {
              projectId: input.projectId,
              userId: input.userId,
              messageId: input.messageId,
              runId: run.id,
              userPrompt: effectiveUserPrompt,
              projectState: activeProjectState,
              selectedStoreSlug,
              thinkingResult: thinking,
              context: toolExecutionContext,
              signal: input.signal,
            },
            {
              model: this.deps.agentConfig?.coderModel ?? "gpt-5.4",
              maxIterations: this.deps.agentConfig?.agenticMaxIterations ?? 40,
              maxConsecutiveToolErrors:
                this.deps.agentConfig?.agenticMaxConsecutiveToolErrors ?? 5,
              callModel: async (modelInput) => {
                const coderModel = this.deps.agentConfig?.coderModel ?? "gpt-5.4";
                const reasoningEffort = isReasoningModel(coderModel)
                  ? selectReasoningEffort(thinking)
                  : undefined;
                return this.deps.openAIProvider!.streamCodeToolResponse({
                  model: coderModel,
                  input: modelInput.messages as unknown[],
                  tools: modelInput.tools,
                  toolChoice: "auto",
                  signal: input.signal,
                  onTextDelta: modelInput.onTextDelta,
                  reasoningEffort,
                });
              },
              executeTool: async (toolCall) => {
                return executeProjectTool({
                  registry,
                  context: toolExecutionContext,
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
      const loopResult = await loopPromise;

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
      messageId: input.messageId,
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
    const selectedStoreSlug = await this.resolveSelectedStoreSlug(input.projectId, input.userId);

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

    yield {
      type: "source_generation_started",
      message: "Copying design rules and generating infrastructure...",
    };

    const initTokenHints = extractTokenHints(input.prompt);
    const designResult = await runPhase("generate_design_file", () =>
      generateAndWriteDesignFile({
        projectId: input.projectId,
        workspaceRoot: getProjectWorkspaceRoot(input.projectId),
        websiteSpec,
        userPrompt: input.prompt,
        provider: this.deps.openAIProvider,
        model: this.deps.agentConfig?.plannerModel,
        signal: input.signal,
        tokenHints: initTokenHints,
      }),
    );
    yield {
      type: "design_file_generated",
      projectId: input.projectId,
      messageId: input.messageId ?? args.runId,
      data: {
        source: designResult.source,
        destinationPath: designResult.destinationPath,
        byteSize: designResult.byteSize,
      },
    };

    // Write .env with VITE_API_BASE_URL after DESIGN.md is created.
    // The AI Agent is NOT allowed to read or write .env; the app process owns it.
    await runPhase("write_project_env", () =>
      this.deps.projectFileStore?.writeManagedEnvFile(
        input.projectId,
        applyStoreSlugToEnv(renderEnvSource(), selectedStoreSlug),
      ),
    );
    yield { type: "file_changed", path: ".env", operation: "created" };

    const designRules = await runPhase("load_design_rules", () =>
      loadProjectDesignRules({
        projectId: input.projectId,
        workspaceRoot: getProjectWorkspaceRoot(input.projectId),
      }),
    );
    yield {
      type: "design_rules_loaded",
      projectId: input.projectId,
      messageId: input.messageId ?? args.runId,
      data: {
        source: designRules.path,
        summary: designRules.summary,
        hash: designRules.hash,
      },
    };

    const initResult = await runPhase("init_infrastructure", () =>
      initInfrastructureSource({
        projectSlug: slugifyProjectName(websiteSpec.store.name),
        packageManager: projectState.stack.packageManager,
        packageRegistryVersion: "initial-v1",
        templateId,
        websiteSpec,
      }),
    );

    const tokenMapping = buildCssVariableMapping(designRules.markdown);
    for (const file of initResult.files) {
      if (file.path !== "src/styles/app.css") continue;
      const mapped = replaceOwnedDesignTokenRegion(file.content, tokenMapping);
      if (!mapped.ok) {
        throw new Error(mapped.message);
      }
      file.content = mapped.content;
    }

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
      logAgentPhase("failed", "write_infrastructure_files", phaseContext, error);
      throw error;
    }

    yield {
      type: "source_generation_started",
      message: "Generating retail storefront UI with design rules...",
    };

    const toolExecutionContext: ToolExecutionContext = {
      userId: input.userId ?? "",
      projectId: input.projectId,
      messageId: input.messageId ?? args.runId,
      workspaceRoot: getProjectWorkspaceRoot(input.projectId),
      projectState,
      flags: {
        designRulesLoaded: true,
      },
    };
    (toolExecutionContext as any).__codeToolSnapshotId = "init-snapshot";

    const registry = createInitCodeToolRegistry();
    const retailInitPrompt = buildRetailInitPrompt({
      userPrompt: input.prompt,
      websiteSpec,
      designRules,
    });

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
          kind: f.kind as "route" | "component" | "data" | "config" | "style" | "server" | "state" | "unknown",
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

    console.info(JSON.stringify({
      event: "init_agentic_loop_starting",
      projectId: input.projectId,
      promptLength: retailInitPrompt.length,
      toolCount: registry.list().length,
      toolNames: registry.list().map((t) => t.name),
      model: this.deps.agentConfig?.coderModel ?? "gpt-5.4",
    }));

    const eventQueue = new AsyncEventQueue<AgentStreamEvent>();
    const loopPromise = (async (): Promise<AgenticLoopResult> => {
      try {
        const generator = runAgenticLoop(
          {
            projectId: input.projectId,
            userId: input.userId,
            messageId: input.messageId,
            runId: args.runId,
            userPrompt: retailInitPrompt,
            projectState,
            selectedStoreSlug,
            thinkingResult: thinking,
            context: toolExecutionContext,
            signal: input.signal,
          },
          {
            model: this.deps.agentConfig?.coderModel ?? "gpt-5.4",
            maxIterations: this.deps.agentConfig?.agenticMaxIterations ?? 40,
            maxConsecutiveToolErrors:
              this.deps.agentConfig?.agenticMaxConsecutiveToolErrors ?? 5,
            callModel: async (modelInput) => {
              const coderModel = this.deps.agentConfig?.coderModel ?? "gpt-5.4";
              const reasoningEffort = isReasoningModel(coderModel)
                ? selectReasoningEffort(thinking, { isInit: true })
                : undefined;
              return this.deps.openAIProvider!.streamCodeToolResponse({
                model: coderModel,
                input: modelInput.messages as unknown[],
                tools: modelInput.tools,
                toolChoice: "required",
                signal: input.signal,
                onTextDelta: modelInput.onTextDelta,
                reasoningEffort,
              });
            },
            executeTool: async (toolCall) => {
              return executeProjectTool({
                registry,
                context: toolExecutionContext,
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
    let loopResult = await loopPromise;

    console.info(JSON.stringify({
      event: "init_agentic_loop_completed",
      projectId: input.projectId,
      status: loopResult.status,
      totalToolCalls: loopResult.totalToolCalls,
      changedFileCount: loopResult.changedFiles.length,
      iterations: loopResult.iterations,
      summary: loopResult.summary?.substring(0, 200),
    }));

    const missingRequiredFiles = REQUIRED_GENERATED_STOREFRONT_FILES.filter(
      (requiredPath) => !initResult.files.some((file) => file.path === requiredPath)
        && !loopResult.changedFiles.includes(requiredPath),
    );

    if (loopResult.changedFiles.length === 0 || missingRequiredFiles.length > 0) {
      console.info(JSON.stringify({
        event: "init_backfill_required_files",
        projectId: input.projectId,
        reason: loopResult.changedFiles.length === 0
          ? "Agentic loop created 0 files, backfilling deterministic storefront baseline"
          : "Agentic loop missed required storefront files, backfilling deterministic baseline",
        missingRequiredFiles,
      }));

      yield {
        type: "source_generation_started",
        message: "Ensuring required storefront pages, components, and Store Provider exist...",
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
        ...initResult.files.map((file) => file.path),
        ...loopResult.changedFiles,
      ]);
      const backfilledFiles: string[] = [];

      logAgentPhase("started", "write_backfill_files", phaseContext);
      try {
        for (const file of fallbackResult.files) {
          if (existingChangedFiles.has(file.path)) continue;
          if (await this.projectFileExists(input.projectId, file.path)) continue;
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
        status: "completed",
        summary: `Created storefront using agentic loop plus deterministic baseline backfill. ${backfilledFiles.length} files backfilled.`,
        changedFiles: [...loopResult.changedFiles, ...backfilledFiles],
        iterations: 1,
        totalToolCalls: loopResult.totalToolCalls,
      };
    }

    const invariantFixes = await this.ensureGeneratedProjectInvariants(input.projectId);
    for (const path of invariantFixes) {
      yield { type: "file_changed", path, operation: "modified" };
    }

    const allChangedFiles = [
      ...initResult.files.map((f) => f.path),
      ...loopResult.changedFiles,
      ...invariantFixes,
    ];
    const uniqueChangedFiles = [...new Set(allChangedFiles)];
    const infraManifest = buildFileManifest(initResult.files);
    const uiManifest = buildFileManifest(
      loopResult.changedFiles.map((path) => ({ path, content: "" })),
    );
    const mergedManifest = [...infraManifest, ...uiManifest.filter((ui) => !infraManifest.some((infra) => infra.path === ui.path))];

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
            designSourceHash: designResult.hash,
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

    const workspaceRoot = getProjectWorkspaceRoot(input.projectId);
    if (this.deps.runtimeOrchestrator) {
      void this.deps.runtimeOrchestrator.scheduleEnsureRunning({
        projectId: input.projectId,
        workspaceRoot,
        userId: input.userId,
        signal: input.signal,
      }).catch((error) => {
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
      const rootSource = await this.deps.projectFileStore.readTextFile(projectId, rootPath);
      let nextRootSource = rootSource
        .replace(/^import\s+['\"]\.\.\/app\.css['\"];?\s*$/m, "")
        .replace(/^import\s+['\"]\.\/app\.css['\"];?\s*$/m, "")
        .replace(/^import\s+appCss\s+from\s+['\"]\.\.\/app\.css\?url['\"];?\s*$/m, "")
        .replace(/^import\s+appCss\s+from\s+['\"]@\/styles\/app\.css\?url['\"];?\s*$/m, "");

      if (!nextRootSource.includes("@vitejs/plugin-react/preamble")) {
        nextRootSource = `import '@vitejs/plugin-react/preamble'\n${nextRootSource}`;
      }
      if (!nextRootSource.includes("@/styles/app.css")) {
        const preambleImport = "import '@vitejs/plugin-react/preamble'";
        nextRootSource = nextRootSource.includes(preambleImport)
          ? nextRootSource.replace(preambleImport, `${preambleImport}\nimport '@/styles/app.css'`)
          : `import '@/styles/app.css'\n${nextRootSource}`;
      }
      nextRootSource = nextRootSource.replace(/\n{3,}/g, "\n\n");

      if (nextRootSource !== rootSource) {
        await this.deps.projectFileStore.writeTextFile(projectId, rootPath, nextRootSource);
        changedFiles.push(rootPath);
        console.info(JSON.stringify({
          event: "init_invariant_repaired",
          projectId,
          path: rootPath,
          invariant: "react_preamble_and_styles_alias",
        }));
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: "init_invariant_repair_failed",
        projectId,
        path: rootPath,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      }));
    }

    const suggestionsPath = "src/services/store/use-product-suggestions.ts";
    try {
      const suggestionsSource = await this.deps.projectFileStore.readTextFile(projectId, suggestionsPath);
      if (suggestionsSource.includes("fetch(") || !suggestionsSource.includes("@/services/http/client") || !suggestionsSource.includes("apiClient.get<ProductSuggestionsList>")) {
        await this.deps.projectFileStore.writeTextFile(projectId, suggestionsPath, productSuggestionsQuerySource());
        changedFiles.push(suggestionsPath);
        console.info(JSON.stringify({
          event: "init_invariant_repaired",
          projectId,
          path: suggestionsPath,
          invariant: "product_suggestions_uses_api_client",
        }));
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: "init_invariant_repair_failed",
        projectId,
        path: suggestionsPath,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      }));
    }

    const siteHeaderPath = "src/components/layout/site-header.tsx";
    try {
      const siteHeader = await this.deps.projectFileStore.readTextFile(projectId, siteHeaderPath);
      if (!hasSiteHeaderSearchSuggestionContract(siteHeader)) {
        await this.deps.projectFileStore.writeTextFile(projectId, siteHeaderPath, siteHeaderSource());
        changedFiles.push(siteHeaderPath);
        console.info(JSON.stringify({
          event: "init_invariant_repaired",
          projectId,
          path: siteHeaderPath,
          invariant: "site_header_search_suggestions_dropdown",
        }));
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: "init_invariant_repair_failed",
        projectId,
        path: siteHeaderPath,
        error: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
      }));
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
        system: `Write a 1-2 sentence user-facing confirmation in the SAME LANGUAGE as the user prompt. Refer to the storefront in product terms only ("your shop", "the homepage", "the products page"). NEVER mention: file paths, environment variable names, schema names, tool names, model names, internal status codes, or technical taxonomy. Do not echo this instruction.`,
        input: {
          prompt: args.input.prompt,
          ok: args.validation.ok,
        },
      })) {
        if (event.type === "delta" && event.text) {
          const sanitized = sanitizeForUser(event.text);
          if (!sanitized) continue;
          summary += sanitized;
          yield { type: "assistant_message_delta", delta: sanitized };
        }
      }
    } catch (error) {
      console.warn(JSON.stringify({
        event: "stream_user_facing_summary_failed_using_fallback",
        error: error instanceof Error ? error.message.slice(0, 400) : String(error).slice(0, 400),
      }));
      const remaining = summary.trim() ? "" : args.fallbackSummary;
      if (remaining) {
        yield { type: "assistant_message_delta", delta: remaining };
        return remaining;
      }
      return summary.trim() || args.fallbackSummary;
    }

    const finalSummary = summary.trim() || args.fallbackSummary;
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
  const scopeNote = scope === "full-storefront"
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
  return [
    "User token-level update request:",
    originalPrompt,
    "",
    `DESIGN.md has been patched in place for these roles only: ${appliedRoles.join(", ")}.`,
    "All other roles (vibe, typography, spacing, radius, shadow, components, layout, responsive) remain unchanged. The DESIGN.md hash has changed because token values changed.",
    "",
    "Task: update only the storefront UI surfaces that read the patched roles, so they reflect the new token values via tailwind config / CSS variables / token mapping.",
    "",
    "Validation scope: changed-files (only affected UI surfaces).",
    "Scope constraint: do NOT validate or modify unrelated storefront surfaces.",
    "",
    "1. Call project_read_design_rules to load the new DESIGN.md.",
    "2. Refresh token mapping in src/styles/app.css when patched roles map to CSS variables.",
    "3. Inspect existing UI files; identify references to the patched roles only.",
    "4. Apply minimal patches; do NOT regenerate unrelated styles or sections.",
    "5. Run project_run_validation after mutations; repair on failure.",
  ].join("\n");
}

function buildRedesignRewritePrompt(
  originalPrompt: string,
  tokenHints?: ReadonlyArray<{ role: string; value: string }>,
): string {
  const hintLines =
    tokenHints && tokenHints.length > 0
      ? [
          "",
          "User-specified token values honored in the new DESIGN.md:",
          ...tokenHints.map((h) => `   - ${h.role}: ${h.value}`),
        ]
      : [];
  return [
    "User redesign request:",
    originalPrompt,
    ...hintLines,
    "",
    "DESIGN.md has just been regenerated for this project with a new visual identity (palette, typography, components, layout). It is the source of truth.",
    "",
    "Task: rewrite the storefront UI to match the new DESIGN.md.",
    "",
    "Validation scope: full-storefront (all customer-facing UI must comply with new DESIGN.md).",
    "User-provenance tokens have been preserved unless the redesign prompt explicitly conflicted.",
    "Token mapping must be refreshed to match the new DESIGN.md hash.",
    "",
    "1. FIRST call project_read_design_rules to load the new DESIGN.md.",
    "2. Refresh token mapping: verify CSS variables / tailwind config match new token values.",
    "3. Inspect existing UI files with project_get_file_tree and project_read_file before patching.",
    "4. Update these files so they match sections 1-8 of DESIGN.md (palette, typography, spacing, radii, components, layout):",
    "   - tailwind.config.ts (theme colors, fonts, radii)",
    "   - src/styles/* (CSS variables / tokens, if present)",
    "   - src/components/layout/site-header.tsx",
    "   - src/components/layout/site-footer.tsx",
    "   - src/components/store/hero-section.tsx",
    "   - src/components/store/product-card.tsx",
    "   - src/components/store/product-grid.tsx (only className/styling)",
    "   - src/components/store/feature-band.tsx",
    "   - src/components/store/trust-signals.tsx",
    "   - src/components/store/newsletter-section.tsx",
    "   - src/components/ui/button.tsx, badge.tsx (variants/colors only)",
    "5. Out of scope (do NOT modify):",
    "   - src/routes/** route structure (only update className when strictly needed)",
    "   - src/data/** product/category data",
    "   - src/data/sample-store.ts",
    "   - src/app/cart-provider.tsx and any state management",
    "   - src/app/store-provider.tsx",
    "   - package.json dependencies",
    "6. Use minimal patches per file. Run project_run_validation after mutations. Repair on failure.",
    "7. Validate full storefront compliance with new DESIGN.md before completion.",
  ].join("\n");
}
