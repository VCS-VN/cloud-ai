import type { PatchResult } from "../code-agent-types";

type MutationContext = {
  __codeToolChangedFiles?: string[];
  __codeToolMutationRecords?: NonNullable<PatchResult["mutationRecords"]>;
};

export function recordMutationResult(context: unknown, result: PatchResult) {
  const target = context as MutationContext;
  const existingFiles = target.__codeToolChangedFiles ?? [];
  const existingRecords = target.__codeToolMutationRecords ?? [];
  const changedFiles = result.mutationRecords?.map((record) => record.path) ?? result.changedFiles;

  target.__codeToolChangedFiles = Array.from(new Set([...existingFiles, ...changedFiles]));
  target.__codeToolMutationRecords = [...existingRecords, ...(result.mutationRecords ?? [])];
}

