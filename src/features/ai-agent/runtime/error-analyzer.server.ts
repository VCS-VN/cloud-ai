import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ChatCompletionsProvider } from "../openai/chat-completions-provider.server";
import { patchResultProviderSchema } from "../openai/schemas";
import type { FileOperation } from "../project/project-state.schema";
import { loadPromptDoc } from "../agent/prompt-template-store.server";

export type ErrorAnalysis = {
  tier: "code" | "config" | "system";
  summary: string;
  detail: string;
  referencedFiles: string[];
};

const FILE_PATH_REGEX = /(?:\/|^)(?:src\/|app\/|pages\/|components\/|lib\/|routes\/|styles\/)[^\s:)]+/g;

const TIER1_PATTERNS = [
  /\berror TS\d+\b/,
  /\bCannot find module\b/,
  /\bdoes not provide an export\b/,
  /\bUnexpected token\b/,
  /\bParse failure\b/i,
  /\bSyntaxError\b/,
  /\bTypeError\b/,
];

const TIER2_PATTERNS = [
  /\bModule not found\b/i,
  /\bCould not resolve\b/,
  /\bCannot resolve\b/,
  /\btsconfig\b/i,
  /\bfailed to resolve\b/i,
  /\bUnable to resolve\b/i,
];

const TIER3_PATTERNS = [
  /\bEADDRINUSE\b/,
  /\bENOSPC\b/,
  /\bENOENT\b/,
  /\bcommand not found\b/i,
  /\bpnpm: not found\b/i,
  /\btimeout\b/i,
  /\bETIMEDOUT\b/,
  /\bECONNREFUSED\b/,
];

export class ErrorAnalyzer {
  analyze(devLog: string): ErrorAnalysis {
    const tier = this.categorizeTier(devLog);
    const summary = this.buildSummary(devLog, tier);
    const detail = devLog.split("\n").filter(Boolean).slice(-50).join("\n");
    const referencedFiles = this.extractReferencedFiles(devLog);

    return { tier, summary, detail, referencedFiles };
  }

  isFixable(analysis: ErrorAnalysis): boolean {
    return analysis.tier !== "system";
  }

  private categorizeTier(devLog: string): "code" | "config" | "system" {
    for (const pattern of TIER3_PATTERNS) {
      if (pattern.test(devLog)) return "system";
    }
    for (const pattern of TIER1_PATTERNS) {
      if (pattern.test(devLog)) return "code";
    }
    for (const pattern of TIER2_PATTERNS) {
      if (pattern.test(devLog)) return "config";
    }
    return "system";
  }

  private buildSummary(devLog: string, tier: "code" | "config" | "system"): string {
    const lines = devLog.split("\n").filter((l) => l.trim());
    const errorLines = lines.filter((l) =>
      TIER1_PATTERNS.some((p) => p.test(l)) ||
      TIER2_PATTERNS.some((p) => p.test(l)) ||
      TIER3_PATTERNS.some((p) => p.test(l)),
    );
    const firstErrors = errorLines.slice(0, 5).join("; ");
    if (firstErrors) return `[${tier}] ${firstErrors}`;
    return `[${tier}] Dev server error detected.`;
  }

  private extractReferencedFiles(devLog: string): string[] {
    const matches = new Set<string>();
    let match: RegExpExecArray | null;
    const regex = new RegExp(FILE_PATH_REGEX.source, "g");
    while ((match = regex.exec(devLog)) !== null) {
      matches.add(match[0].trim());
    }
    return [...matches];
  }
}

export type ErrorFixerDeps = {
  openAIProvider: ChatCompletionsProvider;
  coderModel: string;
};

export class ErrorFixer {
  constructor(private readonly deps: ErrorFixerDeps) {}

  async attemptFix(input: {
    projectId: string;
    workspaceRoot: string;
    analysis: ErrorAnalysis;
  }): Promise<{ success: boolean; changedFiles: string[]; summary: string }> {
    const { workspaceRoot, analysis } = input;

    const errorContext = analysis.detail.slice(-2000);
    const fileContents: Array<{ path: string; content: string }> = [];

    for (const filePath of analysis.referencedFiles) {
      try {
        const fullPath = path.join(workspaceRoot, filePath);
        const content = await readFile(fullPath, "utf8");
        fileContents.push({ path: filePath, content });
      } catch {
        // File doesn't exist yet, skip
      }
    }

    const fileContextText = fileContents
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const systemPrompt = loadPromptDoc("templates/maintenance/error-analyzer-system.md");

    const userPrompt = {
      errorLog: errorContext,
      files: fileContents.map((f) => ({ path: f.path })),
      instruction: "Analyze the dev server error and return file operations to fix it. Apply minimal changes.",
      fileContents: fileContextText,
    };

    try {
      const result = await this.deps.openAIProvider.parseStructured<unknown, {
        summary: string;
        operations: FileOperation[];
        changedFiles: string[];
      }>({
        model: this.deps.coderModel,
        system: systemPrompt,
        user: userPrompt,
        schemaName: "patch_result",
        schema: patchResultProviderSchema,
      });

      const { writeFile } = await import("node:fs/promises");
      const changedFiles: string[] = [];

      for (const operation of result.operations) {
        const targetPath = path.join(workspaceRoot, operation.path);
        if (operation.type === "create_file" || operation.type === "modify_file") {
          await writeFile(targetPath, operation.content, "utf8");
          changedFiles.push(operation.path);
        } else if (operation.type === "delete_file") {
          const { rm } = await import("node:fs/promises");
          await rm(targetPath, { force: true });
          changedFiles.push(operation.path);
        }
      }

      return {
        success: changedFiles.length > 0,
        changedFiles,
        summary: result.summary || "Applied fixes.",
      };
    } catch (error) {
      return {
        success: false,
        changedFiles: [],
        summary: error instanceof Error ? error.message : "Fix attempt failed.",
      };
    }
  }
}
