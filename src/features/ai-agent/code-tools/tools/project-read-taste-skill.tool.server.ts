import type { CodeToolDefinition } from "../code-agent-types";
import { toolSuccess, toolError } from "../code-tool-executor.server";
import { loadTasteSkill } from "../services/taste-skill-loader.server";

export const projectReadTasteSkillTool: CodeToolDefinition<
  {},
  { content: string; hash: string }
> = {
  name: "project_read_taste_skill",
  category: "inspect",
  description:
    "Read the design-taste-frontend anti-slop skill (the authoritative UI taste guide). Returns the full skill markdown. MUST be called before creating or editing any storefront UI (routes, components, styles) so generated UI follows the anti-slop design system. Not required for pure business/data/network changes.",
  strict: true,
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {},
    required: [],
  },
  handler: async ({ context }) => {
    const startedAt = Date.now();
    try {
      const skill = await loadTasteSkill();

      (context as any).flags = { ...(context as any).flags, tasteSkillLoaded: true };
      (context as any).tasteSkillHash = skill.hash;

      return toolSuccess({
        context,
        toolName: "project_read_taste_skill",
        category: "inspect",
        startedAt,
        data: {
          content: skill.content,
          hash: skill.hash,
        },
      });
    } catch (error: any) {
      return toolError(
        context,
        "project_read_taste_skill",
        "inspect",
        startedAt,
        "TASTE_SKILL_REQUIRED",
        error?.message ?? "Failed to load the taste skill.",
        false,
      ) as any;
    }
  },
};
