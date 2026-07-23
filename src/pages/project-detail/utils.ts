import type { DevRuntimeUIState } from "@/features/agents/ui/agent-event-reducer";
import type {
  Message,
  Project,
  ProjectFileNode,
  ProjectWorkspace,
} from "@/shared/project-types";

export type DetailMode = "preview" | "code";
export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type PreviewTokenState = {
  status: "idle" | "refreshing" | "ready" | "failed";
  error: string | null;
  refreshedAt: string | null;
};

export const CHAT_WIDTH_KEY = "project-detail-chat-width";
export const CHAT_VISIBLE_KEY = "project-detail-chat-visible";
export const SELECTED_MODEL_KEY = "project-detail-selected-model";
export const DEFAULT_CHAT_WIDTH = 360;
export const MIN_CHAT_WIDTH = 300;

export const statusLabel: Record<Project["status"], string> = {
  0: "Inactive",
  draft: "Draft",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

export function mapDevRuntimeStatus(s: string): DevRuntimeUIState["status"] {
  if (s === "installing") return "installing";
  if (s === "installed") return "installed";
  if (s === "starting") return "starting";
  if (s === "running") return "running";
  if (s === "stopped") return "stopped";
  if (s === "fixing") return "fixing";
  if (s === "error") return "error";
  return "idle";
}

export const MESSAGE_PAGE_SIZE = 20;

export function getProjectMessagesQueryKey(projectId?: string) {
  return ["project-messages", projectId] as const;
}

export function toRuntimeUIState(
  runtime: NonNullable<ProjectWorkspace["devRuntime"]>,
): DevRuntimeUIState {
  return {
    status: mapDevRuntimeStatus(runtime.status),
    previewUrl: runtime.previewUrl,
    previewPort: runtime.port,
    error: runtime.lastError,
    errorTier: runtime.lastErrorTier,
    fixAttempt: runtime.retryCount > 0 ? runtime.retryCount : null,
    fixChangedFiles:
      runtime.fixAttempts?.flatMap((attempt) => attempt.changedFiles) ?? [],
    durationMs:
      runtime.installCompletedAt && runtime.installStartedAt
        ? new Date(runtime.installCompletedAt).getTime() -
          new Date(runtime.installStartedAt).getTime()
        : null,
    previewReloadRequestedAt: null,
    previewReloadDelayMs: null,
    previewReloadReason: null,
  };
}

export function buildProjectMessageStreamUrl(
  projectId: string,
  agentMessageId: string,
) {
  return `/api/projects/${encodeURIComponent(projectId)}/messages/${encodeURIComponent(agentMessageId)}/stream`;
}

export function firstFileNode(
  nodes: ProjectFileNode[],
): ProjectFileNode | undefined {
  for (const node of nodes) {
    if (node.type === "file") return node;
    const child = firstFileNode(node.children ?? []);
    if (child) return child;
  }
  return undefined;
}

export function countFileNodes(nodes: ProjectFileNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === "file") return total + 1;
    return total + countFileNodes(node.children ?? []);
  }, 0);
}

export function countRunVersions(messages: Message[]): number {
  const runIds = new Set(
    messages
      .map((message) => message.runId)
      .filter((runId): runId is string => !!runId),
  );
  return Math.max(1, runIds.size);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getMaxChatWidth(): number {
  return Math.max(MIN_CHAT_WIDTH, Math.floor(window.innerWidth * 0.55));
}

export function findNode(
  nodes: ProjectFileNode[],
  nodeId?: string,
): ProjectFileNode | undefined {
  if (!nodeId) return undefined;
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNode(node.children ?? [], nodeId);
    if (child) return child;
  }
  return undefined;
}
