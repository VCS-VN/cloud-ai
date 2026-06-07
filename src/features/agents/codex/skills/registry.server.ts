import fs from "node:fs/promises";
import path from "node:path";
import { loadSkill, type LoadedSkill } from "./skill-loader.server";

export type RegistryAuditEvent =
  | {
      type: "skill_registry_loaded";
      count: number;
      skillsRoot: string;
      at: number;
    }
  | {
      type: "skill_load_failed";
      name: string;
      reason: string;
      detail?: string;
      at: number;
    };

export type RegistryStatus = {
  loaded: boolean;
  skillsRoot: string;
  count: number;
  bootedAt: number | null;
  failures: { name: string; reason: string; detail?: string }[];
};

const registry = new Map<string, LoadedSkill>();
let status: RegistryStatus = {
  loaded: false,
  skillsRoot: "",
  count: 0,
  bootedAt: null,
  failures: [],
};
const auditListeners = new Set<(event: RegistryAuditEvent) => void>();

function emit(event: RegistryAuditEvent): void {
  for (const listener of auditListeners) {
    try {
      listener(event);
    } catch {
      // ignore listener errors
    }
  }
}

export function onRegistryAudit(listener: (event: RegistryAuditEvent) => void): () => void {
  auditListeners.add(listener);
  return () => auditListeners.delete(listener);
}

export type LoadRegistryInput = {
  skillsRoot: string;
  maxSkillChars: number;
  now?: number;
};

export async function loadRegistry(input: LoadRegistryInput): Promise<RegistryStatus> {
  registry.clear();
  const failures: RegistryStatus["failures"] = [];
  const now = input.now ?? Date.now();

  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(input.skillsRoot, { withFileTypes: true });
  } catch {
    status = {
      loaded: true,
      skillsRoot: input.skillsRoot,
      count: 0,
      bootedAt: now,
      failures: [],
    };
    emit({
      type: "skill_registry_loaded",
      count: 0,
      skillsRoot: input.skillsRoot,
      at: now,
    });
    return status;
  }

  for (const entry of entries) {
    if (entry.isSymbolicLink()) {
      const reason = "symlink_escape";
      failures.push({ name: entry.name, reason });
      emit({ type: "skill_load_failed", name: entry.name, reason, at: now });
      continue;
    }
    if (!entry.isDirectory()) continue;

    const dir = path.join(input.skillsRoot, entry.name);
    const result = await loadSkill({
      directoryPath: dir,
      maxSkillChars: input.maxSkillChars,
    });
    if (!result.ok) {
      failures.push({ name: entry.name, reason: result.reason, detail: result.detail });
      emit({
        type: "skill_load_failed",
        name: entry.name,
        reason: result.reason,
        detail: result.detail,
        at: now,
      });
      continue;
    }
    if (registry.has(result.skill.meta.name)) {
      const reason = "duplicate_name";
      failures.push({ name: entry.name, reason });
      emit({ type: "skill_load_failed", name: entry.name, reason, at: now });
      continue;
    }
    registry.set(result.skill.meta.name, result.skill);
  }

  status = {
    loaded: true,
    skillsRoot: input.skillsRoot,
    count: registry.size,
    bootedAt: now,
    failures,
  };
  emit({
    type: "skill_registry_loaded",
    count: registry.size,
    skillsRoot: input.skillsRoot,
    at: now,
  });
  return status;
}

export function getSkill(name: string): LoadedSkill | null {
  return registry.get(name) ?? null;
}

export function listSkills(): LoadedSkill[] {
  return Array.from(registry.values());
}

export function getRegistryStatus(): RegistryStatus {
  return status;
}

export function resetRegistryForTest(): void {
  registry.clear();
  status = {
    loaded: false,
    skillsRoot: "",
    count: 0,
    bootedAt: null,
    failures: [],
  };
  auditListeners.clear();
}
