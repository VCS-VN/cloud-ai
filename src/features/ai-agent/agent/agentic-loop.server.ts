import type { AgenticLoopInput, AgenticLoopDeps, AgenticLoopResult, ConversationMessage } from "./agentic-loop.types";
import type { ProviderFunctionToolCall, ProjectToolResult } from "../code-tools/code-agent-types";
import { buildToolCallRequestedEvent, buildToolCallCompletedEvent } from "../code-tools/code-tool-events.server";
import { CODE_TOOL_LIMITS } from "../code-tools/code-tool-registry.server";
import { buildAgenticSystemPrompt, buildUserMessageWithThinking } from "./agentic-prompts.server";
import { buildPreloadedTasteSkillDeveloperMessage } from "../code-tools/services/taste-skill-preload.server";
import {
  buildFriendlyToolActivitySummary,
  buildFriendlyToolCompletedSummary,
  filterAssistantDeltaForUser,
} from "./user-facing-presenter";
import { createDefaultCodeToolRegistry } from "../code-tools/code-tool-registry.server";
import {
  collectPresentInitPaths,
  initCommerceRoutesStillMissing,
  loopProducedInitUiFiles,
  missingRequiredInitPaths,
} from "../source/init-backfill-policy.server";
import { REQUIRED_INIT_COMMERCE_ROUTE_FILES } from "../source/generated-project-layout";
import {
  assessInitStorefrontCompletion,
  buildInitCompletionBlockedMessage,
} from "../source/init-completion-gate.server";
import { compactConversation, estimateTokenCount } from "./context-compaction";
import { withRetry } from "./retry";
import { classifyError, describeError } from "./error-classifier";
import { withToolRetry } from "../code-tools/retry/tool-retry.server";

const AUTO_COMPACT_TOKEN_LIMIT = 150_000;

function logAgenticLoop(event: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({ event: `agentic_loop_${event}`, ...data }));
}

