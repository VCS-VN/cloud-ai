import fs from "node:fs/promises";
import path from "node:path";

// Post-write rule validator. Runs after the agent finishes writing files in a
// batch and before the next batch / final diff gate. Each rule corresponds to a
// deterministic constraint that used to live (and bloat) the prompt MD. Moving
// these to the runtime lets us shrink the prompt and enforce the rule even if
// the model "forgets" it — a missed rule surfaces as a structured issue list
// the orchestrator can either fail the run with or feed back into a repair
// turn.
//
// Scope: only files the agent owns. The protected-paths gate already rejects
// writes outside this set, so a violation here means the agent's output is
// wrong, not that the host is misbehaving.

export type ValidationIssueCode =
  | "brand_name_hardcoded"
  | "lucide_brand_icon_imported"
  | "tailwind_apply_group_misuse"
  | "direct_data_import_in_ui"
  | "product_descriptions_unsanitized"
  | "dompurify_ssr_unsafe";

export type ValidationIssue = {
  code: ValidationIssueCode;
  path: string;
  line?: number;
  message: string;
  evidence?: string;
};

// Forbidden placeholder brand strings the model must NOT hardcode. Brand
// identity must flow through `{storeDetail?.name}` (see canonical/brand-name).
// Detect both string-literal forms (`"AI Storefront"`) AND JSX text content
// (`>AI Storefront<`), since the model emits both.
const BRAND_LITERAL_NAMES = [
  "AI Storefront",
  "AI Store front",
  "AI Shop",
  "Demo Store",
  "My Store",
  "Your Store",
  "Placeholder Store",
  "Sample Store",
  "Example Store",
];

function buildBrandRe(): RegExp {
  // Match: quoted string literal OR JSX text node bracketed by `>` and `<`.
  const alt = BRAND_LITERAL_NAMES.map((n) => n.replace(/ /g, "\\s+")).join("|");
  return new RegExp(
    `(?:["'\`](?:${alt})["'\`])|(?:>\\s*(?:${alt})\\s*<)`,
    "gi",
  );
}

const BRAND_LITERAL_RE = buildBrandRe();

// Lucide brand/social glyphs that lucide-react@1.14.0 either does not export or
// strips. Detect both the named-import and the JSX usage forms. We only flag
// imports because that's the deterministic mistake; usages without imports
// would already fail typecheck.
const LUCIDE_BRAND_NAMES = [
  "Instagram",
  "Facebook",
  "Twitter",
  "X",
  "Linkedin",
  "LinkedIn",
  "Youtube",
  "YouTube",
  "Tiktok",
  "TikTok",
  "Whatsapp",
  "WhatsApp",
  "Pinterest",
  "Snapchat",
  "Reddit",
  "Discord",
  "Telegram",
];

const LUCIDE_IMPORT_RE = /from\s+["']lucide-react["']/;

// @apply with a group/peer marker or variant — Tailwind v3 rejects this. The
// fix is to put `group`/`peer` directly on JSX className, not in CSS.
const TAILWIND_APPLY_GROUP_RE =
  /@apply[^;]*\b(?:group|peer)(?:-[a-z-]+)?\b/;

const DATA_IMPORT_RE =
  /from\s+["']@\/data\/(?:products|categories|sample-store)["']/;

const TEXT_EXT_RE = /\.(tsx?|jsx?|css)$/;

function findLine(content: string, match: RegExpExecArray): number {
  const before = content.slice(0, match.index);
  return before.split("\n").length;
}

export async function validateWrittenFiles(input: {
  draftWorkspacePath: string;
  filePaths: string[];
}): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];
  for (const rel of input.filePaths) {
    if (!TEXT_EXT_RE.test(rel)) continue;
    // Only validate files the agent owns — skip seeded plumbing if it somehow
    // appears in the changed-files list (the diff gate already rejects those,
    // but be defensive). The deny-list is the inverse of "agent-owned"; here
    // we restrict to the set of dirs the agent legitimately writes.
    if (!isAgentAuthored(rel)) continue;
    let content: string;
    try {
      content = await fs.readFile(path.join(input.draftWorkspacePath, rel), "utf8");
    } catch {
      continue;
    }
    issues.push(...scanBrandLiteral(rel, content));
    issues.push(...scanLucideBrandIcons(rel, content));
    issues.push(...scanTailwindApplyGroup(rel, content));
    issues.push(...scanDirectDataImport(rel, content));
    issues.push(...scanProductDescriptionsSanitize(rel, content));
    issues.push(...scanDompurifySsrGuard(rel, content));
  }
  return issues;
}

