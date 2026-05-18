export function isSchemaRejectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  if (!message.includes("400")) return false;
  return (
    message.includes("invalid sch") ||
    message.includes("invalid_schema") ||
    message.includes("invalid json schema") ||
    message.includes("schema validation") ||
    message.includes("does not support response_format") ||
    message.includes("unsupported_response_format") ||
    message.includes("response_format") ||
    message.includes("text.format")
  );
}
