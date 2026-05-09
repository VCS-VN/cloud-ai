import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { guardProjectPath } from "./project-path-guard.server";
import { redactSecrets, truncateText } from "./secret-redaction.server";

export async function readProjectFile(input: { workspaceRoot: string; path: string; maxBytes?: number }) {
  const guarded = guardProjectPath({ workspaceRoot: input.workspaceRoot, path: input.path });
  if (!guarded.ok) return { ok: false as const, error: guarded };

  const maxBytes = Math.min(Math.max(input.maxBytes ?? 80_000, 1), 120_000);
  const fileStat = await stat(guarded.absolutePath);
  if (!fileStat.isFile()) return { ok: false as const, error: { code: "NOT_A_FILE", message: "Path is not a file." } };

  const raw = await readFile(guarded.absolutePath, "utf8");
  const truncated = truncateText(redactSecrets(raw), maxBytes);
  return {
    ok: true as const,
    data: {
      path: guarded.relativePath,
      content: truncated.text,
      checksum: createHash("sha256").update(raw).digest("hex"),
      lineCount: raw.split(/\r?\n/).length,
      truncated: truncated.truncated,
      originalBytes: truncated.originalBytes,
    },
  };
}

export async function readProjectFileRange(input: { workspaceRoot: string; path: string; startLine: number; endLine: number; maxBytes?: number }) {
  if (input.startLine < 1 || input.endLine < input.startLine) {
    return { ok: false as const, error: { code: "INVALID_RANGE", message: "Range must be positive and inclusive." } };
  }

  const file = await readProjectFile({ workspaceRoot: input.workspaceRoot, path: input.path, maxBytes: input.maxBytes ?? 80_000 });
  if (!file.ok) return file;

  const lines = file.data.content.split(/\r?\n/);
  return {
    ok: true as const,
    data: {
      path: file.data.path,
      startLine: input.startLine,
      endLine: Math.min(input.endLine, lines.length),
      content: lines.slice(input.startLine - 1, input.endLine).join("\n"),
      lineCount: file.data.lineCount,
      checksum: file.data.checksum,
      truncated: file.data.truncated,
    },
  };
}
