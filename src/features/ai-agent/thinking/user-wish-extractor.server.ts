import type { OpenAIProvider } from "../openai/openai-provider.server";
import { THINKING_LAYER_DEVELOPER_PROMPT, THINKING_LAYER_SYSTEM_PROMPT } from "./thinking.prompt";
import { thinkingResultSchema, type ThinkingInput, type ThinkingResult } from "./thinking.schema";
import { createHeuristicThinkingResult } from "./thinking-fallback";

export type ExtractUserWishesInput = {
  input: ThinkingInput;
  provider?: OpenAIProvider;
  model: string;
};

export async function extractUserWishes(args: ExtractUserWishesInput): Promise<ThinkingResult> {
  if (!args.provider) return createHeuristicThinkingResult(args.input);

  const result = await args.provider.parseStructured<unknown, ThinkingResult>({
    model: args.model,
    system: `${THINKING_LAYER_SYSTEM_PROMPT}\n\n${THINKING_LAYER_DEVELOPER_PROMPT}`,
    user: {
      userPrompt: args.input.userPrompt,
      projectState: compactProjectState(args.input.projectState),
      projectContext: args.input.projectContext,
      conversationContext: args.input.conversationContext,
    },
    schemaName: "thinking_result",
    schema: thinkingResultSchema,
  });

  return thinkingResultSchema.parse(result);
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
