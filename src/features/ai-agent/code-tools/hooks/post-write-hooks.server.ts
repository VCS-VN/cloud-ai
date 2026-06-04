import type { ToolHook } from "./hook-types";
import { scanForAntiSlop } from "../services/anti-slop-scanner.server";
import { isStorefrontUiPath } from "../services/project-path-guard.server";
import {
  isStorefrontCustomerCopyPath,
  scanStorefrontCustomerCopy,
} from "../services/storefront-customer-copy-guard.server";
import {
  formatCommerceDataContractViolations,
  scanCommerceDataContractPolicy,
} from "../services/commerce-data-contract-policy.server";
import {
  formatGeneratedApiClientPolicyViolations,
  scanGeneratedApiClientPolicy,
} from "../services/generated-api-client-policy.server";

export function createPostWriteHooks(): ToolHook[] {
  return [generatedApiClientPolicyHook, commerceDataContractPolicyHook, antiSlopHook];
}

const generatedApiClientPolicyHook: ToolHook = {
  type: "post_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ context, args }) => {
    const changedFiles = await readChangedFiles(context, args);
    const verdict = scanGeneratedApiClientPolicy(changedFiles);
    if (verdict.ok) return { ok: true };
    return {
      ok: false,
      error: {
        code: "GENERATED_API_CLIENT_POLICY_VIOLATION",
        message: formatGeneratedApiClientPolicyViolations(verdict.violations),
        recoverable: true,
      },
    };
  },
};

const commerceDataContractPolicyHook: ToolHook = {
  type: "post_write",
  applicable: (tool) => tool.category === "mutate",
  handler: async ({ context, args }) => {
    const changedFiles = await readChangedFiles(context, args);
    const verdict = scanCommerceDataContractPolicy({ changedFiles });
    if (verdict.ok) return { ok: true };
    return {
      ok: false,
      error: {
        code: "COMMERCE_DATA_CONTRACT_POLICY_VIOLATION",
        message: formatCommerceDataContractViolations(verdict.violations),
        recoverable: true,
      },
    };
  },
};

const antiSlopHook: ToolHook = {
  type: "post_write",
  applicable: () => true,
  handler: async ({ context, args, tool }) => {
    const changedFiles = extractPotentialChangedFiles(args);
    const uiFiles = changedFiles.filter((file) => isUiRelatedFilePath(file));
    if (uiFiles.length === 0) return { ok: true };

    const warnings: string[] = [];
    for (const path of uiFiles) {
      try {
        const source = await (context as any).fileStore?.readTextFile?.(context.projectId, path);
        if (typeof source !== "string") continue;
        const scan = scanForAntiSlop({ source, designMarkdown: undefined });
        for (const violation of scan.violations) warnings.push(`${path}: ${violation.message}`);
        if (isStorefrontCustomerCopyPath(path)) {
          const copyScan = scanStorefrontCustomerCopy({ source, path });
          for (const violation of copyScan.violations) {
            warnings.push(`${path}: ${violation.message}`);
          }
        }
      } catch {
        continue;
      }
    }
    return warnings.length ? { ok: true, warnings } : { ok: true };
  },
};

function extractPotentialChangedFiles(args: unknown) {
  if (!args || typeof args !== "object") return [];
  const record = args as Record<string, unknown>;
  if (Array.isArray(record.expectedChangedFiles)) return record.expectedChangedFiles.filter((v): v is string => typeof v === "string");
  if (typeof record.path === "string") return [record.path];
  return [];
}

async function readChangedFiles(
  context: Record<string, any>,
  args: unknown,
): Promise<Array<{ path: string; content: string }>> {
  const changedFiles = extractPotentialChangedFiles(args);
  const out: Array<{ path: string; content: string }> = [];
  for (const path of changedFiles) {
    try {
      const content = await context.fileStore?.readTextFile?.(context.projectId, path);
      if (typeof content === "string") out.push({ path, content });
    } catch {
      continue;
    }
  }
  return out;
}

function isUiRelatedFilePath(filePath: string): boolean {
  return isStorefrontUiPath(filePath) || filePath.startsWith("public/");
}
