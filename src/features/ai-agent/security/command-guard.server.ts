export const ALLOWED_AGENT_COMMANDS = [
  "npm run typecheck",
  "npm run lint",
  "npm run build",
  "pnpm typecheck",
  "pnpm lint",
  "pnpm build",
  "yarn typecheck",
  "yarn lint",
  "yarn build",
] as const;

const allowedCommands = new Set<string>(ALLOWED_AGENT_COMMANDS);

export class CommandGuard {
  assertAllowed(command: string) {
    if (!allowedCommands.has(command.trim())) {
      throw new Error("Command is not allowed for the agent workspace.");
    }
  }

  isAllowed(command: string) {
    return allowedCommands.has(command.trim());
  }
}
