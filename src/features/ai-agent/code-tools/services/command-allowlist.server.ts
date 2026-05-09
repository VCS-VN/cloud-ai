const ALLOWED_VALIDATION_COMMANDS = new Set([
  "npm run typecheck",
  "npm run lint",
  "npm run build",
  "npm test",
  "pnpm typecheck",
  "pnpm lint",
  "pnpm build",
  "pnpm test",
  "yarn typecheck",
  "yarn lint",
  "yarn build",
  "yarn test",
  "bun run typecheck",
  "bun run lint",
  "bun run build",
  "bun test",
]);

const SHELL_META_PATTERN = /[;&|`$<>\\]/;

export function normalizeValidationCommand(command: string) {
  return command.trim().replace(/\s+/g, " ");
}

export function isValidationCommandAllowed(command: string) {
  const normalized = normalizeValidationCommand(command);
  return normalized.length > 0 && !SHELL_META_PATTERN.test(normalized) && ALLOWED_VALIDATION_COMMANDS.has(normalized);
}

export function filterAllowedValidationCommands(commands: string[]) {
  return commands.map(normalizeValidationCommand).filter(isValidationCommandAllowed);
}
