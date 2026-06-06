import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  REQUIRED_GENERATED_STOREFRONT_FILES,
} from "./generated-project-layout";

export type InitIntegrityViolation = {
  code: "MISSING_REQUIRED_FILE";
  path: string;
  message: string;
};

export type InitIntegrityResult = {
  ok: boolean;
  violations: InitIntegrityViolation[];
};

export async function validateInitIntegrity(input: {
  workspaceRoot: string;
}): Promise<InitIntegrityResult> {
  const violations: InitIntegrityViolation[] = [];

  for (const filePath of REQUIRED_GENERATED_STOREFRONT_FILES) {
    if (!(await readProjectFile(input.workspaceRoot, filePath))) {
      violations.push({
        code: "MISSING_REQUIRED_FILE",
        path: filePath,
        message: `Required generated storefront file is missing: ${filePath}`,
      });
    }
  }

  return { ok: violations.length === 0, violations };
}

export function formatInitIntegrityViolations(
  violations: readonly InitIntegrityViolation[],
): string {
  return violations
    .slice(0, 20)
    .map((violation) => `${violation.path}: ${violation.message}`)
    .join("\n");
}

async function readProjectFile(workspaceRoot: string, relativePath: string) {
  try {
    return await readFile(path.join(workspaceRoot, relativePath), "utf8");
  } catch {
    return null;
  }
}
