/**
 * Markdown renderer for the user guide page.
 *
 * Sufficient for the user-guide.md content shape: h1-h4, paragraphs, ordered
 * and unordered lists, bold/italic/code inline, fenced code blocks, GFM
 * tables, blockquotes, links, and per-heading anchor IDs (auto-generated from
 * a slug + optional explicit `{#id}` suffix).
 *
 * NOT a general-purpose markdown engine; we keep the surface small because
 * the user guide is the only consumer. Output is sanitized via DOMPurify
 * with an explicit allowlist.
 */
import createDOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "code",
  "pre",
  "br",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "hr",
];

const ALLOWED_ATTR = ["id", "href"];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function formatInline(value: string) {
  let html = escapeHtml(value);
  // Markdown link [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, text, url) => {
    const safeUrl = url.startsWith("#") || url.startsWith("/") || /^https?:\/\//.test(url)
      ? url
      : "#";
    return `<a href="${safeUrl}">${text}</a>`;
  });
  html = html
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return html;
}

type Block =
  | { kind: "heading"; level: number; text: string; id: string }
  | { kind: "paragraph"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "code"; text: string }
  | { kind: "quote"; lines: string[] }
  | {
      kind: "table";
      headers: string[];
      rows: string[][];
    }
  | { kind: "hr" };

function parseHeading(line: string): Block | null {
  const m = line.match(/^(#{1,4})\s+(.*?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/);
  if (!m) return null;
  const level = m[1].length;
  const text = m[2];
  const explicitId = m[3];
  return { kind: "heading", level, text, id: explicitId ?? slugify(text) };
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push({ kind: "code", text: code.join("\n") });
      continue;
    }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line)) {
      blocks.push({ kind: "hr" });
      i += 1;
      continue;
    }

    // Heading
    const heading = parseHeading(line);
    if (heading) {
      blocks.push(heading);
      i += 1;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ kind: "quote", lines: quoteLines });
      continue;
    }

    // Table — header row followed by separator
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ kind: "table", headers, rows });
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    // Paragraph — gather lines until blank or block boundary
    const paraLines: string[] = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !parseHeading(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith(">") &&
      !(lines[i].includes("|") && isTableSeparator(lines[i + 1] ?? ""))
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push({ kind: "paragraph", text: paraLines.join(" ") });
  }

  return blocks;
}

function renderBlocks(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.kind) {
        case "heading":
          return `<h${block.level} id="${block.id}">${formatInline(block.text)}</h${block.level}>`;
        case "paragraph":
          return `<p>${formatInline(block.text)}</p>`;
        case "ul":
          return `<ul>${block.items.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ul>`;
        case "ol":
          return `<ol>${block.items.map((item) => `<li>${formatInline(item)}</li>`).join("")}</ol>`;
        case "code":
          return `<pre><code>${escapeHtml(block.text)}</code></pre>`;
        case "quote":
          return `<blockquote>${renderBlocks(parseBlocks(block.lines.join("\n")))}</blockquote>`;
        case "table": {
          const head = `<thead><tr>${block.headers
            .map((h) => `<th>${formatInline(h)}</th>`)
            .join("")}</tr></thead>`;
          const body = `<tbody>${block.rows
            .map(
              (row) =>
                `<tr>${row
                  .map((cell) => `<td>${formatInline(cell)}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}</tbody>`;
          return `<table>${head}${body}</table>`;
        }
        case "hr":
          return `<hr />`;
      }
    })
    .join("");
}

function sanitize(html: string) {
  if (typeof window === "undefined") return html;
  const DOMPurify = createDOMPurify(window);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

export function renderUserGuide(markdown: string): string {
  return sanitize(renderBlocks(parseBlocks(markdown)));
}
