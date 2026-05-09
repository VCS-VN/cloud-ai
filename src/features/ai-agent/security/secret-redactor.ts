export function redactSecrets(input: string) {
  return input
    .replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED_OPENAI_KEY]")
    .replace(/OPENAI_API_KEY=[^\s"']*/g, "OPENAI_API_KEY=[REDACTED]")
    .replace(/STRIPE_SECRET_KEY=[^\s"']*/g, "STRIPE_SECRET_KEY=[REDACTED]")
    .replace(/firebase-adminsdk-[a-zA-Z0-9_-]+/g, "[REDACTED_FIREBASE_CREDENTIAL]");
}

export function redactJson<T>(value: T): T {
  return JSON.parse(redactSecrets(JSON.stringify(value))) as T;
}
