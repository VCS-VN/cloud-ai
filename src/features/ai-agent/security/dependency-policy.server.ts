export type DependencyRiskLevel = "low" | "medium" | "high";

const HIGH_RISK_PATTERNS = [
  /stripe/i,
  /paypal/i,
  /payment/i,
  /auth/i,
  /firebase-admin/i,
  /vite/i,
  /router/i,
  /tanstack\/react-router/i,
  /tanstack\/react-start/i,
];

const LOW_RISK_PATTERNS = [/clsx/i, /tailwind-merge/i, /date-fns/i];

export type DependencyChangeAssessment = {
  packageName: string;
  riskLevel: DependencyRiskLevel;
  requiresConfirmation: boolean;
  reason: string;
};

export function assessDependencyChange(packageName: string): DependencyChangeAssessment {
  const normalizedName = packageName.trim();
  if (!normalizedName) {
    throw new Error("Dependency package name is required.");
  }
  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(normalizedName))) {
    return {
      packageName: normalizedName,
      riskLevel: "high",
      requiresConfirmation: true,
      reason: "Payment, auth, router, framework, or build dependencies can affect security and runtime stability.",
    };
  }
  if (LOW_RISK_PATTERNS.some((pattern) => pattern.test(normalizedName))) {
    return {
      packageName: normalizedName,
      riskLevel: "low",
      requiresConfirmation: false,
      reason: "Known low-risk UI utility dependency.",
    };
  }
  return {
    packageName: normalizedName,
    riskLevel: "medium",
    requiresConfirmation: false,
    reason: "New dependencies require plan visibility and dependency-policy review.",
  };
}

export function assessDependencyRisk(packageName: string): DependencyRiskLevel {
  return assessDependencyChange(packageName).riskLevel;
}

export function assertDependencyChangeAllowed(args: { packageName: string; confirmed?: boolean }) {
  const assessment = assessDependencyChange(args.packageName);
  if (assessment.requiresConfirmation && !args.confirmed) {
    throw new Error(`Dependency "${assessment.packageName}" requires confirmation.`);
  }
  return assessment.riskLevel;
}