const AGENT_AUTHORED_PREFIXES = [
  "src/routes/",
  "src/components/",
  "src/styles/",
  "DESIGN.md",
];

function isAgentAuthored(rel: string): boolean {
  return AGENT_AUTHORED_PREFIXES.some((p) =>
    p.endsWith("/") ? rel.startsWith(p) : rel === p,
  );
}

function scanBrandLiteral(rel: string, content: string): ValidationIssue[] {
  // Only .tsx/.ts; CSS literals are irrelevant here.
  if (!/\.(tsx?|jsx?)$/.test(rel)) return [];
  const out: ValidationIssue[] = [];
  const re = new RegExp(BRAND_LITERAL_RE);
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    out.push({
      code: "brand_name_hardcoded",
      path: rel,
      line: findLine(content, match),
      message:
        "Hardcoded placeholder brand string in JSX/text. " +
        "Render brand name via {storeDetail?.name} from useStore() instead.",
      evidence: match[0].slice(0, 80),
    });
  }
  return out;
}

function scanLucideBrandIcons(rel: string, content: string): ValidationIssue[] {
  if (!/\.(tsx?|jsx?)$/.test(rel)) return [];
  if (!LUCIDE_IMPORT_RE.test(content)) return [];
  const out: ValidationIssue[] = [];
  // Locate every `import { ... } from "lucide-react"` block and check its
  // named imports against the forbidden set.
  const importBlockRe = /import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g;
  let block: RegExpExecArray | null;
  while ((block = importBlockRe.exec(content)) !== null) {
    const named = block[1]?.split(",").map((s) => s.trim().split(/\s+as\s+/)[0]?.trim()).filter(Boolean) ?? [];
    for (const name of named) {
      if (LUCIDE_BRAND_NAMES.includes(name)) {
        out.push({
          code: "lucide_brand_icon_imported",
          path: rel,
          line: findLine(content, block),
          message:
            `Imported "${name}" from lucide-react. Brand/social icons are not exported in lucide-react@1.14.0. ` +
            `Use generic Mail/MessageCircle/Send/Globe/ExternalLink/MapPin/Phone or a text label.`,
          evidence: name,
        });
      }
    }
  }
  return out;
}

function scanTailwindApplyGroup(rel: string, content: string): ValidationIssue[] {
  if (!/\.css$/.test(rel)) return [];
  const out: ValidationIssue[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (TAILWIND_APPLY_GROUP_RE.test(line)) {
      out.push({
        code: "tailwind_apply_group_misuse",
        path: rel,
        line: i + 1,
        message:
          "@apply cannot use `group`/`peer` markers or their variants. Put `group`/`peer` on the JSX element's className instead.",
        evidence: line.trim().slice(0, 120),
      });
    }
  }
  return out;
}

function scanDirectDataImport(rel: string, content: string): ValidationIssue[] {
  if (!/\.(tsx?|jsx?)$/.test(rel)) return [];
  // Hook implementations under src/services/store ARE allowed to import sample
  // data — they're the fallback layer. Routes and components are not.
  if (rel.startsWith("src/services/store/")) return [];
  const out: ValidationIssue[] = [];
  const re = new RegExp(DATA_IMPORT_RE, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    out.push({
      code: "direct_data_import_in_ui",
      path: rel,
      line: findLine(content, match),
      message:
        "Direct import from @/data/* in a UI file. Routes and components must consume data via hooks (useProductsList, useProductDetail, useCategoriesList, useStore).",
      evidence: match[0],
    });
  }
  return out;
}

