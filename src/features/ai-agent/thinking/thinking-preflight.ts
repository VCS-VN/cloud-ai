import { redactSecrets } from "../security/secret-redactor";
import type { PreflightResult } from "./thinking.schema";

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /print\s+(your\s+)?(hidden\s+)?chain[-\s]of[-\s]thought/i,
  /reveal\s+(the\s+)?(system|developer)\s+prompt/i,
  /bypass\s+(policy|safety|guardrails)/i,
];

export function preflightUserPrompt(prompt: string, maxPromptChars = 12_000): PreflightResult {
  const trimmed = prompt.trim();
  const warnings: string[] = [];

  if (!trimmed) {
    return {
      sanitizedPrompt: "",
      warnings: ["Prompt is empty."],
      blocked: true,
      blockReason: "Please enter a storefront request before starting the agent.",
    };
  }

  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return {
      sanitizedPrompt: redactSecrets(trimmed.slice(0, maxPromptChars)),
      warnings: ["Prompt contains unsafe instruction patterns."],
      blocked: true,
      blockReason: "This request asks the agent to reveal or bypass internal instructions.",
    };
  }

  let sanitizedPrompt = redactSecrets(trimmed);
  if (sanitizedPrompt.length > maxPromptChars) {
    sanitizedPrompt = sanitizedPrompt.slice(0, maxPromptChars);
    warnings.push("Prompt was truncated to the maximum supported length.");
  }

  if (sanitizedPrompt !== trimmed) warnings.push("Prompt contained sensitive-looking content and was redacted.");
  return { sanitizedPrompt, warnings, blocked: false };
}
