import { renderPromptDoc } from "../../agent/prompt-template-store.server";

export type GeneratedApiClientPolicyViolation = {
  filePath: string;
  message: string;
};

export type GeneratedApiClientPolicyVerdict =
  | { ok: true }
  | { ok: false; violations: GeneratedApiClientPolicyViolation[] };

const API_FETCH_PATTERN = /\bfetch\s*\(\s*([`'"])\s*\/api\//;
const URL_SEARCH_PARAMS_PATTERN = /\bnew\s+URLSearchParams\s*\(/;
const RESPONSE_JSON_PATTERN = /\.json\s*\(/;

export function scanGeneratedApiClientPolicy(changedFiles: ReadonlyArray<{ path: string; content: string }>): GeneratedApiClientPolicyVerdict {
  const violations: GeneratedApiClientPolicyViolation[] = [];

  for (const file of changedFiles) {
    if (!isGeneratedApiCodePath(file.path) || !file.content) continue;
    if (API_FETCH_PATTERN.test(file.content) || /\bfetch\s*\(/.test(file.content)) {
      violations.push({
        filePath: file.path,
        message: "Use apiClient from @/services/http/client; do not use native fetch for generated API requests.",
      });
      continue;
    }
    if (URL_SEARCH_PARAMS_PATTERN.test(file.content) || RESPONSE_JSON_PATTERN.test(file.content)) {
      violations.push({
        filePath: file.path,
        message: "Use apiClient.get(..., { params }) and response.data; do not use URLSearchParams or response.json().",
      });
      continue;
    }
    if (file.path.startsWith("src/services/store/") && file.content.includes("/api/") && !file.content.includes("@/services/http/client")) {
      violations.push({
        filePath: file.path,
        message: "Store API hooks must import apiClient from @/services/http/client.",
      });
      continue;
    }
    if (usesCustomerApiEndpoint(file.content) && !file.content.includes("@/services/http/client")) {
      violations.push({
        filePath: file.path,
        message: "Generated auth/cart API code must import apiClient from @/services/http/client.",
      });
    }
  }

  return violations.length > 0 ? { ok: false, violations } : { ok: true };
}

export function formatGeneratedApiClientPolicyViolations(violations: readonly GeneratedApiClientPolicyViolation[]) {
  return renderPromptDoc("templates/policies/api-client-policy.md", {
    violations: violations
      .slice(0, 12)
      .map((violation) => `- ${violation.filePath}: ${violation.message}`)
      .join("\n"),
  });
}

function isGeneratedApiCodePath(filePath: string) {
  return filePath.startsWith("src/services/store/")
    || filePath.startsWith("src/services/http/")
    || filePath.startsWith("src/app/")
    || filePath.startsWith("src/routes/")
    || filePath.startsWith("src/components/");
}

function usesCustomerApiEndpoint(content: string) {
  return content.includes("/api/v1/auth/profile")
    || content.includes("/api/v1/carts");
}
