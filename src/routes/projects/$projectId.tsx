import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  createFileRoute,
  redirect,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  Settings,
  TriangleAlert,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PreviewInitPanel } from "@/components/projects/PreviewInitPanel";
import {
  createInitialChatState,
  type DevRuntimeUIState,
} from "@/features/agents/ui/agent-event-reducer";
import { useChatStream as useAgentStream } from "@/features/agents/ui/use-chat-stream";
import { isProjectPreviewStartAvailable, isProjectPreviewTemporarilyUnavailable } from "@/features/agents/ui/preview-availability";
import { buildPreviewUrl, normalizePreviewPath } from "@/features/agents/ui/preview-path";
import { useUserPresence } from "@/hooks/useUserPresence";
import { UserMenu } from "@/components/auth/UserMenu";
import { MessageComposer } from "@/components/projects/MessageComposer";
import { ProjectFileExplorer } from "@/components/projects/ProjectFileExplorer";
import { ProjectMessagesPanel } from "@/components/projects/ProjectMessagesPanel";
import { ProjectDeleteConfirmDialog } from "@/components/projects/ProjectDeleteConfirmDialog";
import { ProjectSettingsDrawer } from "@/components/projects/ProjectSettingsDrawer";
import { getCurrentUser } from "@/server/functions/auth";
import { listProjectMessages } from "@/server/functions/project-messages";
import {
  deleteProject,
  getProjectWorkspace,
  updateProjectSettings,
} from "@/server/functions/projects";
import { getDevRuntimeState, startPreview } from "@/server/functions/preview";
import type {
  ComposerReasoningEffort,
  Message,
  MessagePage,
  Project,
  ProjectFileNode,
  ProjectWorkspace,
} from "@/shared/project-types";

type DetailMode = "preview" | "code";
type PreviewTokenState = { status: "idle" | "refreshing" | "ready" | "failed"; error: string | null; refreshedAt: string | null };

const CHAT_WIDTH_KEY = "project-detail-chat-width";
const CHAT_VISIBLE_KEY = "project-detail-chat-visible";
const DEFAULT_CHAT_WIDTH = 420;
const MIN_CHAT_WIDTH = 320;

const statusLabel: Record<Project["status"], string> = {
  0: "Inactive",
  draft: "Draft",
  generating: "Generating",
  ready: "Ready",
  failed: "Failed",
};

function mapDevRuntimeStatus(s: string): DevRuntimeUIState["status"] {
  if (s === "installing") return "installing";
  if (s === "installed") return "installed";
  if (s === "starting") return "starting";
  if (s === "running") return "running";
  if (s === "stopped") return "stopped";
  if (s === "fixing") return "fixing";
  if (s === "error") return "error";
  return "idle";
}

const MESSAGE_PAGE_SIZE = 20;

function getProjectMessagesQueryKey(projectId?: string) {
  return ["project-messages", projectId] as const;
}

