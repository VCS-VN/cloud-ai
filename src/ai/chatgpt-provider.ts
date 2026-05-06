import type { AIEnv } from "./env";
import type {
  AIProvider,
  GenerationCandidate,
  GenerationRequest,
} from "./ai-provider";

export type ChatGptProviderStatus = "configured" | "missing-config";

export type ChatGptProviderInit = {
  status: ChatGptProviderStatus;
  model?: string;
  baseUrl?: string;
  reason?: string;
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

export class ChatGptProvider implements AIProvider {
  constructor(private readonly config: AIEnv) {}

  async generateStorefront(
    _request: GenerationRequest,
  ): Promise<GenerationCandidate> {
    initializeChatGptProvider(this.config);
    throw new Error("ChatGPT provider execution is disabled for this phase");
  }
}
