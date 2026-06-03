/**
 * T054: Self-built cl100k_base tokenizer.
 *
 * Loads the cl100k_base BPE rank table (bundled ~1.6MB in /public/) and
 * provides a `countTokens()` function that tokenizes text using the same
 * encoding as OpenAI's tiktoken / GPT-4 tokenizer.
 *
 * Decision: Self-built instead of tiktoken npm package to avoid Node 24
 * native module issues and keep the dependency footprint small.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// --- BPE Core ---------------------------------------------------------------

let bpeRanks: Map<string, number> | null = null;

/** Load the BPE rank table once and cache. */
function loadBpeRanks(): Map<string, number> {
  if (bpeRanks) return bpeRanks;

  // During server-side builds, the file is at project root /public/
  // Fallback paths for different environments
  const paths = [
    resolve(process.cwd(), "public/cl100k_base.tiktoken"),
    resolve(process.cwd(), "dist/public/cl100k_base.tiktoken"),
  ];

  let data: Buffer | null = null;
  for (const p of paths) {
    try {
      data = readFileSync(p);
      break;
    } catch {
      // try next path
    }
  }

  if (!data) {
    // Degrade: return empty ranks (token count = char-based estimate)
    console.warn("[tokenizer] cl100k_base.tiktoken not found, using char/4 fallback");
    bpeRanks = new Map();
    return bpeRanks;
  }

  // The .tiktoken file format: UTF-8 text, one token per line, ordered by rank.
  // Line 0 = rank 0, line 1 = rank 1, etc.
  // Each line is the base64-encoded token bytes.
  const lines = data.toString("utf-8").split("\n");
  bpeRanks = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      const token = Buffer.from(line, "base64").toString("utf-8");
      bpeRanks.set(token, i);
    } catch {
      // skip malformed lines
    }
  }

  return bpeRanks;
}

// --- Byte Pair Encoding -----------------------------------------------------

/** Split UTF-8 text into raw bytes. */
function textToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

/** Merge adjacent byte pairs to tokens using the BPE rank table. */
function bpeEncode(bytes: number[]): string[] {
  const ranks = loadBpeRanks();
  if (ranks.size === 0) {
    // Fallback: approximate tokens as chars/4
    return [];
  }

  // Start with individual bytes as tokens
  let tokens: string[] = bytes.map((b) => String.fromCharCode(b));

  // Repeatedly merge the pair with lowest rank until no merges remain
  while (tokens.length > 1) {
    let bestRank = Infinity;
    let bestIdx = -1;

    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = tokens[i] + tokens[i + 1];
      const rank = ranks.get(pair);
      if (rank !== undefined && rank < bestRank) {
        bestRank = rank;
        bestIdx = i;
      }
    }

    if (bestIdx === -1) break;

    // Merge the best pair
    tokens = [
      ...tokens.slice(0, bestIdx),
      tokens[bestIdx] + tokens[bestIdx + 1],
      ...tokens.slice(bestIdx + 2),
    ];
  }

  return tokens;
}

// --- Regex Pattern (cl100k_base) --------------------------------------------

const CL100K_PATTERN =
  /('s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+)/gu;

/**
 * Split text into chunks using the cl100k_base regex pattern.
 * This mirrors the GPT-4 tokenizer's pre-tokenization step.
 */
function splitByPattern(text: string): string[] {
  const chunks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = CL100K_PATTERN.exec(text)) !== null) {
    chunks.push(match[0]);
  }
  return chunks;
}

// --- Public API -------------------------------------------------------------

/**
 * Count tokens for a given text using cl100k_base BPE encoding.
 * Falls back to `ceil(chars / 4)` if the rank table isn't available.
 */
export function countTokens(text: string): number {
  const ranks = loadBpeRanks();

  // Fallback: 4 chars ≈ 1 token on average for English text
  if (ranks.size === 0) {
    return Math.ceil(text.replace(/\s/g, "").length / 4) || 0;
  }

  const chunks = splitByPattern(text);
  let total = 0;

  for (const chunk of chunks) {
    const bytes = textToBytes(chunk);
    const encoded = bpeEncode(bytes);
    total += encoded.length;
  }

  return total;
}

/** Count total tokens across an array of strings. */
export function countTokensBatch(texts: string[]): number {
  return texts.reduce((sum, t) => sum + countTokens(t), 0);
}