export async function* runAgenticLoop(
  input: AgenticLoopInput,
  deps: AgenticLoopDeps,
): AsyncGenerator<unknown, AgenticLoopResult> {
  const registry = input.registry ?? createDefaultCodeToolRegistry();
  const tools = registry.list();
  const messages = buildInitialMessages(input);
  const changedFiles = new Set<string>();
  let totalToolCalls = 0;
  let consecutiveErrors = 0;
  let consecutiveTextOnlyTurns = 0;
  let mutationToolSucceeded = false;
  const MAX_TEXT_ONLY_TURNS = 3;
  const TEXT_ONLY_COMPLETION_THRESHOLD = 2;

  const maxIterations = deps.maxIterations ?? CODE_TOOL_LIMITS.maxToolLoopIterations;
  const maxConsecutiveErrors = deps.maxConsecutiveToolErrors ?? 5;

  logAgenticLoop("started", {
    projectId: input.projectId,
    maxIterations,
    toolCount: tools.length,
    toolNames: tools.map((t) => t.name),
  });

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    if (input.signal?.aborted) {
      logAgenticLoop("aborted", { projectId: input.projectId, iteration, totalToolCalls });
      return {
        status: "aborted",
        summary: "Loop aborted by signal.",
        changedFiles: [...changedFiles],
        iterations: iteration - 1,
        totalToolCalls,
      };
    }

    if (totalToolCalls > 0) {
      const tokenCount = estimateTokenCount(messages);
      if (tokenCount >= AUTO_COMPACT_TOKEN_LIMIT) {
        try {
          const compacted = await compactConversation(messages, async (msgs) => {
            const result = await deps.callModel({ messages: msgs, tools: [] });
            return result.outputText;
          });
          messages.length = 0;
          messages.push(...compacted);
          logAgenticLoop("compacted", { projectId: input.projectId, iteration });
        } catch {
          // Continue without compaction
        }
      }
    }

    logAgenticLoop("calling_model", {
      projectId: input.projectId,
      iteration,
      totalToolCalls,
      messageCount: messages.length,
    });

    let modelResult;
    let streamedTextLength = 0;
    try {
      modelResult = await withRetry(
        () =>
          deps.callModel({
            messages,
            tools,
            onTextDelta: async (delta) => {
              if (!delta || input.suppressAssistantStreaming) return;
              const userDelta = filterAssistantDeltaForUser(delta);
              if (!userDelta) return;
              streamedTextLength += userDelta.length;
              await deps.sendEvent({
                type: "assistant_message_delta",
                projectId: input.projectId,
                messageId: input.messageId ?? input.runId,
                delta: userDelta,
              });
            },
          }),
        {
          signal: input.signal,
          onAttempt: ({ attempt, cls, delayMs }) => {
            logAgenticLoop("model_call_retry", {
              projectId: input.projectId,
              iteration,
              attempt,
              errorClass: describeError(cls),
              delayMs,
            });
          },
        },
      );
    } catch (err) {
      const cls = classifyError(err);
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logAgenticLoop("model_call_failed", {
        projectId: input.projectId,
        iteration,
        error: errorMsg,
        errorClass: describeError(cls),
      });
      const status: AgenticLoopResult["status"] = cls.kind === "user_aborted" ? "aborted" : "failed";
      return {
        status,
        summary: `Model call failed (${describeError(cls)}): ${errorMsg}`,
        changedFiles: [...changedFiles],
        iterations: iteration,
        totalToolCalls,
      };
    }

    const hasToolCalls = modelResult.toolCalls.length > 0;
    const hasText = Boolean(modelResult.outputText);

    logAgenticLoop("model_responded", {
      projectId: input.projectId,
      iteration,
      hasText,
      hasToolCalls,
      toolCallCount: modelResult.toolCalls.length,
      toolCallNames: modelResult.toolCalls.map((tc) => tc.name),
      textLength: modelResult.outputText?.length ?? 0,
      textPreview: modelResult.outputText?.substring(0, 200) ?? "",
    });

    if (hasText && streamedTextLength === 0 && !input.suppressAssistantStreaming) {
      const userDelta = filterAssistantDeltaForUser(modelResult.outputText);
      if (userDelta) {
        await deps.sendEvent({
          type: "assistant_message_delta",
          projectId: input.projectId,
          messageId: input.messageId ?? input.runId,
          delta: userDelta,
        });
      }
    }

    if (hasToolCalls) {
      consecutiveTextOnlyTurns = 0;

      if (hasText) {
        messages.push({
          role: "assistant",
          content: modelResult.outputText,
        });
      }

      for (const toolCall of modelResult.toolCalls) {
        messages.push({
          type: "function_call",
          call_id: toolCall.callId,
          name: toolCall.name,
          arguments: typeof toolCall.arguments === "string"
            ? toolCall.arguments
            : JSON.stringify(toolCall.arguments),
        });
      }

      for (const toolCall of modelResult.toolCalls) {
        const toolDef = registry.get(toolCall.name);

        logAgenticLoop("executing_tool", {
          projectId: input.projectId,
          iteration,
          toolName: toolCall.name,
          category: toolDef?.category ?? "unknown",
        });

        await deps.sendEvent(
          buildToolCallRequestedEvent({
            projectId: input.projectId,
            messageId: input.messageId ?? input.runId,
            toolName: toolCall.name,
            category: toolDef?.category ?? "inspect",
            safeSummary: buildFriendlyToolActivitySummary(
              toolCall.name,
              toolDef?.category ?? "inspect",
            ),
          }),
        );

        const toolStartedAt = Date.now();
        await deps.sendEvent({
          type: "tool_progress",
          projectId: input.projectId,
          messageId: input.messageId ?? input.runId,
          toolName: toolCall.name,
          status: "running",
          startedAt: new Date(toolStartedAt).toISOString(),
        });

        let result: ProjectToolResult;
        try {
          result = await withToolRetry({
            toolCall,
            signal: input.signal,
            execute: async () => deps.executeTool(toolCall),
            onRetry: async ({ attempt, delayMs, errorCode, errorMessage }) => {
              logAgenticLoop("tool_retry", {
                projectId: input.projectId,
                iteration,
                toolName: toolCall.name,
                attempt,
                delayMs,
                errorCode,
                errorMessage,
              });
              await deps.sendEvent({
                type: "tool_progress",
                projectId: input.projectId,
                messageId: input.messageId ?? input.runId,
                toolName: toolCall.name,
                status: "running",
                durationMs: Date.now() - toolStartedAt,
                error: `Retrying after ${errorCode}: ${errorMessage}`,
              });
            },
          });
        } catch (err) {
          result = {
            ok: false,
            error: {
              code: "TOOL_EXECUTION_FAILED",
              message: err instanceof Error ? err.message : "Tool execution failed",
              recoverable: true,
            },
            metadata: {
              toolName: toolCall.name,
              category: "inspect",
              projectId: input.projectId,
              messageId: input.messageId ?? input.runId,
              durationMs: 0,
            },
          };
        }

        if (toolCall.name === "project_run_validation" && result.ok && result.data && typeof result.data === "object") {
          const data = result.data as any;
          for (const command of Array.isArray(data.commands) ? data.commands : []) {
            const stdout = typeof command.stdoutSummary === "string" ? command.stdoutSummary : "";
            const stderr = typeof command.stderrSummary === "string" ? command.stderrSummary : "";
            for (const line of [stdout, stderr].filter(Boolean)) {
              await deps.sendEvent({
                type: "tool_stdout",
                projectId: input.projectId,
                messageId: input.messageId ?? input.runId,
                toolName: toolCall.name,
                line,
              });
            }
          }
        }

        await deps.sendEvent({
          type: "tool_progress",
          projectId: input.projectId,
          messageId: input.messageId ?? input.runId,
          toolName: toolCall.name,
          status: result.ok ? "completed" : "failed",
          durationMs: Date.now() - toolStartedAt,
          error: result.ok ? undefined : result.error?.message,
        });

        totalToolCalls++;

        logAgenticLoop("tool_completed", {
          projectId: input.projectId,
          iteration,
          toolName: toolCall.name,
          ok: result.ok,
          errorCode: result.error?.code,
          errorMessage: result.error?.message,
        });

        await deps.sendEvent(
          buildToolCallCompletedEvent({
            projectId: input.projectId,
            messageId: input.messageId ?? input.runId,
            toolName: toolCall.name,
            ok: result.ok,
            summary: buildFriendlyToolCompletedSummary(
              toolCall.name,
              toolDef?.category ?? "inspect",
              result.ok,
            ),
            recoverable: result.error?.recoverable ?? true,
          }),
        );

        if (result.ok) {
          consecutiveErrors = 0;
          if (toolDef?.category === "mutate" && resultHasActualFileMutation(result)) {
            mutationToolSucceeded = true;
          }
          trackChangedFiles(toolCall, result, changedFiles, toolDef?.category);
        } else {
          consecutiveErrors++;
          if (consecutiveErrors >= maxConsecutiveErrors) {
            logAgenticLoop("too_many_errors", {
              projectId: input.projectId,
              iteration,
              consecutiveErrors,
              totalToolCalls,
            });
            return {
              status: "failed",
              summary: `Too many consecutive tool errors (${consecutiveErrors}).`,
              changedFiles: [...changedFiles],
              iterations: iteration,
              totalToolCalls,
            };
          }
        }

        messages.push({
          type: "function_call_output",
          call_id: toolCall.callId,
          output: JSON.stringify(result),
        });
      }
    } else {
      consecutiveTextOnlyTurns++;

      logAgenticLoop("text_only_turn", {
        projectId: input.projectId,
        iteration,
        consecutiveTextOnlyTurns,
        totalToolCalls,
      });

      if (totalToolCalls > 0 && consecutiveTextOnlyTurns >= TEXT_ONLY_COMPLETION_THRESHOLD) {
        if (input.requireMutationBeforeCompletion === true && !mutationToolSucceeded) {
          logAgenticLoop("blocked_text_only_completion_missing_mutation", {
            projectId: input.projectId,
            iteration,
            totalToolCalls,
          });
          consecutiveTextOnlyTurns = 0;
          messages.push({
            role: "developer",
            content:
              input.mutationCompletionHint ??
              "This storefront request requires a code mutation, but no project files have been changed yet. Inspect the current source, then use edit or write to update the relevant route/component files. Do not finish with text-only replies until at least one project file is changed.",
          });
          if (hasText) {
            messages.push({
              role: "assistant",
              content: modelResult.outputText,
            });
          }
          continue;
        }

        const presentPaths = collectPresentInitPaths(
          input.pathsSatisfiedAtRunStart ?? new Set(),
          [...changedFiles],
        );
        const requiredBeforeCompletion =
          input.requiredPathsBeforeCompletion ?? REQUIRED_INIT_COMMERCE_ROUTE_FILES;
        const missingRequired = missingRequiredInitPaths(
          requiredBeforeCompletion,
          presentPaths,
        );
        const initCompletionAssessment =
          input.requireStorefrontUiBeforeCompletion === true
            ? await assessInitStorefrontCompletion({
                workspaceRoot: input.context.workspaceRoot,
                presentPaths,
              })
            : { ok: true, blockers: [] as string[] };
        const pendingStorefrontUi =
          input.requireStorefrontUiBeforeCompletion === true &&
          (!loopProducedInitUiFiles([...changedFiles]) ||
            missingRequired.length > 0 ||
            initCommerceRoutesStillMissing(presentPaths) ||
            !initCompletionAssessment.ok);
        if (pendingStorefrontUi) {
          logAgenticLoop("blocked_text_only_completion_pending_ui", {
            projectId: input.projectId,
            iteration,
            totalToolCalls,
            missingRequired: missingRequired.slice(0, 12),
            initBlockers: initCompletionAssessment.blockers.slice(0, 8),
          });
          consecutiveTextOnlyTurns = 0;
          const missingList =
            missingRequired.length > 0
              ? missingRequired.join(", ")
              : REQUIRED_INIT_COMMERCE_ROUTE_FILES.join(", ");
          const completionMessage = !initCompletionAssessment.ok
            ? buildInitCompletionBlockedMessage(initCompletionAssessment.blockers)
            : `Init is incomplete. Required commerce routes and storefront files are still missing: ${missingList}. Use write or project_create_file to create them (or edit pre-seeded routes to match DESIGN.md). Do not finish with text-only replies until home (/), products, product detail, cart, checkout, orders, and order detail routes all exist.`;
          messages.push({
            role: "developer",
            content: completionMessage,
          });
          if (hasText) {
            messages.push({
              role: "assistant",
              content: modelResult.outputText,
            });
          }
          continue;
        }
        return {
          status: "completed",
          summary: modelResult.outputText || "Agent completed.",
          changedFiles: [...changedFiles],
          iterations: iteration,
          totalToolCalls,
        };
      }

      if (totalToolCalls === 0 && consecutiveTextOnlyTurns >= MAX_TEXT_ONLY_TURNS) {
        logAgenticLoop("max_text_only_turns", {
          projectId: input.projectId,
          iteration,
          consecutiveTextOnlyTurns,
        });
        return {
          status: "failed",
          summary: `Agent produced ${consecutiveTextOnlyTurns} text responses without calling any tools. Unable to proceed.`,
          changedFiles: [...changedFiles],
          iterations: iteration,
          totalToolCalls,
        };
      }

      if (hasText) {
        messages.push({
          role: "assistant",
          content: modelResult.outputText,
        });
      }
    }
  }

  logAgenticLoop("max_iterations", { projectId: input.projectId, totalToolCalls });
  return {
    status: "max_iterations",
    summary: `Reached max iterations (${maxIterations}).`,
    changedFiles: [...changedFiles],
    iterations: maxIterations,
    totalToolCalls,
  };
}

