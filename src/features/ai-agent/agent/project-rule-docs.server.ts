import path from "node:path";
import { loadPromptDoc } from "./prompt-template-store.server";

const PROJECT_RULE_DOCS_RELATIVE_DIR = "templates/project-rules";
const PROJECT_RULE_DOCS = [
  "routing.md",
  "imports.md",
  "protected-files.md",
  "data-contract.md",
  "ui-design.md",
  "loading-ux.md",
] as const;

let cachedProjectRuleDocs: string | null = null;

export function loadProjectRuleDocsForPrompt(): string {
  if (cachedProjectRuleDocs !== null) return cachedProjectRuleDocs;

  const blocks: string[] = [];
  for (const file of PROJECT_RULE_DOCS) {
    try {
      const body = loadPromptDoc(path.join(PROJECT_RULE_DOCS_RELATIVE_DIR, file));
      if (!body) continue;
      const marker = file
        .replace(/\.md$/, "")
        .replace(/[^a-z0-9]+/gi, "_")
        .toUpperCase();
      blocks.push(
        `=====START_OF_PROJECT_RULE_${marker}=====\n${body}\n=====END_OF_PROJECT_RULE_${marker}=====`,
      );
    } catch (error) {
      console.warn(
        `[project-rules] failed to read ${file}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  cachedProjectRuleDocs = blocks.join("\n\n");
  return cachedProjectRuleDocs;
}