export const Route = createFileRoute("/projects/$projectId")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  loader: ({ params }) =>
    getProjectWorkspace({ data: { projectId: params.projectId } }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listMessages = useServerFn(listProjectMessages);
  const removeProject = useServerFn(deleteProject);
  const saveProjectSettings = useServerFn(updateProjectSettings);
  const getRuntimeState = useServerFn(getDevRuntimeState);
  const startProjectPreview = useServerFn(startPreview);
  const { workspace } = Route.useLoaderData();
  const router = useRouter();
  const { user } = Route.useRouteContext();
  const [project, setProject] = useState<Project | undefined>(
    workspace?.project,
  );
  const [draft, setDraft] = useState("");
  const [reasoningEffort, setReasoningEffort] =
    useState<ComposerReasoningEffort>("medium");
  const [planModeEnabled, setPlanModeEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [previewStarting, setPreviewStarting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<string | null>(null);
  const [settingsProjectName, setSettingsProjectName] = useState(workspace?.project.name ?? "");
  const [settingsSelectedStoreSlug, setSettingsSelectedStoreSlug] = useState<string | null>(workspace?.project.selectedStoreSlug ?? null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewStartError, setPreviewStartError] = useState<string | null>(
    null,
  );
  const [previewTokenState, setPreviewTokenState] = useState<PreviewTokenState>({ status: "idle", error: null, refreshedAt: null });
  const [manualRuntime, setManualRuntime] = useState<DevRuntimeUIState | null>(
    null,
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode>("preview");
  const [previewDraftPath, setPreviewDraftPath] = useState("/");
  const [previewCommittedPath, setPreviewCommittedPath] = useState("/");
  const [previewPathError, setPreviewPathError] = useState<string | null>(null);
  const [previewReloadKey, setPreviewReloadKey] = useState(0);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [chatVisible, setChatVisible] = useState(true);
  const [resizingChat, setResizingChat] = useState(false);
  const [codeQuery, setCodeQuery] = useState("");
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    new Set(),
  );
  const resizeRef = useRef<{
    startX: number;
    startWidth: number;
    latestWidth: number;
    maxWidth: number;
  } | null>(null);
  useEffect(() => {
    if (!settingsOpen) {
      setSettingsProjectName(project?.name ?? "");
      setSettingsSelectedStoreSlug(project?.selectedStoreSlug ?? null);
    }
  }, [project?.name, project?.selectedStoreSlug, settingsOpen]);

  const agentStream = useAgentStream({
    projectId: project?.id ?? "",
    initialMessages: workspace?.messages ?? [],
    activeRunId: project?.activeRunId ?? null,
  });
  const { state: chatState } = agentStream;
  const messages = chatState.messages;
  // The live run is the source of truth for "agent is working right now".
  // On first load before the stream connects, fall back to project state so the
  // UI shows processing for a run that's already in flight.
  const streamConnected = chatState.activeRun !== null;
  const isProcessing = streamConnected
    ? chatState.activeRun!.status === "streaming"
    : project?.processingStatus === "processing";

  const messagesQuery = useInfiniteQuery({
    queryKey: getProjectMessagesQueryKey(project?.id),
    initialPageParam: undefined as
      | Pick<MessagePage, "nextCursor">["nextCursor"]
      | undefined,
    queryFn: async ({ pageParam }) => {
      if (!project?.id) throw new Error("Project not found.");
      return listMessages({
        data: {
          projectId: project.id,
          beforeCreatedAt: pageParam?.beforeCreatedAt,
          beforeId: pageParam?.beforeId,
          limit: MESSAGE_PAGE_SIZE,
        },
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: false,
  });

  const runtimeQuery = useQuery({
    queryKey: ["project-runtime", project?.id],
    queryFn: () => getRuntimeState({ data: { projectId: project!.id } }),
    enabled: !!project?.id && detailMode === "preview",
    refetchInterval: (query) => {
      const runtime = query.state.data;
      if (runtime?.status === "running") return 10000;
      return 3000;
    },
    refetchOnWindowFocus: true,
  });

  // Runtime state: workspace/query snapshot as the base, overlaid by manual
  // preview actions, then by live dev events from the runtime SSE channel.
  const runtimeState = useMemo<DevRuntimeUIState>(() => {
    let runtime = createInitialChatState().runtime;
    const snapshot = runtimeQuery.data ?? workspace?.devRuntime;
    if (snapshot) runtime = toRuntimeUIState(snapshot);
    if (manualRuntime) runtime = manualRuntime;
    if (chatState.runtime.status !== "idle") runtime = chatState.runtime;
    return runtime;
  }, [chatState.runtime, manualRuntime, runtimeQuery.data, workspace?.devRuntime]);
  const refreshPreviewToken = useCallback(async (projectId: string, signal?: AbortSignal) => {
    setPreviewTokenState({ status: "refreshing", error: null, refreshedAt: null });
    const timeout = new AbortController();
    const timer = window.setTimeout(() => timeout.abort(), 15000);
    const abort = () => timeout.abort();
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const response = await fetch(`/api/projects/${projectId}/preview-token/refresh`, {
        method: "POST",
        credentials: "include",
        signal: timeout.signal,
      });
      if (!response.ok) throw new Error("Unable to refresh preview access.");
      setPreviewTokenState({ status: "ready", error: null, refreshedAt: new Date().toISOString() });
      setPreviewStartError(null);
      return true;
    } catch (cause) {
      if (signal?.aborted) return false;
      const message = cause instanceof Error && cause.name === "AbortError"
        ? "Timed out while preparing secure preview access."
        : "Unable to refresh preview access.";
      setPreviewTokenState({ status: "failed", error: message, refreshedAt: null });
      setPreviewStartError(message);
      return false;
    } finally {
      window.clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }, []);


  const { isActive } = useUserPresence({
    projectId: project?.id ?? "",
    enabled: !!project?.id,
  });

  useEffect(() => {
    if (!project?.id) return;
    if (!isActive) {
    }
  }, [isActive, project?.id]);

  const hasMoreMessages = !!messagesQuery.hasNextPage;
  const loadingOlder = messagesQuery.isFetchingNextPage;

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(CHAT_WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth >= MIN_CHAT_WIDTH) {
      setChatWidth(clamp(savedWidth, MIN_CHAT_WIDTH, getMaxChatWidth()));
    }

    const savedVisible = window.localStorage.getItem(CHAT_VISIBLE_KEY);
    if (savedVisible === "false") setChatVisible(false);
  }, []);

  useEffect(() => {
    agentStream.reset(workspace?.messages ?? []);
    setProject(workspace?.project);
    setSendError(undefined);
    setPreviewStarting(false);
    setPreviewStartError(null);
    setPreviewTokenState({ status: "idle", error: null, refreshedAt: null });
    setManualRuntime(null);
    setSelectedNodeId(firstFileNode(workspace?.fileTree ?? [])?.id);
    setDetailMode("preview");
    setPreviewDraftPath("/");
    setPreviewCommittedPath("/");
    setPreviewPathError(null);
    setPreviewReloadKey(0);
    setCodeQuery("");
    setExpandedFolderIds(
      new Set(
        (workspace?.fileTree ?? [])
          .filter((node) => node.type === "folder")
          .map((node) => node.id),
      ),
    );
  }, [workspace?.project.id, workspace?.fileTree]);

  useEffect(() => {
    if (!project?.id || detailMode !== "preview" || runtimeState.status !== "running" || !runtimeState.previewUrl) {
      setPreviewTokenState({ status: "idle", error: null, refreshedAt: null });
      return;
    }
    const abortController = new AbortController();
    void refreshPreviewToken(project.id, abortController.signal);
    const interval = window.setInterval(() => void refreshPreviewToken(project.id, abortController.signal), 10 * 60 * 1000);
    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [detailMode, project?.id, refreshPreviewToken, runtimeState.previewUrl, runtimeState.status]);

  const selectedNode = useMemo(
    () => findNode(workspace?.fileTree ?? [], selectedNodeId),
    [workspace?.fileTree, selectedNodeId],
  );
  const previewReady =
    runtimeState.status === "running" &&
    !!runtimeState.previewUrl &&
    previewTokenState.status === "ready";
  const activePreviewUrl =
    previewReady && runtimeState.previewUrl
      ? buildPreviewUrl(runtimeState.previewUrl, previewCommittedPath)
      : null;
  const previewControlsLoading =
    previewStarting ||
    ["installing", "starting", "fixing"].includes(runtimeState.status) ||
    previewTokenState.status === "refreshing";
  const handlePreviewPathChange = useCallback((path: string) => {
    setPreviewDraftPath(path);
    setPreviewPathError(null);
  }, []);
  const handlePreviewPathReset = useCallback(() => {
    setPreviewDraftPath(previewCommittedPath);
    setPreviewPathError(null);
  }, [previewCommittedPath]);
  const handlePreviewReload = useCallback(() => {
    if (!previewReady) return;
    const normalized = normalizePreviewPath(previewDraftPath);
    if (!normalized.ok) {
      setPreviewPathError(normalized.error);
      return;
    }
    setPreviewPathError(null);
    setPreviewDraftPath(normalized.path);
    setPreviewCommittedPath(normalized.path);
    setPreviewReloadKey((current) => current + 1);
  }, [previewDraftPath, previewReady]);

  // Sync local project state when a run ends via the stream. The stream owns
  // run lifecycle, so when activeRun clears we flip the project back to idle and
  // refresh derived data (files/preview/runs) that the run may have changed.
  const prevActiveRunRef = useRef<string | null>(null);
  useEffect(() => {
    const current = chatState.activeRun?.runId ?? null;
    const previous = prevActiveRunRef.current;
    prevActiveRunRef.current = current;
    if (previous && !current) {
      setProject((currentProject) =>
        currentProject && currentProject.processingStatus === "processing"
          ? { ...currentProject, processingStatus: "idle", activeRunId: undefined }
          : currentProject,
      );
      if (project?.id) {
        void queryClient.invalidateQueries({ queryKey: ["project", project.id] });
        void queryClient.invalidateQueries({ queryKey: ["project-files", project.id] });
        void queryClient.invalidateQueries({ queryKey: ["project-preview", project.id] });
        void queryClient.invalidateQueries({ queryKey: ["project-runs", project.id] });
        void router.invalidate();
      }
    }
  }, [chatState.activeRun?.runId, project?.id, queryClient, router]);


  const handleSaveProjectSettings = useCallback(async (settings: { name?: string; selectedStoreSlug?: string | null }) => {
    if (!project || settingsSaving) return;
    setSettingsSaving(true);
    setSettingsSaveError(null);
    setSettingsSaveSuccess(null);

    try {
      const updatedProject = await saveProjectSettings({
        data: {
          projectId: project.id,
          name: settings.name ?? settingsProjectName,
          selectedStoreSlug: settings.selectedStoreSlug ?? settingsSelectedStoreSlug ?? null,
        },
      });
      setProject(updatedProject);
      setSettingsProjectName(updatedProject.name);
      setSettingsSelectedStoreSlug(updatedProject.selectedStoreSlug ?? null);
      queryClient.setQueryData(["project-workspace", project.id], (current: ProjectWorkspace | undefined) =>
        current ? { ...current, project: updatedProject } : current,
      );
      setSettingsSaveSuccess("Project settings saved.");
    } catch (cause) {
      setSettingsSaveError(cause instanceof Error ? cause.message : "Unable to save project settings.");
    } finally {
      setSettingsSaving(false);
    }
  }, [project, queryClient, saveProjectSettings, settingsProjectName, settingsSaving, settingsSelectedStoreSlug]);

  function requestDeleteProject() {
    setDeleteError(null);
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteProject() {
    if (!project || deletePending || settingsSaving) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await removeProject({ data: { projectId: project.id } });
      setDeleteConfirmOpen(false);
      void navigate({ to: "/projects" as never });
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : "Unable to delete project.");
    } finally {
      setDeletePending(false);
    }
  }

  function toggleChat() {
    setChatVisible((current) => {
      const next = !current;
      window.localStorage.setItem(CHAT_VISIBLE_KEY, String(next));
      return next;
    });
  }

  function beginResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const maxWidth = getMaxChatWidth();
    resizeRef.current = {
      startX: event.clientX,
      startWidth: chatWidth,
      latestWidth: chatWidth,
      maxWidth,
    };
    setResizingChat(true);
  }

  function resize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeRef.current) return;
    const nextWidth = clamp(
      resizeRef.current.startWidth + event.clientX - resizeRef.current.startX,
      MIN_CHAT_WIDTH,
      resizeRef.current.maxWidth,
    );
    resizeRef.current.latestWidth = nextWidth;
    setChatWidth(nextWidth);
  }

  function endResize(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.localStorage.setItem(
      CHAT_WIDTH_KEY,
      String(resizeRef.current.latestWidth),
    );
    resizeRef.current = null;
    setResizingChat(false);
  }

  function toggleFolder(node: ProjectFileNode) {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  function selectNode(node: ProjectFileNode) {
    if (node.type === "file") setSelectedNodeId(node.id);
  }

  const scrollMessagesByPage = useCallback((direction: "up" | "down") => {
    const container = document.getElementById("project-messages-viewport");
    if (!container) return;

    container.scrollBy({
      top: container.clientHeight * 0.85 * (direction === "up" ? -1 : 1),
      behavior: "smooth",
    });
  }, []);

  const scrollMessagesToLatest = useCallback(() => {
    const container = document.getElementById("project-messages-viewport");
    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, []);

  const loadOlderMessages = useCallback(async () => {
    if (!hasMoreMessages || loadingOlder) return;

    const container = document.getElementById("project-messages-viewport");
    const previousScrollTop = container?.scrollTop ?? 0;
    const oldScrollHeight = container?.scrollHeight ?? 0;

    const result = await messagesQuery.fetchNextPage();
    const olderPage = result.data?.pages.at(-1);
    if (olderPage) agentStream.prependMessages(olderPage.messages);

    if (container) {
      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop =
          previousScrollTop + (newScrollHeight - oldScrollHeight);
      });
    }
  }, [agentStream, hasMoreMessages, loadingOlder, messagesQuery]);

  async function handleRetryMessage(message: Message) {
    if (!project || !message.runId) return;
    setSendError(undefined);
    const result = await agentStream.retryRun(message.runId);
    if (!result.ok) {
      setSendError(result.message);
      return;
    }
    setProject((currentProject) =>
      currentProject
        ? {
            ...currentProject,
            processingStatus: "processing",
            activeRunId: result.runId,
            processingStartedAt: new Date().toISOString(),
          }
        : currentProject,
    );
  }

  async function handleSendMessage(content: string) {
    if (!project) return;
    setSending(true);
    setSendError(undefined);
    setDraft("");

    const result = await agentStream.sendPrompt({
      prompt: content,
      reasoningEffort,
      planMode: planModeEnabled,
    });
    if (!result.ok) {
      setDraft(content);
      setSendError(result.message);
      setSending(false);
      return;
    }
    setProject((currentProject) =>
      currentProject
        ? {
            ...currentProject,
            processingStatus: "processing",
            activeRunId: result.runId,
            processingStartedAt: new Date().toISOString(),
          }
        : currentProject,
    );
    setSending(false);
  }

  async function handleSelectOption(messageId: string, optionId: string) {
    if (!project) return;
    const message = messages.find((item) => item.id === messageId);
    if (!message?.runId) return;
    setSendError(undefined);
    const ok = await agentStream.submitAnswer(message.runId, { optionId });
    if (!ok) {
      setSendError("Unable to select that option. Please try again.");
      return;
    }
    setProject((currentProject) =>
      currentProject
        ? {
            ...currentProject,
            processingStatus: "processing",
            activeRunId: message.runId ?? currentProject.activeRunId,
            processingStartedAt: new Date().toISOString(),
          }
        : currentProject,
    );
  }

  function handleStopGeneration() {
    if (!project?.activeRunId) return;
    const runId = project.activeRunId;
    // Optimistic: flip the UI to "Stopping…" and free the composer immediately.
    agentStream.markStopping();
    setProject((currentProject) =>
      currentProject
        ? { ...currentProject, processingStatus: "idle", activeRunId: undefined }
        : currentProject,
    );
    // Fire-and-forget; the run.stopped event will clear the skeleton.
    void agentStream.stopRun(runId).catch(() => {
      // ignore — the SSE terminal event reconciles UI state
    });
  }

  const handleStartPreview = useCallback(async () => {
    if (!project?.id || previewStarting) return;
    if (!isProjectPreviewStartAvailable({
      projectStatus: project.status,
      projectProcessingStatus: project.processingStatus,
      runtimeStatus: runtimeState.status,
      previewUrl: runtimeState.previewUrl,
    })) return;
    setPreviewStarting(true);
    setPreviewStartError(null);
    setPreviewDraftPath("/");
    setPreviewCommittedPath("/");
    setPreviewPathError(null);
    setPreviewReloadKey(0);
    setManualRuntime((current) => ({
      ...(current ?? createInitialChatState().runtime),
      status: "starting",
      error: null,
      errorTier: null,
    }));

    try {
      const result = await startProjectPreview({
        data: { projectId: project.id },
      });
      if (!result.success) {
        setPreviewStartError(result.error);
        setManualRuntime((current) => ({
          ...(current ?? createInitialChatState().runtime),
          status: "error",
          error: result.error,
          errorTier: result.errorTier,
          previewUrl: null,
          previewPort: null,
        }));
        return;
      }
      setManualRuntime((current) => ({
        ...(current ?? createInitialChatState().runtime),
        status: "running",
        previewUrl: result.previewUrl,
        previewPort: result.port,
        error: null,
        errorTier: null,
      }));
      await refreshPreviewToken(project.id);
      await router.invalidate();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unable to start preview.";
      setPreviewStartError(message);
      setManualRuntime((current) => ({
        ...(current ?? createInitialChatState().runtime),
        status: "error",
        error: message,
        errorTier: "system",
      }));
    } finally {
      setPreviewStarting(false);
    }
  }, [project, previewStarting, refreshPreviewToken, router, runtimeState.previewUrl, runtimeState.status, startProjectPreview]);

  return (
    <main className={`h-dvh min-h-0 overflow-hidden bg-(--app-bg) text-(--app-text) ${resizingChat ? "cursor-col-resize select-none" : ""}`}>
      {workspace && project ? (
        <div className="flex h-full min-h-0 min-w-0 overflow-hidden">
          <div
            className="flex min-h-0 shrink-0 flex-col overflow-hidden border-r border-(--app-border) bg-(--app-panel) transition-[width,border-width] duration-300 ease-in-out"
            style={{
              width: chatVisible ? chatWidth : 0,
              borderRightWidth: chatVisible ? undefined : 0,
              transitionDuration: resizingChat ? "0ms" : undefined,
            }}
          >
            <ChatHeader
              project={project}
              processing={isProcessing}
              onBack={() => void navigate({ to: "/projects" as never })}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleChat={toggleChat}
            />

            <div className="min-h-0 flex-1 overflow-hidden px-sm">
              <div className="flex h-full min-h-0 flex-col gap-sm">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProjectMessagesPanel
                    messages={messages}
                    skeleton={chatState.activeRun?.skeleton ?? null}
                    loadingOlder={loadingOlder}
                    hasMore={hasMoreMessages}
                    onLoadOlder={loadOlderMessages}
                    onRetryMessage={handleRetryMessage}
                    onSelectOption={handleSelectOption}
                    onPlanAction={async (message, action) => {
                      if (!message.runId) return;
                      const ok = await agentStream.submitAnswer(message.runId, {
                        planAction: action,
                      });
                      if (!ok) {
                        setSendError(
                          action === "approve"
                            ? "Không thể áp dụng kế hoạch. Vui lòng thử lại."
                            : "Không thể từ chối kế hoạch. Vui lòng thử lại.",
                        );
                      }
                    }}
                    awaitingPlanReviewRunId={
                      chatState.activeRun?.status === "awaiting_input"
                        ? chatState.activeRun.runId
                        : null
                    }
                    onSubmitFreeText={async (message, freeText) => {
                      if (!message.runId) return;
                      const ok = await agentStream.submitAnswer(message.runId, {
                        freeText,
                      });
                      if (!ok) {
                        setSendError("Không thể gửi mô tả. Vui lòng thử lại.");
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 p-sm">
              <MessageComposer
                value={draft}
                reasoningEffort={reasoningEffort}
                planMode={planModeEnabled}
                sending={sending}
                processing={isProcessing}
                error={sendError}
                disabled={false}
                onChange={setDraft}
                onReasoningEffortChange={setReasoningEffort}
                onPlanModeChange={setPlanModeEnabled}
                onSend={handleSendMessage}
                onStop={handleStopGeneration}
                onScrollMessagesUp={() => scrollMessagesByPage("up")}
                onScrollMessagesDown={scrollMessagesToLatest}
              />
            </div>
          </div>

          <button
            type="button"
            className={`left-0 z-[12000] group relative w-2 shrink-0 cursor-col-resize touch-none border-0 p-0 outline-none transition-[opacity] duration-200 ${chatVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            aria-label="Resize chat panel"
            onPointerDown={beginResize}
            onPointerMove={resize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onLostPointerCapture={endResize}
          >
            <span
              className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--app-border-strong)] transition-colors duration-200 group-hover:bg-[var(--app-accent)]"
              aria-hidden="true"
            />
          </button>

          <section className="flex min-h-0 min-w-0 flex-1 shrink-0 flex-col overflow-hidden bg-(--app-panel) transition-colors duration-300">
            <PreviewToolbar
              chatVisible={chatVisible}
              mode={detailMode}
              previewDraftPath={previewDraftPath}
              previewPathError={previewPathError}
              previewReady={previewReady}
              previewControlsLoading={previewControlsLoading}
              activePreviewUrl={activePreviewUrl}
              runtimeState={runtimeState}
              previewStarting={previewStarting}
              projectStatus={project.status}
              projectProcessingStatus={project.processingStatus}
              onToggleChat={toggleChat}
              onModeChange={setDetailMode}
              onPathChange={handlePreviewPathChange}
              onPathSubmit={handlePreviewReload}
              onPathReset={handlePreviewPathReset}
              onStartPreview={handleStartPreview}
              user={user}
            />
            <div className="min-h-0 flex-1 overflow-hidden p-sm">
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-md  border-[var(--app-border)] bg-[var(--app-panel)] transition-colors duration-300">
                {detailMode === "preview" ? (
                  <PreviewWorkspace
                    previewUrl={activePreviewUrl}
                    previewReloadKey={previewReloadKey}
                    runtimeState={runtimeState}
                    projectId={project?.id ?? ""}
                    previewStarting={previewStarting}
                    projectStatus={project.status}
                    projectProcessingStatus={project.processingStatus}
                    previewTokenState={previewTokenState}
                    onRefreshPreviewToken={() => project?.id ? void refreshPreviewToken(project.id) : undefined}
                    previewStartError={previewStartError}
                    onStartPreview={handleStartPreview}
                  />
                ) : (
                  <CodeView
                    fileTree={workspace.fileTree}
                    selectedNode={selectedNode}
                    selectedNodeId={selectedNodeId}
                    query={codeQuery}
                    expandedFolderIds={expandedFolderIds}
                    onQueryChange={setCodeQuery}
                    onToggleFolder={toggleFolder}
                    onSelectNode={selectNode}
                  />
                )}
              </div>
            </div>
          </section>
          <ProjectSettingsDrawer
            open={settingsOpen}
            project={project}
            loading={!project}
            projectName={settingsProjectName}
            selectedStoreSlug={settingsSelectedStoreSlug}
            onProjectNameChange={(name) => {
              setSettingsProjectName(name);
              setSettingsSaveError(null);
              setSettingsSaveSuccess(null);
            }}
            onSelectedStoreChange={(storeId) => {
              setSettingsSelectedStoreSlug(storeId);
              setSettingsSaveError(null);
              setSettingsSaveSuccess(null);
            }}
            deleting={deletePending}
            onDelete={requestDeleteProject}
            saving={settingsSaving}
            saveError={settingsSaveError}
            saveSuccess={settingsSaveSuccess}
            onOpenChange={setSettingsOpen}
            onSave={handleSaveProjectSettings}
          />
          <ProjectDeleteConfirmDialog
            open={deleteConfirmOpen}
            project={project}
            deleting={deletePending}
            error={deleteError}
            onCancel={() => {
              if (deletePending) return;
              setDeleteConfirmOpen(false);
              setDeleteError(null);
            }}
            onConfirm={() => void confirmDeleteProject()}
          />
        </div>
      ) : (
        <div className="p-md">
          <EmptyState
            title="Project not found"
            description="This project is no longer available or no valid project is selected."
          />
        </div>
      )}
    </main>
  );
}

function runtimeStatusBadge(
  state: DevRuntimeUIState,
  previewStarting = false,
): { label: string; tone: string; icon: React.ReactNode } | null {
  switch (state.status) {
    case "installing":
      return {
        label: "Installing...",
        tone: "border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)]",
        icon: <Loader2 aria-hidden="true" className="animate-spin" size={12} />,
      };
    case "installed":
      return {
        label:
          state.durationMs !== null
            ? `Installed (${(state.durationMs / 1000).toFixed(1)}s)`
            : "Installed",
        tone: "border-[var(--app-border)] bg-[var(--color-block-lime)] text-[var(--app-on-color-block)]",
        icon: <CheckCircle2 aria-hidden="true" size={12} />,
      };
    case "starting":
      return {
        label: "Starting...",
        tone: "border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)]",
        icon: <Loader2 aria-hidden="true" className="animate-spin" size={12} />,
      };
    case "running":
      return {
        label: "Running",
        tone: "border-[var(--app-border)] bg-[var(--color-block-lime)] text-[var(--app-on-color-block)]",
        icon: <CheckCircle2 aria-hidden="true" size={12} />,
      };
    case "stopped":
      return {
        label: previewStarting ? "Resuming..." : "Stopped",
        tone: "border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)]",
        icon: previewStarting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={12} />
        ) : (
          <TriangleAlert aria-hidden="true" size={12} />
        ),
      };
    case "error":
      return {
        label: state.error ? `Error: ${state.error}` : "Error",
        tone: "border-[var(--app-border-strong)] bg-[var(--app-danger-bg)] text-[var(--app-danger-text)]",
        icon: <TriangleAlert aria-hidden="true" size={12} />,
      };
    case "fixing":
      return {
        label: `Fixing error (attempt ${state.fixAttempt ?? "?"}/3)...`,
        tone: "border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)]",
        icon: (
          <RefreshCw aria-hidden="true" className="animate-spin" size={12} />
        ),
      };
    default:
      return null;
  }
}

function ChatHeader({
  project,
  processing = false,
  onBack,
  onOpenSettings,
  onToggleChat,
}: {
  project: Project;
  processing?: boolean;
  onBack: () => void;
  onOpenSettings: () => void;
  onToggleChat: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-[var(--app-border)] p-sm">
      <div className="flex min-w-0 items-start gap-sm">
        <button
          className="mt-xxs inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          onClick={onBack}
          aria-label="Back to projects"
        >
          <ArrowLeft aria-hidden="true" size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[14px] font-[580] leading-4 tracking-[-0.015em]">
            {project.name}
          </h1>

          <div className="mt-xs flex flex-wrap gap-xs text-[12px] leading-4 text-[var(--app-muted)]">
            <span className="rounded-pill bg-[var(--app-control)] px-xs py-xxs">
              {project.status !== 0 ? statusLabel[project.status] : "Inactive"}
            </span>
            {processing ? (
              <span className="inline-flex items-center gap-xxs rounded-pill bg-[var(--color-block-lime)] px-xs py-xxs text-[var(--app-on-color-block)]">
                <Loader2
                  aria-hidden="true"
                  className="animate-spin text-[var(--app-icon-on-color-block)]"
                  size={12}
                />
                Generating
              </span>
            ) : null}
            <span className="rounded-pill bg-[var(--app-control)] px-xs py-xxs">
              Edited {new Date(project.updatedAt).toLocaleDateString("en-US")}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-xs">
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            type="button"
            onClick={onOpenSettings}
            aria-label="Open project settings"
          >
            <Settings aria-hidden="true" size={16} />
          </button>
          <button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            type="button"
            onClick={onToggleChat}
            aria-label="Hide chat"
          >
            <PanelLeftClose aria-hidden="true" size={16} />
          </button>

        </div>
      </div>
    </header>
  );
}

function PreviewToolbar({
  chatVisible,
  mode,
  previewDraftPath,
  previewPathError,
  previewReady,
  previewControlsLoading,
  activePreviewUrl,
  runtimeState,
  previewStarting,
  projectStatus,
  projectProcessingStatus,
  onToggleChat,
  onModeChange,
  onPathChange,
  onPathSubmit,
  onPathReset,
  onStartPreview,
  user,
}: {
  chatVisible: boolean;
  mode: DetailMode;
  previewDraftPath: string;
  previewPathError: string | null;
  previewReady: boolean;
  previewControlsLoading: boolean;
  activePreviewUrl: string | null;
  runtimeState: DevRuntimeUIState;
  previewStarting: boolean;
  projectStatus: Project["status"];
  projectProcessingStatus: Project["processingStatus"];
  onToggleChat: () => void;
  onModeChange: (mode: DetailMode) => void;
  onPathChange: (path: string) => void;
  onPathSubmit: () => void;
  onPathReset: () => void;
  onStartPreview: () => void;
  user?: import("@/auth/types").AuthUserSummary;
}) {
  const canStartPreview = isProjectPreviewStartAvailable({
    projectStatus,
    projectProcessingStatus,
    runtimeStatus: runtimeState.status,
    previewUrl: runtimeState.status === "running" ? runtimeState.previewUrl : null,
  });
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({ projectStatus, projectProcessingStatus });
  const pathInputId = "preview-path";

  return (
    <header className="flex h-14 shrink-0 items-center gap-sm pt-3  border-[var(--app-border)] px-sm transition-colors duration-300">
      {!chatVisible ? (
        <button
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          onClick={onToggleChat}
          aria-label="Show chat"
        >
          <PanelLeftOpen aria-hidden="true" size={16} />
        </button>
      ) : null}

      <div
        className="flex shrink-0 rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-xxs"
        role="group"
        aria-label="Choose view mode"
      >
        <button
          className={`inline-flex h-6 items-center gap-xs rounded-sm border-0 px-sm text-[12px] transition ${mode === "preview" ? "bg-[var(--color-block-lime)] text-[var(--app-on-color-block)] [&_svg]:text-[var(--app-icon-on-color-block)] ring-1 ring-[var(--color-primary)]" : "bg-transparent text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"}`}
          type="button"
          aria-pressed={mode === "preview"}
          onClick={() => onModeChange("preview")}
        >
          <Globe aria-hidden="true" size={15} />
          Preview
        </button>
        <button
          className={`inline-flex h-6 items-center gap-xs rounded-sm border-0 px-sm text-[12px] transition ${mode === "code" ? "bg-[var(--color-block-lime)] text-[var(--app-on-color-block)] [&_svg]:text-[var(--app-icon-on-color-block)] ring-1 ring-[var(--color-primary)]" : "bg-transparent text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"}`}
          type="button"
          aria-pressed={mode === "code"}
          onClick={() => onModeChange("code")}
        >
          <Code2 aria-hidden="true" size={15} />
          Code
        </button>
      </div>

      <div className="mx-auto flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-xs">
          <label
            className={`flex h-9 min-w-0 flex-1 items-center gap-xs rounded-pill border px-sm text-[12px] text-[var(--app-text)] ${previewPathError ? "border-[var(--app-border-strong)] bg-[var(--app-control)]" : "border-[var(--app-border)] bg-[var(--app-control)]"}`}
            htmlFor={pathInputId}
          >
            <Globe
              aria-hidden="true"
              className="text-[var(--app-icon-subtle)]"
              size={14}
            />

            <input
              id={pathInputId}
              className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[var(--app-page-text)] outline-none placeholder:text-[var(--app-subtle-text)] disabled:cursor-not-allowed disabled:text-[var(--app-muted)]"
              value={previewDraftPath}
              placeholder="/"
              disabled={!previewReady}
              aria-invalid={previewPathError ? "true" : undefined}
              onChange={(event) => onPathChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onPathSubmit();
                if (event.key === "Escape") onPathReset();
              }}
            />
          </label>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onPathSubmit}
            disabled={!previewReady}
            aria-label="Reload preview"
          >
            {previewControlsLoading ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <RefreshCw aria-hidden="true" size={15} />
            )}
          </button>
        </div>
        {previewPathError ? (
          <span className="mt-xxs truncate text-[11px] leading-3 text-[var(--app-danger-text)]">
            {previewPathError}
          </span>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-xs">
        <UserMenu user={user} compact />
        {previewTemporarilyUnavailable ? (
          <span className="inline-flex h-8 items-center gap-xxs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-muted)]">
            <Loader2 aria-hidden="true" className="animate-spin" size={13} />
            Building storefront…
          </span>
        ) : canStartPreview ? (
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onStartPreview}
            disabled={previewStarting}
            aria-label="Start preview"
          >
            {previewStarting ? (
              <Loader2 aria-hidden="true" className="animate-spin" size={15} />
            ) : (
              <Play aria-hidden="true" size={15} />
            )}
          </button>
        ) : null}
        {activePreviewUrl ? (
          <a
            href={activePreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            aria-label="Open preview"
          >
            <ExternalLink aria-hidden="true" size={15} />
          </a>
        ) : (
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] opacity-60"
            type="button"
            disabled
            aria-label="Open preview"
          >
            <ExternalLink aria-hidden="true" size={15} />
          </button>
        )}
      </div>
    </header>
  );
}

function PreviewWorkspace({
  previewUrl,
  previewReloadKey,
  runtimeState,
  projectId,
  previewStarting,
  projectStatus,
  projectProcessingStatus,
  previewTokenState,
  previewStartError,
  onStartPreview,
  onRefreshPreviewToken,
}: {
  previewUrl: string | null;
  previewReloadKey: number;
  runtimeState: DevRuntimeUIState;
  projectId: string;
  previewStarting: boolean;
  projectStatus: Project["status"];
  projectProcessingStatus: Project["processingStatus"];
  previewTokenState: PreviewTokenState;
  previewStartError: string | null;
  onStartPreview: () => void;
  onRefreshPreviewToken: () => void;
}) {
  const showIframe = !!previewUrl;
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({ projectStatus, projectProcessingStatus });
  const showInitPanel =
    !previewTemporarilyUnavailable &&
    ["idle", "stopped", "error"].includes(runtimeState.status) &&
    runtimeState.status !== "running";
  const statusBadge = runtimeStatusBadge(runtimeState, previewStarting);

  return (
    <section className="preview-theme-isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)] transition-colors duration-300">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] transition-colors duration-300">
        <div className="flex h-11 shrink-0 items-center justify-between gap-sm border-b border-[var(--app-border)] bg-[var(--app-panel)] px-sm transition-colors duration-300">
          <div className="min-w-0">
            <p className="m-0 text-[12px] font-[580] leading-4 text-[var(--app-text)]">
              Preview mode
            </p>
          </div>
          {statusBadge ? (
            <span
              className={`inline-flex shrink-0 items-center gap-xxs rounded-pill border px-xs py-xxs text-[12px] leading-4 ${statusBadge.tone}`}
            >
              {statusBadge.icon}
              {statusBadge.label}
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-xxs rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-xs py-xxs text-[12px] leading-4 text-[var(--app-muted)]">
              Idle
            </span>
          )}
        </div>
        {showIframe ? (
          <iframe
            key={`${previewUrl}:${previewTokenState.refreshedAt ?? "ready"}:${previewReloadKey}`}
            src={previewUrl}
            className="h-full w-full border-0"
            style={{ colorScheme: "light", backgroundColor: "var(--app-panel)" }}
            title="Project preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : runtimeState.status === "running" && runtimeState.previewUrl && previewTokenState.status === "refreshing" ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--app-muted)]">
            Preparing secure preview access…
          </div>
        ) : runtimeState.status === "running" && runtimeState.previewUrl && previewTokenState.status === "failed" ? (
          <div className="flex h-full items-center justify-center p-md text-center text-sm text-[var(--app-muted)]">
            <div className="max-w-sm space-y-sm rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] p-md">
              <TriangleAlert className="mx-auto text-[var(--app-icon)]" aria-hidden="true" size={22} />
              <p className="m-0 font-[560] text-[var(--app-text)]">Could not prepare secure preview access.</p>
              <p className="m-0 text-[12px] leading-5">{previewTokenState.error ?? "Unable to refresh preview access."}</p>
              <p className="m-0 text-[11px] leading-4 text-[var(--app-muted)]">Runtime is running and preview URL is available. Token refresh failed.</p>
              <button
                type="button"
                onClick={onRefreshPreviewToken}
                className="inline-flex items-center gap-xxs rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-sm py-xs text-[12px] font-[520] text-[var(--app-text)] hover:border-[var(--app-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
              >
                <RefreshCw aria-hidden="true" size={13} />
                Retry secure access
              </button>
            </div>
          </div>
        ) : previewTemporarilyUnavailable ? (
          <div className="flex h-full items-center justify-center p-md text-center text-sm text-[var(--app-muted)]">
            <div className="max-w-sm space-y-xs rounded-md border border-[var(--app-border)] bg-[var(--app-panel)] p-md">
              <Loader2 className="mx-auto animate-spin text-[var(--app-icon-muted)]" aria-hidden="true" size={22} />
              <p className="m-0 font-[560] text-[var(--app-text)]">Your storefront is being prepared.</p>
              <p className="m-0 text-[12px] leading-5">Preview will be available when setup is complete.</p>
            </div>
          </div>
        ) : showInitPanel ? (
          <PreviewInitPanel
            projectId={projectId}
            onStartPreview={onStartPreview}
            isLoading={previewStarting}
            error={previewStartError ?? runtimeState.error}
            onRetry={onStartPreview}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-md text-center text-sm text-[var(--app-muted)]">
            Start preview when your storefront is ready.
          </div>
        )}
      </div>
    </section>
  );
}

function toRuntimeUIState(
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
  };
}

function CodeView({
  fileTree,
  selectedNode,
  selectedNodeId,
  query,
  expandedFolderIds,
  onQueryChange,
  onToggleFolder,
  onSelectNode,
}: {
  fileTree: ProjectFileNode[];
  selectedNode?: ProjectFileNode;
  selectedNodeId?: string;
  query: string;
  expandedFolderIds: Set<string>;
  onQueryChange: (query: string) => void;
  onToggleFolder: (node: ProjectFileNode) => void;
  onSelectNode: (node: ProjectFileNode) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="min-h-0 overflow-auto border-r bg-[var(--app-panel)] p-sm transition-colors duration-300">
        <ProjectFileExplorer
          fileTree={fileTree}
          selectedNodeId={selectedNodeId}
          expandedFolderIds={expandedFolderIds}
          query={query}
          variant="code"
          onQueryChange={onQueryChange}
          onToggleFolder={onToggleFolder}
          onSelectNode={onSelectNode}
        />
      </div>
      <CodeContentPanel node={selectedNode} />
    </div>
  );
}

function CodeContentPanel({ node }: { node?: ProjectFileNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)] transition-colors duration-300">
      <header className="flex h-12 shrink-0 items-center justify-between gap-sm border-b border-[var(--app-border)] bg-[var(--app-control)] px-sm transition-colors duration-300">
        <div className="flex min-w-0 items-center gap-xs">
          <span className="truncate rounded-t-md bg-[var(--app-panel)] px-sm py-xs text-[12px] font-[520]">
            {node?.path ?? "Select a file"}
          </span>
        </div>
        <div className="flex items-center gap-sm text-[12px] text-[var(--app-muted)]">
          <span>Read only</span>
          <button
            className="inline-flex h-8 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm"
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" size={14} />
          </button>
          <button
            className="inline-flex h-8 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm"
            type="button"
          >
            <Copy aria-hidden="true" size={14} />
          </button>
          <button
            className="inline-flex h-8 items-center gap-xs rounded-md border border-[var(--app-border)] bg-[var(--app-control)] px-sm"
            type="button"
          >
            <Download aria-hidden="true" size={14} />
            Download
          </button>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-md">
        {node?.content ? (
          node.contentType?.startsWith("image/") ? (
            <div className="flex min-h-full items-center justify-center bg-[var(--app-control)] p-md">
              <pre className="whitespace-pre-wrap break-words text-[12px] text-[var(--app-text)]">
                {node.content}
              </pre>
            </div>
          ) : (
            <pre className="builder-truncate-safe min-w-0 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[var(--app-control)] p-sm font-mono text-[12px] leading-4 text-[var(--app-text)] transition-colors duration-300 [overflow-wrap:anywhere]">
              {node.content}
            </pre>
          )
        ) : (
          <p className="m-0 rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-sm text-[12px] leading-4 text-[var(--app-icon-muted)] transition-colors duration-300">
            Select a file to inspect its content. Folders expand in the file
            tree and do not show content here.
          </p>
        )}
      </div>
    </section>
  );
}

function buildProjectMessageStreamUrl(
  projectId: string,
  agentMessageId: string,
) {
  return `/api/projects/${encodeURIComponent(projectId)}/messages/${encodeURIComponent(agentMessageId)}/stream`;
}

function firstFileNode(nodes: ProjectFileNode[]): ProjectFileNode | undefined {
  for (const node of nodes) {
    if (node.type === "file") return node;
    const child = firstFileNode(node.children ?? []);
    if (child) return child;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMaxChatWidth(): number {
  return Math.max(MIN_CHAT_WIDTH, Math.floor(window.innerWidth * 0.55));
}

function findNode(
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
