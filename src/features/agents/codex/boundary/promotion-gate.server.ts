import path from "node:path";
import { assertSameContext, type PathGuardContext } from "./path-guard.server";

export type PromotionGateInput = {
  expected: PathGuardContext;
  current: PathGuardContext;
};

export type PromotionGateResult =
  | { ok: true }
  | { ok: false; reason: string };

export function runPromotionGate(input: PromotionGateInput): PromotionGateResult {
  const same = assertSameContext(input.current, input.expected);
  if (!same.ok) {
    return { ok: false, reason: same.reason ?? "context_mismatch" };
  }
  if (
    path.resolve(input.current.draftWorkspacePath) !==
    path.resolve(input.expected.draftWorkspacePath)
  ) {
    return { ok: false, reason: "draft_path_drift" };
  }
  return { ok: true };
}
