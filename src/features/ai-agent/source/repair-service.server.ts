import type { PatchResult, ValidationResult } from "../project/project-state.schema";

export const REPAIR_POLICY = {
  maxAttempts: 2,
  rollbackOnFinalFailure: true,
};

export type RepairServiceConfig = {
  maxAttempts?: number;
};

export type RepairUntilValidInput = {
  projectId: string;
  patch: PatchResult;
  initialValidation: ValidationResult;
  repairPatch: (args: { projectId: string; patch: PatchResult; validation: ValidationResult; attempt: number }) => Promise<PatchResult>;
  applyPatch: (patch: PatchResult) => Promise<void>;
  validate: () => Promise<ValidationResult>;
};

export type RepairUntilValidResult = {
  finalPatch: PatchResult;
  validation: ValidationResult;
  repairAttempts: number;
  repaired: boolean;
};

export class RepairService {
  private readonly maxAttempts: number;

  constructor(config: RepairServiceConfig = {}) {
    this.maxAttempts = config.maxAttempts ?? REPAIR_POLICY.maxAttempts;
  }

  async repairUntilValid(input: RepairUntilValidInput): Promise<RepairUntilValidResult> {
    if (input.initialValidation.ok) {
      return { finalPatch: input.patch, validation: input.initialValidation, repairAttempts: 0, repaired: false };
    }

    let finalPatch = input.patch;
    let validation = input.initialValidation;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      finalPatch = await input.repairPatch({ projectId: input.projectId, patch: finalPatch, validation, attempt });
      await input.applyPatch(finalPatch);
      validation = await input.validate();
      if (validation.ok) {
        return { finalPatch, validation, repairAttempts: attempt, repaired: true };
      }
    }

    return { finalPatch, validation, repairAttempts: this.maxAttempts, repaired: false };
  }
}
