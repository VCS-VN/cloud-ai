import { getSkill, getRegistryStatus } from "./registry.server";
import type { LoadedSkill } from "./skill-loader.server";

const NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

export type ProjectReadSkillSuccess = {
  ok: true;
  name: string;
  version: string;
  hash: string;
  body: string;
};

export type ProjectReadSkillFailureCode =
  | "not_found"
  | "invalid_name"
  | "registry_unavailable";

export type ProjectReadSkillFailure = {
  ok: false;
  code: ProjectReadSkillFailureCode;
  message: string;
};

export type ProjectReadSkillResult =
  | ProjectReadSkillSuccess
  | ProjectReadSkillFailure;

export type ProjectReadSkillAuditEvent =
  | {
      type: "skill_load_failed";
      name: string;
      reason: ProjectReadSkillFailureCode;
      at: number;
    }
  | { type: "skill_loaded"; name: string; at: number };

export type ProjectReadSkillCallbacks = {
  onSuccess?: (entry: { name: string; at: number }) => void;
  onAudit?: (event: ProjectReadSkillAuditEvent) => void;
};

function rejectInvalid(
  name: string,
  callbacks?: ProjectReadSkillCallbacks,
): ProjectReadSkillFailure {
  callbacks?.onAudit?.({
    type: "skill_load_failed",
    name,
    reason: "invalid_name",
    at: Date.now(),
  });
  return {
    ok: false,
    code: "invalid_name",
    message: "Skill name is invalid.",
  };
}

export function projectReadSkill(
  input: { name: unknown },
  callbacks?: ProjectReadSkillCallbacks,
): ProjectReadSkillResult {
  if (typeof input.name !== "string") {
    return rejectInvalid(typeof input.name === "string" ? input.name : "<non-string>", callbacks);
  }
  const name = input.name;
  if (
    name.length === 0 ||
    name.includes("/") ||
    name.includes("\\") ||
    name.includes("..") ||
    name.startsWith(".") ||
    !NAME_PATTERN.test(name)
  ) {
    return rejectInvalid(name, callbacks);
  }

  const status = getRegistryStatus();
  if (!status.loaded) {
    callbacks?.onAudit?.({
      type: "skill_load_failed",
      name,
      reason: "registry_unavailable",
      at: Date.now(),
    });
    return {
      ok: false,
      code: "registry_unavailable",
      message: "Skill registry is not available.",
    };
  }

  const skill: LoadedSkill | null = getSkill(name);
  if (!skill) {
    callbacks?.onAudit?.({
      type: "skill_load_failed",
      name,
      reason: "not_found",
      at: Date.now(),
    });
    return {
      ok: false,
      code: "not_found",
      message: "Skill is not available.",
    };
  }

  const at = Date.now();
  callbacks?.onSuccess?.({ name, at });
  callbacks?.onAudit?.({ type: "skill_loaded", name, at });
  return {
    ok: true,
    name: skill.meta.name,
    version: skill.meta.version,
    hash: skill.hash,
    body: skill.body,
  };
}

export const PROJECT_READ_SKILL_TOOL_NAME = "project_read_skill";
