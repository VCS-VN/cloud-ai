export type ProjectSummaryKind = "routine" | "identity_impacting" | "commerce_impacting";

export type ProjectSummaryStatus = "active" | "pending_approval" | "superseded";

export type ProjectSummary = {
  projectId: string;
  version: number;
  kind: ProjectSummaryKind;
  status: ProjectSummaryStatus;
  summary: string;
  createdAt: number;
};

export type ProjectSummaryStore = {
  loadActive(projectId: string): Promise<ProjectSummary | null>;
  saveDraft(input: Omit<ProjectSummary, "status" | "version" | "createdAt">): Promise<ProjectSummary>;
  approve(projectId: string, version: number): Promise<ProjectSummary>;
  list(projectId: string): Promise<ProjectSummary[]>;
};

export function isAutoApprovableSummary(kind: ProjectSummaryKind): boolean {
  return kind === "routine";
}

export function projectSummaryToContextBlock(summary: ProjectSummary | null): string {
  if (!summary) return "(no project summary yet)";
  return [
    `<project_summary version="${summary.version}" kind="${summary.kind}">`,
    summary.summary.trim(),
    "</project_summary>",
  ].join("\n");
}
