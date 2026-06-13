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
  Laptop,
  Loader2,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  RefreshCw,
  Settings,
  Smartphone,
  Square,
  Tablet,
  TriangleAlert,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PreviewInitPanel } from "@/components/projects/PreviewInitPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CLIENT_SKELETON_LABELS,
  createInitialChatState,
  type DevRuntimeUIState,
} from "@/features/agents/ui/agent-event-reducer";
import { useChatStream as useAgentStream } from "@/features/agents/ui/use-chat-stream";
import {
  isProjectPreviewStartAvailable,
  isProjectPreviewTemporarilyUnavailable,
} from "@/features/agents/ui/preview-availability";
import {
  buildPreviewUrl,
  normalizePreviewPath,
} from "@/features/agents/ui/preview-path";
import { useUserPresence } from "@/hooks/useUserPresence";
import { ChatPanelMeta, ChatPanelTabs } from "@/components/projects/ChatPanelHeader";
import { MessageComposer } from "@/components/projects/MessageComposer";
import { PlanChecklist } from "@/features/agents/ui/PlanChecklist";
import { ProjectDetailTopBar } from "@/components/projects/ProjectDetailTopBar";
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
import { getDevRuntimeState, startPreview, stopPreview } from "@/server/functions/preview";
import type {
  ComposerReasoningEffort,
  Message,
  MessagePage,
  Project,
  ProjectFileNode,
  ProjectWorkspace,
} from "@/shared/project-types";

