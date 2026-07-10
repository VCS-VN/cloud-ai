// Shared parsing for the `/redesign <description>` chat command. The dispatcher
// parses the prefix to route the run to the redesign driver, which has Codex
// author a new DESIGN.md + refresh the app.css token region and update the
// storefront UI to match — without renaming CSS class names.

export const REDESIGN_COMMAND = "/redesign";

export type ParsedRedesignCommand = {
  // The prompt with the `/redesign` prefix stripped — the user's free-text
  // description of the visual direction they want (may be empty).
  restPrompt: string;
};

const REDESIGN_RE = /^\/redesign\b\s*([\s\S]*)$/;

// Parse a chat prompt. Returns null when the prompt is not a /redesign command,
// so the caller falls through to the normal classifier.
export function parseRedesignCommand(prompt: string): ParsedRedesignCommand | null {
  const match = prompt.trim().match(REDESIGN_RE);
  if (!match) return null;
  return { restPrompt: match[1].trim() };
}
