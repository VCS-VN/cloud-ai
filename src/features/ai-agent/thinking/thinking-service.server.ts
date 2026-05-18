import { ThinkingResultJsonSchema } from "./thinking-json-schema";

export { preflightUserPrompt } from "./thinking-preflight";
export { ThinkingResultJsonSchema } from "./thinking-json-schema";

export type StructuredThinkingProvider = {
  parseStructured<TInput, TOutput>(args: {
    model: string;
    system: string;
    user: TInput;
    schemaName: string;
    schema: unknown;
    allowFreeFormFallback?: boolean;
  }): Promise<TOutput>;
};

export function getStructuredThinkingRequestSchema() {
  return {
    schemaName: "thinking_result",
    schema: ThinkingResultJsonSchema,
  };
}