type DetailMode = "preview" | "code";
type PreviewTokenState = {
  status: "idle" | "refreshing" | "ready" | "failed";
  error: string | null;
  refreshedAt: string | null;
};

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
  const stopProjectPreview = useServerFn(stopPreview);
  const { workspace } = Route.useLoaderData();
  const router = useRouter();
  const { user } = Route.useRouteContext();
  const [project, setProject] = useState<Project | undefined>(
    workspace?.project,
  );
  const [draft, setDraft] = useState("");
  const [reasoningEffort, setReasoningEffort] =
    useState<ComposerReasoningEffort>("high");
  const [planModeEnabled, setPlanModeEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [previewStarting, setPreviewStarting] = useState(false);
  const [previewStopping, setPreviewStopping] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaveError, setSettingsSaveError] = useState<string | null>(
    null,
  );
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState<string | null>(
    null,
  );
  const [settingsProjectName, setSettingsProjectName] = useState(
    workspace?.project.name ?? "",
  );
  const [settingsSelectedStoreSlug, setSettingsSelectedStoreSlug] = useState<
    string | null
  >(workspace?.project.selectedStoreSlug ?? null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [previewStartError, setPreviewStartError] = useState<string | null>(
    null,
  );
  const [previewTokenState, setPreviewTokenState] = useState<PreviewTokenState>(
    { status: "idle", error: null, refreshedAt: null },
  );
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
  const previewStartPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewStopPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling constants for preview start/stop confirmation.
  // After starting/stopping a preview, the server publishes a runtime event
  // after a 5s settle delay. As a reliable fallback, the client polls the
  // runtime state endpoint every 3s and stops once the expected status is
  // confirmed.
  const PREVIEW_POLL_INTERVAL_MS = 3000;
  const PREVIEW_POLL_TIMEOUT_MS = 30_000;
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
  const hasRecordedActiveRun = Boolean(project?.activeRunId);
  // The live run is the source of truth for "agent is working right now".
  // On first load before the stream connects, fall back to project state so the
  // UI shows processing for a run that's already in flight.
  const streamConnected = chatState.activeRun !== null;
  const isProcessing = streamConnected
    ? chatState.activeRun!.status === "streaming"
    : project?.processingStatus === "processing" && hasRecordedActiveRun;

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
    if (chatState.runtime.status !== "idle") {
      runtime = chatState.runtime;
    } else if (chatState.runtime.previewReloadRequestedAt) {
      runtime = {
        ...runtime,
        previewReloadRequestedAt: chatState.runtime.previewReloadRequestedAt,
        previewReloadDelayMs: chatState.runtime.previewReloadDelayMs,
        previewReloadReason: chatState.runtime.previewReloadReason,
      };
    }
    return runtime;
  }, [
    chatState.runtime,
    manualRuntime,
    runtimeQuery.data,
    workspace?.devRuntime,
  ]);
  const refreshPreviewToken = useCallback(
    async (projectId: string, signal?: AbortSignal) => {
      setPreviewTokenState({
        status: "refreshing",
        error: null,
        refreshedAt: null,
      });
      const timeout = new AbortController();
      const timer = window.setTimeout(() => timeout.abort(), 15000);
      const abort = () => timeout.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await fetch(
          `/api/projects/${projectId}/preview-token/refresh`,
          {
            method: "POST",
            credentials: "include",
            signal: timeout.signal,
          },
        );
        if (!response.ok) throw new Error("Unable to refresh preview access.");
        setPreviewTokenState({
          status: "ready",
          error: null,
          refreshedAt: new Date().toISOString(),
        });
        setPreviewStartError(null);
        return true;
      } catch (cause) {
        if (signal?.aborted) return false;
        const message =
          cause instanceof Error && cause.name === "AbortError"
            ? "Timed out while preparing secure preview access."
            : "Unable to refresh preview access.";
        setPreviewTokenState({
          status: "failed",
          error: message,
          refreshedAt: null,
        });
        setPreviewStartError(message);
        return false;
      } finally {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    },
    [],
  );

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

  // Clean up preview polling intervals on unmount so they don't leak across
  // project switches or navigation away from the detail page.
  useEffect(() => {
    return () => {
      if (previewStartPollRef.current) {
        clearInterval(previewStartPollRef.current);
        previewStartPollRef.current = null;
      }
      if (previewStopPollRef.current) {
        clearInterval(previewStopPollRef.current);
        previewStopPollRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    agentStream.reset(workspace?.messages ?? []);
    setProject(workspace?.project);
    setSendError(undefined);
    setPreviewStarting(false);
    setPreviewStopping(false);
    // Stop any in-flight preview polling when the workspace reference
    // changes (project switch, run completion refresh).
    if (previewStartPollRef.current) {
      clearInterval(previewStartPollRef.current);
      previewStartPollRef.current = null;
    }
    if (previewStopPollRef.current) {
      clearInterval(previewStopPollRef.current);
      previewStopPollRef.current = null;
    }
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
    if (
      !project?.id ||
      detailMode !== "preview" ||
      runtimeState.status !== "running" ||
      !runtimeState.previewUrl
    ) {
      setPreviewTokenState({ status: "idle", error: null, refreshedAt: null });
      return;
    }
    const abortController = new AbortController();
    void refreshPreviewToken(project.id, abortController.signal);
    const interval = window.setInterval(
      () => void refreshPreviewToken(project.id, abortController.signal),
      10 * 60 * 1000,
    );
    return () => {
      abortController.abort();
      window.clearInterval(interval);
    };
  }, [
    detailMode,
    project?.id,
    refreshPreviewToken,
    runtimeState.previewUrl,
    runtimeState.status,
  ]);

  useEffect(() => {
    if (!runtimeState.previewReloadRequestedAt) return;
    const delayMs = runtimeState.previewReloadDelayMs ?? 5000;
    const timer = window.setTimeout(() => {
      setPreviewReloadKey((current) => current + 1);
      if (
        project?.id &&
        runtimeState.status === "running" &&
        runtimeState.previewUrl
      ) {
        void refreshPreviewToken(project.id);
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [
    project?.id,
    refreshPreviewToken,
    runtimeState.previewReloadDelayMs,
    runtimeState.previewReloadRequestedAt,
    runtimeState.previewUrl,
    runtimeState.status,
  ]);

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
          ? {
              ...currentProject,
              processingStatus: "idle",
              activeRunId: undefined,
            }
          : currentProject,
      );
      // Auto-start the preview when the run completed successfully (init or an
      // edit). On failure/stop we leave the preview alone so the user never sees
      // a broken storefront — they read the error and retry/refine instead.
      if (
        chatState.lastRunOutcome === "completed" &&
        project?.id &&
        runtimeState.status !== "running" &&
        !previewStarting
      ) {
        void handleStartPreview();
      }
      if (project?.id) {
        // Refresh derived data the run may have changed. Do NOT call
        // router.invalidate() here — it re-runs the route loader, which
        // returns a new workspace reference and triggers the reset
        // useEffect at line 342, wiping preview/file/code state and
        // looking like a page reload mid-handling. setProject above
        // already keeps the project status in sync.
        void queryClient.invalidateQueries({
          queryKey: ["project-files", project.id],
        });
        void queryClient.invalidateQueries({
          queryKey: ["project-preview", project.id],
        });
        void queryClient.invalidateQueries({
          queryKey: ["project-runs", project.id],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatState.activeRun?.runId, project?.id, queryClient]);

  useEffect(() => {
    if (project?.processingStatus !== "processing" || project.activeRunId) return;
    setProject((currentProject) =>
      currentProject?.processingStatus === "processing" && !currentProject.activeRunId
        ? {
            ...currentProject,
            processingStatus: "idle",
            activeRunId: undefined,
          }
        : currentProject,
    );
  }, [project?.activeRunId, project?.processingStatus]);

  const handleSaveProjectSettings = useCallback(
    async (settings: { name?: string; selectedStoreSlug?: string | null }) => {
      if (!project || settingsSaving) return;
      setSettingsSaving(true);
      setSettingsSaveError(null);
      setSettingsSaveSuccess(null);

      try {
        const updatedProject = await saveProjectSettings({
          data: {
            projectId: project.id,
            name: settings.name ?? settingsProjectName,
            selectedStoreSlug:
              settings.selectedStoreSlug ?? settingsSelectedStoreSlug ?? null,
          },
        });
        setProject(updatedProject);
        setSettingsProjectName(updatedProject.name);
        setSettingsSelectedStoreSlug(updatedProject.selectedStoreSlug ?? null);
        queryClient.setQueryData(
          ["project-workspace", project.id],
          (current: ProjectWorkspace | undefined) =>
            current ? { ...current, project: updatedProject } : current,
        );
        setSettingsSaveSuccess("Project settings saved.");
      } catch (cause) {
        setSettingsSaveError(
          cause instanceof Error
            ? cause.message
            : "Unable to save project settings.",
        );
      } finally {
        setSettingsSaving(false);
      }
    },
    [
      project,
      queryClient,
      saveProjectSettings,
      settingsProjectName,
      settingsSaving,
      settingsSelectedStoreSlug,
    ],
  );

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
      setDeleteError(
        cause instanceof Error ? cause.message : "Unable to delete project.",
      );
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

  async function handleSelectOption(
    messageId: string,
    optionId: string,
  ): Promise<boolean> {
    if (!project) return false;
    const message = messages.find((item) => item.id === messageId);
    if (!message?.runId) return false;
    setSendError(undefined);
    const result = await agentStream.submitAnswer(message.runId, { optionId });
    if (!result.ok) {
      setSendError(result.message);
      return false;
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
    return true;
  }

  function handleStopGeneration() {
    if (!project?.activeRunId) return;
    const runId = project.activeRunId;
    // Optimistic: flip the UI to "Stopping…" and free the composer immediately.
    agentStream.markStopping();
    setProject((currentProject) =>
      currentProject
        ? {
            ...currentProject,
            processingStatus: "idle",
            activeRunId: undefined,
          }
        : currentProject,
    );
    // Fire-and-forget; the run.stopped event will clear the skeleton.
    void agentStream.stopRun(runId).catch(() => {
      // ignore — the SSE terminal event reconciles UI state
    });
  }

  const handleStartPreview = useCallback(async () => {
    if (!project?.id || previewStarting) return;
    if (
      !isProjectPreviewStartAvailable({
        projectStatus: project.status,
        runtimeStatus: runtimeState.status,
        previewUrl: runtimeState.previewUrl,
      })
    )
      return;
    setPreviewStarting(true);
    setPreviewStartError(null);
    setPreviewDraftPath("/");
    setPreviewCommittedPath("/");
    setPreviewPathError(null);
    setPreviewReloadKey(0);
    // Optimistic: show starting immediately. The server confirms via the
    // delayed runtime event (5s) and the polling loop below.
    setManualRuntime((current) => ({
      ...(current ?? createInitialChatState().runtime),
      status: "starting",
      error: null,
      errorTier: null,
    }));

    // Clear any leftover polling from a previous attempt.
    if (previewStartPollRef.current) {
      clearInterval(previewStartPollRef.current);
      previewStartPollRef.current = null;
    }

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
      // Optimistic: mark running so the iframe can mount while polling
      // confirms the real status from the server.
      setManualRuntime((current) => ({
        ...(current ?? createInitialChatState().runtime),
        status: "running",
        previewUrl: result.previewUrl,
        previewPort: result.port,
        error: null,
        errorTier: null,
      }));
      await refreshPreviewToken(project.id);

      // Poll the server every 3s until the runtime is confirmed running,
      // then stop polling. Fallback for the delayed runtime event.
      const projectId = project.id;
      const startedAt = Date.now();
      previewStartPollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > PREVIEW_POLL_TIMEOUT_MS) {
          if (previewStartPollRef.current) {
            clearInterval(previewStartPollRef.current);
            previewStartPollRef.current = null;
          }
          return;
        }
        try {
          const state = await getRuntimeState({ data: { projectId } });
          if (state.status === "running") {
            // Confirmed — stop polling and sync the query cache.
            if (previewStartPollRef.current) {
              clearInterval(previewStartPollRef.current);
              previewStartPollRef.current = null;
            }
            await queryClient.invalidateQueries({
              queryKey: ["project-runtime", projectId],
            });
            // The confirmed state now comes from runtimeQuery via the SSE
            // event + polling; clear manualRuntime so we stop overriding it.
            setManualRuntime(null);
          }
        } catch {
          // Ignore transient polling errors; keep polling until timeout.
        }
      }, PREVIEW_POLL_INTERVAL_MS);
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
  }, [
    getRuntimeState,
    project?.id,
    previewStarting,
    queryClient,
    refreshPreviewToken,
    runtimeState.previewUrl,
    runtimeState.status,
    startProjectPreview,
    project,
  ]);

  const handleStopPreview = useCallback(async () => {
    if (!project?.id || previewStopping || runtimeState.status !== "running") return;
    setPreviewStopping(true);
    setPreviewStartError(null);
    setPreviewTokenState({ status: "idle", error: null, refreshedAt: null });
    // Optimistic: show stopped immediately while polling confirms.
    setManualRuntime((current) => ({
      ...(current ?? createInitialChatState().runtime),
      status: "stopped",
      previewUrl: null,
      previewPort: null,
      error: null,
      errorTier: null,
    }));

    // Clear any leftover polling from a previous attempt.
    if (previewStopPollRef.current) {
      clearInterval(previewStopPollRef.current);
      previewStopPollRef.current = null;
    }

    try {
      const result = await stopProjectPreview({
        data: { projectId: project.id },
      });
      if (!result.success) {
        setPreviewStartError(result.error);
      }

      // Poll the server every 3s until the runtime is confirmed stopped,
      // then stop polling.
      const projectId = project.id;
      const startedAt = Date.now();
      previewStopPollRef.current = setInterval(async () => {
        if (Date.now() - startedAt > PREVIEW_POLL_TIMEOUT_MS) {
          if (previewStopPollRef.current) {
            clearInterval(previewStopPollRef.current);
            previewStopPollRef.current = null;
          }
          return;
        }
        try {
          const state = await getRuntimeState({ data: { projectId } });
          if (state.status === "stopped") {
            if (previewStopPollRef.current) {
              clearInterval(previewStopPollRef.current);
              previewStopPollRef.current = null;
            }
            await queryClient.invalidateQueries({
              queryKey: ["project-runtime", projectId],
            });
            setManualRuntime(null);
          }
        } catch {
          // Ignore transient polling errors.
        }
      }, PREVIEW_POLL_INTERVAL_MS);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Unable to stop preview.";
      setPreviewStartError(message);
      await queryClient.invalidateQueries({ queryKey: ["project-runtime", project.id] });
    } finally {
      setPreviewStopping(false);
    }
  }, [
    getRuntimeState,
    project?.id,
    previewStopping,
    queryClient,
    runtimeState.status,
    stopProjectPreview,
  ]);

  return (
    <main
      className={`project-detail-shell ${resizingChat ? "cursor-col-resize select-none" : ""}`}
    >
      {workspace && project ? (
        <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
          <ProjectDetailTopBar
            project={project}
            processing={isProcessing}
            detailMode={detailMode}
            chatVisible={chatVisible}
            previewRunning={runtimeState.status === "running"}
            previewStopping={previewStopping}
            user={user}
            onModeChange={setDetailMode}
            onStopPreview={handleStopPreview}
            onOpenSettings={() => setSettingsOpen(true)}
            onToggleChat={toggleChat}
          />

          <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <div
            className="project-chat-panel"
            style={{
              width: chatVisible ? chatWidth : 0,
              borderRightWidth: chatVisible ? undefined : 0,
              transitionDuration: resizingChat ? "0ms" : undefined,
            }}
          >
            <ChatPanelTabs
              activeTab="chat"
              fileCount={countFileNodes(workspace.fileTree)}
              versionCount={countRunVersions(messages)}
              onTabChange={(tab) => {
                if (tab === "files") setDetailMode("code");
              }}
            />
            <ChatPanelMeta
              domain={project.selectedStoreSlug ? `${project.selectedStoreSlug}.lumen.app` : null}
              messageCount={messages.length}
            />

            <div className="min-h-0 flex-1 overflow-hidden px-3">
              <div className="flex h-full min-h-0 flex-col gap-2">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProjectMessagesPanel
                    messages={messages}
                    skeleton={
                      chatState.activeRun?.skeleton ??
                      // Fallback: if the project is processing but the SSE
                      // stream hasn't reconnected yet (page reload, brief
                      // network blip), still show a generic processing
                      // affordance so the user sees the agent is working.
                      (isProcessing
                        ? {
                            phase: "starting",
                            label: CLIENT_SKELETON_LABELS.starting,
                          }
                        : null)
                    }
                    loadingOlder={loadingOlder}
                    hasMore={hasMoreMessages}
                    onLoadOlder={loadOlderMessages}
                    onRetryMessage={handleRetryMessage}
                    onSelectOption={handleSelectOption}
                    onPlanAction={async (message, action) => {
                      if (!message.runId) return;
                      const result = await agentStream.submitAnswer(
                        message.runId,
                        {
                          planAction: action,
                        },
                      );
                      if (!result.ok) {
                        setSendError(result.message);
                      }
                    }}
                    awaitingPlanReviewRunId={
                      chatState.activeRun?.status === "awaiting_input"
                        ? chatState.activeRun.runId
                        : null
                    }
                    onSubmitFreeText={async (message, freeText) => {
                      if (!message.runId) return false;
                      const result = await agentStream.submitAnswer(
                        message.runId,
                        {
                          freeText,
                        },
                      );
                      if (!result.ok) {
                        setSendError(result.message);
                        return false;
                      }
                      return true;
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="shrink-0 px-3 pb-2">
              <PlanChecklist
                tasks={chatState.activeRun?.tasks ?? null}
                statuses={chatState.activeRun?.taskStatuses ?? {}}
                runClosed={chatState.activeRun === null}
              />
            </div>

            <div className="shrink-0 border-t border-hairline bg-paper/95 px-3 py-3">
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

          <Button
            type="button"
            className={`left-0 z-40 group relative w-2 shrink-0 cursor-col-resize touch-none border-0 p-0 outline-none transition-[opacity] duration-200 ${chatVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
            aria-label="Resize chat panel"
            onPointerDown={beginResize}
            onPointerMove={resize}
            onPointerUp={endResize}
            onPointerCancel={endResize}
            onLostPointerCapture={endResize}
          >
            <span
              className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-hairline-soft transition-colors duration-200 group-hover:bg-ink"
              aria-hidden="true"
            />
          </Button>

          <section className="project-preview-shell">
            <PreviewToolbar
              previewDraftPath={previewDraftPath}
              previewPathError={previewPathError}
              previewReady={previewReady}
              previewControlsLoading={previewControlsLoading}
              activePreviewUrl={activePreviewUrl}
              runtimeState={runtimeState}
              previewStopping={previewStopping}
              projectStatus={project.status}
              onPathChange={handlePreviewPathChange}
              onPathSubmit={handlePreviewReload}
              onPathReset={handlePreviewPathReset}
              onStopPreview={handleStopPreview}
            />
            <div className="min-h-0 flex-1 overflow-hidden p-2 lg:p-3">
              <div className="project-preview-frame">
                {detailMode === "preview" ? (
                  <PreviewWorkspace
                    previewUrl={activePreviewUrl}
                    previewReloadKey={previewReloadKey}
                    runtimeState={runtimeState}
                    projectId={project?.id ?? ""}
                    previewStarting={previewStarting}
                    projectStatus={project.status}
                    previewTokenState={previewTokenState}
                    onRefreshPreviewToken={() =>
                      project?.id
                        ? void refreshPreviewToken(project.id)
                        : undefined
                    }
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
            {runtimeState.status === "running" ? (
              <div className="build-status-pill" aria-live="polite">
                <span className="build-status-dot" aria-hidden="true" />
                Build · live
                <span className="text-paper/50" aria-hidden="true">·</span>
                <span>v12</span>
              </div>
            ) : null}
          </section>
          </div>
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
        <div className="p-4">
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
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: <Loader2 aria-hidden="true" className="animate-spin" size={12} />,
      };
    case "installed":
      return {
        label:
          state.durationMs !== null
            ? `Installed (${(state.durationMs / 1000).toFixed(1)}s)`
            : "Installed",
        tone: "border-success-bg bg-success-bg text-success-fg",
        icon: <CheckCircle2 aria-hidden="true" size={12} />,
      };
    case "starting":
      return {
        label: "Starting...",
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: <Loader2 aria-hidden="true" className="animate-spin" size={12} />,
      };
    case "running":
      return {
        label: "Running",
        tone: "border-success-bg bg-success-bg text-success-fg",
        icon: <CheckCircle2 aria-hidden="true" size={12} />,
      };
    case "stopped":
      return {
        label: previewStarting ? "Resuming..." : "Stopped",
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
        icon: previewStarting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={12} />
        ) : (
          <TriangleAlert aria-hidden="true" size={12} />
        ),
      };
    case "error":
      return {
        label: state.error ? `Error: ${state.error}` : "Error",
        tone: "border-[rgb(var(--color-hairline-soft))] bg-[rgb(var(--color-danger-bg))] text-[rgb(var(--color-danger-fg))]",
        icon: <TriangleAlert aria-hidden="true" size={12} />,
      };
    case "fixing":
      return {
        label: `Fixing error (attempt ${state.fixAttempt ?? "?"}/3)...`,
        tone: "border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))]",
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
    <header className="shrink-0 border-b border-[rgb(var(--color-hairline))] p-2">
      <div className="flex min-w-0 items-start gap-2">
        <Button
          className="mt-xxs inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))] transition-colors duration-200 hover:text-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
          type="button"
          onClick={onBack}
          aria-label="Back to projects"
        >
          <ArrowLeft aria-hidden="true" size={16} />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 truncate text-[14px] font-[580] leading-4 tracking-[-0.015em]">
            {project.name}
          </h1>

          <div className="mt-1 flex flex-wrap gap-1 text-[12px] leading-4 text-[rgb(var(--color-muted))]">
            <span className="rounded-pill bg-[rgb(var(--color-chalk))] px-1 py-xxs">
              {project.status !== 0 ? statusLabel[project.status] : "Inactive"}
            </span>
            {processing ? (
              <span className="inline-flex items-center gap-0.5 rounded-pill bg-[var(--color-block-lime)] px-1 py-xxs text-[rgb(var(--color-paper))]">
                <Loader2
                  aria-hidden="true"
                  className="animate-spin text-[rgb(var(--color-paper))]"
                  size={12}
                />
                Agent working
              </span>
            ) : null}
            <span className="rounded-pill bg-[rgb(var(--color-chalk))] px-1 py-xxs">
              Edited {new Date(project.updatedAt).toLocaleDateString("en-US")}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))] transition-colors duration-200 hover:text-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
            type="button"
            onClick={onOpenSettings}
            aria-label="Open project settings"
          >
            <Settings aria-hidden="true" size={16} />
          </Button>
          <Button
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] text-[rgb(var(--color-muted))] transition-colors duration-200 hover:text-[rgb(var(--color-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
            type="button"
            onClick={onToggleChat}
            aria-label="Hide chat"
          >
            <PanelLeftClose aria-hidden="true" size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}

function PreviewToolbar({
  previewDraftPath,
  previewPathError,
  previewReady,
  previewControlsLoading,
  activePreviewUrl,
  runtimeState,
  previewStopping,
  projectStatus,
  onPathChange,
  onPathSubmit,
  onPathReset,
  onStopPreview,
}: {
  previewDraftPath: string;
  previewPathError: string | null;
  previewReady: boolean;
  previewControlsLoading: boolean;
  activePreviewUrl: string | null;
  runtimeState: DevRuntimeUIState;
  previewStopping: boolean;
  projectStatus: Project["status"];
  onPathChange: (path: string) => void;
  onPathSubmit: () => void;
  onPathReset: () => void;
  onStopPreview: () => void;
}) {
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({
    projectStatus,
  });
  const pathInputId = "preview-path";
  const [activeDevice, setActiveDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const versionLabel = "v12";
  const lastBuildLabel = runtimeState.status === "running" ? "last build 23s ago" : "no preview";

  return (
    <header className="preview-toolbar">
      {/* Left: Device toggle */}
      <div className="flex items-center gap-2">
        <div className="preview-device-group" role="group" aria-label="Device preview">
          <button
            type="button"
            className={`preview-device-btn ${activeDevice === "desktop" ? "preview-device-btn-active" : ""}`}
            onClick={() => setActiveDevice("desktop")}
            aria-label="Desktop"
            title="Desktop"
          >
            <Laptop aria-hidden="true" size={14} />
          </button>
          <button
            type="button"
            className={`preview-device-btn ${activeDevice === "tablet" ? "preview-device-btn-active" : ""}`}
            onClick={() => setActiveDevice("tablet")}
            aria-label="Tablet"
            title="Tablet — visual only"
          >
            <Tablet aria-hidden="true" size={14} />
          </button>
          <button
            type="button"
            className={`preview-device-btn ${activeDevice === "mobile" ? "preview-device-btn-active" : ""}`}
            onClick={() => setActiveDevice("mobile")}
            aria-label="Mobile"
            title="Mobile — visual only"
          >
            <Smartphone aria-hidden="true" size={14} />
          </button>
        </div>
      </div>

      {/* Center: URL pill */}
      <div className="preview-url-pill">
        <Globe aria-hidden="true" size={14} className="text-muted shrink-0" />
        <label htmlFor={pathInputId} className="flex-1 min-w-0">
          <Input
            id={pathInputId}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-ui-sm text-ink outline-none placeholder:text-subtle disabled:cursor-not-allowed disabled:text-muted"
            value={previewDraftPath}
            placeholder="/ — type a path, press Enter"
            disabled={!previewReady}
            aria-invalid={previewPathError ? "true" : undefined}
            onChange={(event) => onPathChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onPathSubmit();
              if (event.key === "Escape") onPathReset();
            }}
          />
        </label>
        {previewPathError ? (
          <span className="text-eyebrow text-danger-fg shrink-0 truncate max-w-[200px]" title={previewPathError}>
            {previewPathError}
          </span>
        ) : (
          <>
            <span aria-hidden="true" className="text-subtle">·</span>
            <span className="text-eyebrow font-mono text-muted shrink-0">{versionLabel}</span>
            <span aria-hidden="true" className="text-subtle">·</span>
            <span className="text-eyebrow text-muted shrink-0">{lastBuildLabel}</span>
          </>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        {previewTemporarilyUnavailable ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-chalk px-2 text-eyebrow text-muted">
            <Loader2 aria-hidden="true" className="animate-spin" size={12} />
            Building…
          </span>
        ) : null}
        <Button
          variant="unstyled"
          type="button"
          onClick={onPathSubmit}
          disabled={!previewReady || previewControlsLoading || previewStopping}
          aria-label="Reload preview"
          title="Reload preview"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-ink hover:bg-ink/[0.04] transition-colors duration-base"
        >
          {previewControlsLoading ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={14} />
          ) : (
            <RefreshCw aria-hidden="true" size={14} />
          )}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          onClick={onStopPreview}
          disabled={runtimeState.status !== "running" || previewStopping}
          aria-label="Stop preview"
          title="Stop preview"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-danger-bg hover:text-danger-fg disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-base"
        >
          {previewStopping ? (
            <Loader2 aria-hidden="true" className="animate-spin" size={14} />
          ) : (
            <Square aria-hidden="true" size={13} />
          )}
        </Button>
        <Button
          variant="unstyled"
          type="button"
          disabled
          aria-label="Inspect"
          title="Inspect — coming soon"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted opacity-60"
        >
          <Code2 aria-hidden="true" size={14} />
        </Button>
        {activePreviewUrl ? (
          <a
            href={activePreviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-ink hover:bg-ink/[0.04] transition-colors duration-base"
            aria-label="Open preview in new tab"
            title="Open preview"
          >
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ) : (
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted opacity-60"
            aria-label="Open preview"
            title="Preview not available"
          >
            <ExternalLink aria-hidden="true" size={14} />
          </span>
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
  previewTokenState: PreviewTokenState;
  previewStartError: string | null;
  onStartPreview: () => void;
  onRefreshPreviewToken: () => void;
}) {
  const showIframe = !!previewUrl;
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({
    projectStatus,
  });
  const showInitPanel =
    !previewTemporarilyUnavailable &&
    ["idle", "stopped", "error"].includes(runtimeState.status) &&
    runtimeState.status !== "running";
  return (
    <section className="preview-theme-isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper transition-colors duration-300">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper transition-colors duration-300">
        {showIframe ? (
          <iframe
            key={`${previewUrl}:${previewTokenState.refreshedAt ?? "ready"}:${previewReloadKey}`}
            src={previewUrl}
            className="h-full w-full border-0"
            style={{
              colorScheme: "light",
              backgroundColor: "rgb(var(--color-surface))",
            }}
            title="Project preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : runtimeState.status === "running" &&
          runtimeState.previewUrl &&
          previewTokenState.status === "refreshing" ? (
          <div className="flex h-full items-center justify-center text-sm text-[rgb(var(--color-muted))]">
            Preparing secure preview access…
          </div>
        ) : runtimeState.status === "running" &&
          runtimeState.previewUrl &&
          previewTokenState.status === "failed" ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[rgb(var(--color-muted))]">
            <div className="max-w-sm space-y-2 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-surface))] p-4">
              <TriangleAlert
                className="mx-auto text-[rgb(var(--color-ink))]"
                aria-hidden="true"
                size={22}
              />
              <p className="m-0 font-[560] text-[rgb(var(--color-ink))]">
                Could not prepare secure preview access.
              </p>
              <p className="m-0 text-[12px] leading-5">
                {previewTokenState.error ?? "Unable to refresh preview access."}
              </p>
              <p className="m-0 text-[11px] leading-4 text-[rgb(var(--color-muted))]">
                Runtime is running and preview URL is available. Token refresh
                failed.
              </p>
              <Button
                type="button"
                onClick={onRefreshPreviewToken}
                className="inline-flex items-center gap-0.5 rounded-pill border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2 py-1 text-[12px] font-[520] text-[rgb(var(--color-ink))] hover:border-[rgb(var(--color-hairline-soft))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--color-ink) / 0.2)]"
              >
                <RefreshCw aria-hidden="true" size={13} />
                Retry secure access
              </Button>
            </div>
          </div>
        ) : previewTemporarilyUnavailable ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[rgb(var(--color-muted))]">
            <div className="max-w-sm space-y-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-surface))] p-4">
              <Loader2
                className="mx-auto animate-spin text-[rgb(var(--color-muted))]"
                aria-hidden="true"
                size={22}
              />
              <p className="m-0 font-[560] text-[rgb(var(--color-ink))]">
                Your storefront is being prepared.
              </p>
              <p className="m-0 text-[12px] leading-5">
                Preview will be available when setup is complete.
              </p>
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
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[rgb(var(--color-muted))]">
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
    previewReloadRequestedAt: null,
    previewReloadDelayMs: null,
    previewReloadReason: null,
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
      <div className="min-h-0 overflow-auto border-r bg-[rgb(var(--color-surface))] p-2 transition-colors duration-300">
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
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[rgb(var(--color-surface))] transition-colors duration-300">
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2 transition-colors duration-300">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate rounded-t-md bg-[rgb(var(--color-surface))] px-2 py-1 text-[12px] font-[520]">
            {node?.path ?? "Select a file"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[rgb(var(--color-muted))]">
          <span>Read only</span>
          <Button
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2"
            type="button"
          >
            <MessageSquarePlus aria-hidden="true" size={14} />
          </Button>
          <Button
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2"
            type="button"
          >
            <Copy aria-hidden="true" size={14} />
          </Button>
          <Button
            className="inline-flex h-8 items-center gap-1 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] px-2"
            type="button"
          >
            <Download aria-hidden="true" size={14} />
            Download
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto p-4">
        {node?.content ? (
          node.contentType?.startsWith("image/") ? (
            <div className="flex min-h-full items-center justify-center bg-[rgb(var(--color-chalk))] p-4">
              <pre className="whitespace-pre-wrap break-words text-[12px] text-[rgb(var(--color-ink))]">
                {node.content}
              </pre>
            </div>
          ) : (
            <pre className="builder-truncate-safe min-w-0 overflow-x-auto whitespace-pre-wrap break-words rounded-md bg-[rgb(var(--color-chalk))] p-2 font-mono text-[12px] leading-4 text-[rgb(var(--color-ink))] transition-colors duration-300 [overflow-wrap:anywhere]">
              {node.content}
            </pre>
          )
        ) : (
          <p className="m-0 rounded-md border border-[rgb(var(--color-hairline))] bg-[rgb(var(--color-chalk))] p-2 text-[12px] leading-4 text-[rgb(var(--color-muted))] transition-colors duration-300">
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

function countFileNodes(nodes: ProjectFileNode[]): number {
  return nodes.reduce((total, node) => {
    if (node.type === "file") return total + 1;
    return total + countFileNodes(node.children ?? []);
  }, 0);
}

function countRunVersions(messages: Message[]): number {
  const runIds = new Set(
    messages.map((message) => message.runId).filter((runId): runId is string => !!runId),
  );
  return Math.max(1, runIds.size);
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
