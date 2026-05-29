import { createHash } from "node:crypto";

export function computeSeed(
  projectId: string,
  designVersion: number,
  shakeRevision: number,
): string {
  if (!projectId) throw new Error("projectId is required");
  if (!Number.isInteger(designVersion) || designVersion < 1) {
    throw new Error("designVersion must be a positive integer");
  }
  if (!Number.isInteger(shakeRevision) || shakeRevision < 0) {
    throw new Error("shakeRevision must be a non-negative integer");
  }
  const input = `${projectId}:${designVersion}:${shakeRevision}`;
  return createHash("sha256").update(input).digest("hex");
}

export function computeBlockSeed(seed: string, blockId: string): string {
  if (!/^[a-f0-9]{64}$/.test(seed)) {
    throw new Error("seed must be a sha256 hex digest");
  }
  if (!blockId) throw new Error("blockId is required");
  return createHash("sha256").update(`${seed}:${blockId}`).digest("hex");
}

export function pickIndexFromSeed(blockSeed: string, max: number): number {
  if (!/^[a-f0-9]{64}$/.test(blockSeed)) {
    throw new Error("blockSeed must be a sha256 hex digest");
  }
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error("max must be a positive integer");
  }
  const slice = blockSeed.slice(0, 8);
  return parseInt(slice, 16) % max;
}
