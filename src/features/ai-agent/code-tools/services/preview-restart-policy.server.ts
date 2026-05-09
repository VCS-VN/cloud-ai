const PREVIEW_RESTART_PATTERNS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^pnpm-lock\.yaml$/,
  /^yarn\.lock$/,
  /^vite\.config\.[jt]s$/,
  /^tsconfig\.json$/,
  /^tailwind\.config\.[jt]s$/,
  /^postcss\.config\.[jt]s$/,
  /^src\/routeTree\.gen\.ts$/,
];

export function getPreviewRestartRequirement(changedFiles: string[]) {
  const files = [...new Set(changedFiles)].filter((file) => PREVIEW_RESTART_PATTERNS.some((pattern) => pattern.test(file)));
  return {
    required: files.length > 0,
    changedFiles: files,
    reason: files.length > 0 ? "Preview-impacting project configuration changed." : "No preview restart required.",
  };
}
