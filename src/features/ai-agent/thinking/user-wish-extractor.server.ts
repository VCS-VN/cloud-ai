import type { ChatCompletionsProvider } from "../openai/chat-completions-provider.server";
import { THINKING_LAYER_DEVELOPER_PROMPT, THINKING_LAYER_SYSTEM_PROMPT, THINKING_RESULT_FORMAT_CONTRACT } from "./thinking.prompt";
import {
  structuredThinkingResultSchema,
  type StructuredThinkingResult,
  type ThinkingInput,
} from "./thinking.schema";

export type ExtractUserWishesInput = {
  input: ThinkingInput;
  provider?: ChatCompletionsProvider;
  model: string;
};

export async function extractUserWishes(args: ExtractUserWishesInput): Promise<StructuredThinkingResult> {
  if (!args.provider) {
    throw new Error("OpenAI provider is required to extract user wishes via LLM.");
  }

  const result = await args.provider.parseStructured<unknown, StructuredThinkingResult>({
    model: args.model,
    system: `${THINKING_LAYER_SYSTEM_PROMPT}\n\n${THINKING_LAYER_DEVELOPER_PROMPT}\n\n${THINKING_RESULT_FORMAT_CONTRACT}`,
    user: {
      userPrompt: args.input.userPrompt,
      projectState: compactProjectState(args.input.projectState),
      projectContext: args.input.projectContext,
      conversationContext: args.input.conversationContext,
    },
    schemaName: "structured_thinking_result",
    schema: structuredThinkingResultSchema,
    allowFreeFormFallback: true,
  });

  return structuredThinkingResultSchema.parse(result);
}

function compactProjectState(projectState: ThinkingInput["projectState"]) {
  if (!projectState) return null;
  return {
    status: projectState.status,
    brand: projectState.brand,
    ecommerceSpec: projectState.ecommerceSpec,
    features: projectState.features,
    constraints: projectState.constraints,
    pages: projectState.pages,
  };
}
