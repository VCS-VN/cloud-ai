import type { AgenticLoopInput, AgenticLoopDeps, AgenticLoopResult, ConversationMessage } from "./agentic-loop.types";
import type { ProviderFunctionToolCall, ProjectToolResult } from "../code-tools/code-agent-types";
import { buildToolCallRequestedEvent, buildToolCallCompletedEvent } from "../code-tools/code-tool-events.server";
import { CODE_TOOL_LIMITS } from "../code-tools/code-tool-registry.server";
import { buildAgenticSystemPrompt, buildUserMessageWithThinking } from "./agentic-prompts.server";
import { createDefaultCodeToolRegistry } from "../code-tools/code-tool-registry.server";
import { compactConversation, estimateTokenCount } from "./context-compaction";

const AUTO_COMPACT_TOKEN_LIMIT = 150_000;

function logAgenticLoop(event: string, data: Record<string, unknown>) {
  console.info(JSON.stringify({ event: `agentic_loop_${event}`, ...data }));
}

export async function* runAgenticLoop(
  input: AgenticLoopInput,
  deps: AgenticLoopDeps,
): AsyncGenerator<unknown, AgenticLoopResult> {
  const registry = createDefaultCodeToolRegistry();
  const tools = registry.list();
  const messages = buildInitialMessages(input);
  const changedFiles = new Set<string>();
  let totalToolCalls = 0;
  let consecutiveErrors = 0;
  let consecutiveTextOnlyTurns = 0;
  const MAX_TEXT_ONLY_TURNS = 3;

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
    try {
      modelResult = await deps.callModel({ messages, tools });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      logAgenticLoop("model_call_failed", { projectId: input.projectId, iteration, error: errorMsg });
      return {
        status: "failed",
        summary: `Model call failed: ${errorMsg}`,
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

    if (hasText) {
      await deps.sendEvent({
        type: "assistant_message_delta",
        projectId: input.projectId,
        messageId: input.messageId ?? input.runId,
        delta: modelResult.outputText,
      });
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
            safeSummary: `Executing ${toolCall.name}`,
          }),
        );

        let result: ProjectToolResult;
        try {
          result = await deps.executeTool(toolCall);
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
            summary: result.ok
              ? `Tool ${toolCall.name} succeeded`
              : result.error?.message ?? "Tool failed",
            recoverable: result.error?.recoverable ?? true,
          }),
        );

        if (result.ok) {
          consecutiveErrors = 0;
          trackChangedFiles(toolCall, result, changedFiles);
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

      if (totalToolCalls > 0 && consecutiveTextOnlyTurns >= 1) {
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
  return [
    { role: "developer", content: buildAgenticSystemPrompt(input) },
    { role: "user", content: buildUserMessageWithThinking(input) },
  ];
}

function trackChangedFiles(
  toolCall: ProviderFunctionToolCall,
  result: ProjectToolResult,
  changedFiles: Set<string>,
) {
  if (!result.ok || !result.data) return;
  const data = result.data as Record<string, unknown>;
  if (Array.isArray(data.changedFiles)) {
    for (const f of data.changedFiles) {
      if (typeof f === "string") changedFiles.add(f);
    }
  }
  if (typeof data.path === "string") {
    changedFiles.add(data.path);
  }
}