// `product.descriptions` is an HTML string. Any UI that renders it must pass
// the value through DOMPurify.sanitize first; rendering raw — either as JSX
// text or via dangerouslySetInnerHTML with the raw string — leaks an XSS
// surface and is the bug we keep seeing on first-pass generations.
const DESCRIPTIONS_REFERENCE_RE = /\bproduct(?:\?\.|\.)descriptions\b/;
const DOMPURIFY_SANITIZE_RE = /DOMPurify\s*\.\s*sanitize\s*\(/;
const SSR_GUARD_RE = /typeof\s+window\s*!==\s*["']undefined["']/;

function scanProductDescriptionsSanitize(rel: string, content: string): ValidationIssue[] {
  if (!/\.(tsx?|jsx?)$/.test(rel)) return [];
  if (!DESCRIPTIONS_REFERENCE_RE.test(content)) return [];
  // The hooks file legitimately references the type field without rendering
  // it. We only care about UI files that pull the value into JSX. Catch the
  // two render patterns: raw JSX text and dangerouslySetInnerHTML on the raw
  // string. If neither pattern appears AND no sanitize call exists, the file
  // either type-references descriptions only (OK) or punts on rendering (also
  // OK — we let downstream review catch missing UX, not the security gate).
  const rendersAsJsxText = /\{[^}]*\bproduct(?:\?\.|\.)descriptions[^}]*\}/.test(
    content,
  );
  const usesDangerously = /dangerouslySetInnerHTML/.test(content);
  if (!rendersAsJsxText && !usesDangerously) return [];
  if (DOMPURIFY_SANITIZE_RE.test(content)) return [];
  const match = DESCRIPTIONS_REFERENCE_RE.exec(content);
  return [
    {
      code: "product_descriptions_unsanitized",
      path: rel,
      line: match ? findLine(content, match) : undefined,
      message:
        "product.descriptions is rendered without DOMPurify.sanitize. " +
        "Import DOMPurify, compute `sanitizedDescriptions` with the SSR guard " +
        "(typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html)), " +
        "and render via dangerouslySetInnerHTML on a wrapping <div>.",
      evidence: match?.[0],
    },
  ];
}

function scanDompurifySsrGuard(rel: string, content: string): ValidationIssue[] {
  if (!/\.(tsx?|jsx?)$/.test(rel)) return [];
  if (!DOMPURIFY_SANITIZE_RE.test(content)) return [];
  if (SSR_GUARD_RE.test(content)) return [];
  const match = DOMPURIFY_SANITIZE_RE.exec(content);
  return [
    {
      code: "dompurify_ssr_unsafe",
      path: rel,
      line: match ? findLine(content, match) : undefined,
      message:
        "DOMPurify.sanitize called without an SSR guard. DOMPurify touches " +
        "`window` and crashes during SSR — gate the call with " +
        "`typeof window !== 'undefined' ? DOMPurify.sanitize(html) : escapeHtml(html)`.",
      evidence: match?.[0],
    },
  ];
}

// Format issues for a repair prompt. Same shape used by the corrupted-files
// sweep so the orchestrator can re-prompt the model with structured findings.
export function formatIssuesForRepairPrompt(issues: ValidationIssue[]): string {
  const byCode = new Map<ValidationIssueCode, ValidationIssue[]>();
  for (const issue of issues) {
    const arr = byCode.get(issue.code) ?? [];
    arr.push(issue);
    byCode.set(issue.code, arr);
  }
  const blocks: string[] = [];
  for (const [code, arr] of byCode) {
    const lines = arr.map((i) => {
      const at = i.line ? `:${i.line}` : "";
      const ev = i.evidence ? ` — \`${i.evidence}\`` : "";
      return `- ${i.path}${at}${ev}`;
    });
    blocks.push(`[${code}] ${arr[0]?.message}\n${lines.join("\n")}`);
  }
  return blocks.join("\n\n");
}
