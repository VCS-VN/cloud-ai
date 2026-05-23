// Disable TanStack Start import protection for vitest test environment.
// Tests import .server.ts modules directly.

(globalThis as any).__TANSTACK_START_IMPORT_PROTECTION_DISABLED = true;
