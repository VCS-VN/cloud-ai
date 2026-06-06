import { runProcess, type ValidationOutcome } from "./typecheck.server";

export async function runBuild(
  draftWorkspacePath: string,
  opts: { signal?: AbortSignal } = {},
): Promise<ValidationOutcome> {
  return runProcess("pnpm", ["run", "build"], {
    cwd: draftWorkspacePath,
    timeoutMs: 10 * 60 * 1000,
    signal: opts.signal,
  });
}
