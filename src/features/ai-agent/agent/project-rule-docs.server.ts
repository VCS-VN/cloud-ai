import { readFileSync } from "node:fs";
import path from "node:path";

const PROJECT_RULE_DOCS_RELATIVE_DIR = "templates/project-rules";
const PROJECT_RULE_DOCS = [
  "routing.md",
  "imports.md",
  "protected-files.md",
  "data-contract.md",
  "ui-design.md",
] as const;

let cachedProjectRuleDocs: string | null = null;

export function loadProjectRuleDocsForPrompt(): string {
  if (cachedProjectRuleDocs !== null) return cachedProjectRuleDocs;

  const root = process.cwd();
  const dir = path.resolve(root, PROJECT_RULE_DOCS_RELATIVE_DIR);
  const blocks: string[] = [];
  for (const file of PROJECT_RULE_DOCS) {
    try {
      const raw = readFileSync(path.join(dir, file), "utf8");
      const body = stripFrontmatter(raw);
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

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content.trim();
  const end = content.indexOf("\n---", 3);
  if (end === -1) return content.trim();
  const afterFence = content.indexOf("\n", end + 1);
  if (afterFence === -1) return "";
  return content.slice(afterFence + 1).trim();
}