function buildInitialMessages(input: AgenticLoopInput): ConversationMessage[] {
  const messages: ConversationMessage[] = [
    { role: "developer", content: buildAgenticSystemPrompt(input) },
  ];
  if (input.preloadedTasteSkill) {
    messages.push({
      role: "developer",
      content: buildPreloadedTasteSkillDeveloperMessage(input.preloadedTasteSkill),
    });
  }
  messages.push({ role: "user", content: buildUserMessageWithThinking(input) });
  return messages;
}

function trackChangedFiles(
  toolCall: ProviderFunctionToolCall,
  result: ProjectToolResult,
  changedFiles: Set<string>,
  toolCategory?: string,
) {
  if (!result.ok || !result.data) return;
  const data = result.data as Record<string, unknown>;
  if (Array.isArray(data.changedFiles)) {
    for (const f of data.changedFiles) {
      if (typeof f === "string") changedFiles.add(f);
    }
  }
  // Inspect tools (e.g. project_read_design_rules) return `path` without mutating — do not count.
  if (toolCategory === "mutate" && typeof data.path === "string") {
    changedFiles.add(data.path);
  }
}

function resultHasActualFileMutation(result: ProjectToolResult) {
  if (!result.ok || !result.data || typeof result.data !== "object") return false;
  const data = result.data as Record<string, unknown>;
  const changedFiles = Array.isArray(data.changedFiles)
    ? data.changedFiles.filter((file): file is string => typeof file === "string")
    : [];
  if (changedFiles.length === 0 && typeof data.path !== "string") return false;

  const insertions = typeof data.insertions === "number" ? data.insertions : 0;
  const deletions = typeof data.deletions === "number" ? data.deletions : 0;
  const createdFiles = Array.isArray(data.createdFiles) ? data.createdFiles.length : 0;
  const modifiedFiles = Array.isArray(data.modifiedFiles) ? data.modifiedFiles.length : 0;
  const deletedFiles = Array.isArray(data.deletedFiles) ? data.deletedFiles.length : 0;

  return insertions > 0 || deletions > 0 || createdFiles > 0 || modifiedFiles > 0 || deletedFiles > 0;
}
