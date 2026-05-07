import OpenAI from "openai";
import type { AIEnv } from "./env";
import { AIProviderConfigurationError } from "./ai-provider";
import type {
  AIProvider,
  ProjectMessageGenerationRequest,
  ProjectMessageStreamHandlers,
} from "./ai-provider";

const DEFAULT_INSTRUCTIONS = "";
const PLAN_MODE_INSTRUCTIONS = `${DEFAULT_INSTRUCTIONS}\n\nWhen plan mode is enabled, structure the response with a concise \"Plan\" section first, then continue in the same response with an \"Answer\" section. Keep the plan actionable and avoid waiting for approval.`;

export type ChatGptProviderStatus = "configured" | "missing-config";

export type ChatGptProviderInit = {
  status: ChatGptProviderStatus;
  model?: string;
  baseUrl?: string;
  reason?: string;
};

type ResponseInputMessage =
  | {
      type: "message";
      role: "user";
      content: [{ type: "input_text"; text: string }];
    }
  | {
      type: "message";
      role: "assistant";
      content: string;
    };

export function initializeChatGptProvider(
  config?: Partial<AIEnv>,
): ChatGptProviderInit {
  if (!config?.apiKey || !config.model)
    return {
      status: "missing-config",
      reason: "Missing ChatGPT provider configuration",
    };
  return { status: "configured", model: config.model, baseUrl: config.baseUrl };
}

function buildResponseInput(
  history: ProjectMessageGenerationRequest["history"],
): ResponseInputMessage[] {
  return history
    .map((message) => ({ ...message, content: message.content.trim() }))
    .filter((message) => message.content.length > 0)
    .map((message) =>
      message.role === "agent"
        ? {
            type: "message" as const,
            role: "assistant" as const,
            content: message.content,
          }
        : {
            type: "message" as const,
            role: "user" as const,
            content: [{ type: "input_text" as const, text: message.content }],
          },
    );
}

export class ChatGptProvider implements AIProvider {
  private readonly client: OpenAI;

  constructor(private readonly config: AIEnv) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      dangerouslyAllowBrowser: process.env.NODE_ENV === "test",
    });
  }

  async streamProjectMessage(
    request: ProjectMessageGenerationRequest,
    handlers: ProjectMessageStreamHandlers,
  ) {
    const init = initializeChatGptProvider(this.config);
    if (init.status !== "configured") {
      throw new AIProviderConfigurationError(
        "PROVIDER_NOT_CONFIGURED",
        init.reason ?? "OpenAI provider configuration is incomplete.",
      );
    }

    const instructions = request.planMode
      ? PLAN_MODE_INSTRUCTIONS
      : DEFAULT_INSTRUCTIONS;
    const input = buildResponseInput(request.history);

    const stream = this.client.responses.stream(
      {
        model: this.config.model,
        input,
        instructions,
        reasoning: request.reasoningEffort
          ? { effort: request.reasoningEffort }
          : undefined,
        stream: true,
      },
      {
        signal: request.signal,
      },
    );

    let sequence = 0;
    let content = "";
    let providerResponseId: string | undefined;

    try {
      for await (const event of stream) {
        if (event.type === "response.created") {
          providerResponseId = event.response.id;
          await handlers.onStarted?.({
            type: "message.started",
            projectId: request.projectId,
            messageId: request.messageId,
            processingStatus: "streaming",
            providerResponseId,
          });
          continue;
        }

        if (event.type === "response.output_text.delta" && event.delta) {
          sequence += 1;
          content += event.delta;
          await handlers.onDelta?.({
            type: "message.delta",
            messageId: request.messageId,
            sequence,
            delta: event.delta,
          });
          continue;
        }

        if (event.type === "response.completed") {
          await handlers.onCompleted?.({
            type: "message.completed",
            messageId: request.messageId,
            content,
            processingStatus: "completed",
            projectProcessingStatus: "idle",
            providerResponseId: event.response.id ?? providerResponseId,
          });
          return;
        }

        if (event.type === "response.failed") {
          await handlers.onFailed?.({
            type: "message.failed",
            messageId: request.messageId,
            content,
            processingStatus: "failed",
            projectProcessingStatus: "idle",
            providerResponseId: event.response.id ?? providerResponseId,
            error: {
              code: "PROVIDER_STREAM_FAILED",
              message:
                event.response.error?.message ??
                "Unable to complete the response.",
            },
          });
          return;
        }

        if (event.type === "response.output_text.done") {
          await handlers.onHeartbeat?.({
            type: "heartbeat",
            messageId: request.messageId,
          });
        }
      }
    } catch (error) {
      if (request.signal?.aborted) {
        await handlers.onStopped?.({
          type: "message.stopped",
          messageId: request.messageId,
          content,
          processingStatus: "stopped",
          projectProcessingStatus: "idle",
          providerResponseId,
        });
        return;
      }

      await handlers.onFailed?.({
        type: "message.failed",
        messageId: request.messageId,
        content,
        processingStatus: "failed",
        projectProcessingStatus: "idle",
        providerResponseId,
        error: {
          code: "PROVIDER_STREAM_FAILED",
          message:
            error instanceof Error
              ? error.message
              : "Unable to complete the response.",
        },
      });
    }
  }
}
