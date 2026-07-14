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
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import {
  CLIENT_SKELETON_LABELS,
  createInitialChatState,
  type DevRuntimeUIState,
} from "@/features/agents/ui/agent-event-reducer";
import { useChatStream as useAgentStream } from "@/features/agents/ui/use-chat-stream";
import { isProjectPreviewStartAvailable } from "@/features/agents/ui/preview-availability";
import {
  buildPreviewUrl,
  normalizePreviewPath,
} from "@/features/agents/ui/preview-path";
import { useUserPresence } from "@/hooks/useUserPresence";
import {
  ChatPanelMeta,
  ChatPanelTabs,
} from "@/components/projects/ChatPanelHeader";
import { MessageComposer } from "@/components/projects/MessageComposer";
import { EpisCloudBlockedNotice } from "@/components/profile/EpisCloudBlockedNotice";
import { EpisCloudActivateDialog } from "@/components/profile/EpisCloudActivateDialog";
import { useEpisCloudActivate } from "@/auth/use-episcloud-activate";
import { ProjectDetailTopBar } from "@/components/projects/ProjectDetailTopBar";
import { ProjectMessagesPanel } from "@/components/projects/ProjectMessagesPanel";
import { RunnerDetailPanel } from "./components/RunnerDetailPanel";
import { ProjectDeleteConfirmDialog } from "@/components/projects/ProjectDeleteConfirmDialog";
import { ProjectSettingsDrawer } from "@/components/projects/ProjectSettingsDrawer";
import { listProjectMessages } from "@/server/functions/project-messages";
import {
  deleteProject,
  generateRetailSuggestions,
  updateProjectSettings,
} from "@/server/functions/projects";
import {
  getDevRuntimeState,
  startPreview,
  stopPreview,
} from "@/server/functions/preview";
import type {
  ComposerReasoningEffort,
  Message,
  MessagePage,
  Project,
  ProjectFileNode,
  ProjectWorkspace,
} from "@/shared/project-types";
import { parseGeneratePageCommand } from "@/features/agents/codex/runtime/generate-page";
import { PreviewToolbar } from "./components/PreviewToolbar";
import { PreviewWorkspace } from "./components/PreviewWorkspace";
import { CodeView } from "./components/CodeView";
import {
  CHAT_VISIBLE_KEY,
  CHAT_WIDTH_KEY,
  DEFAULT_CHAT_WIDTH,
  MESSAGE_PAGE_SIZE,
  MIN_CHAT_WIDTH,
  SELECTED_MODEL_KEY,
  type DetailMode,
  type PreviewDevice,
  type PreviewTokenState,
  clamp,
  countFileNodes,
  countRunVersions,
  findNode,
  firstFileNode,
  getMaxChatWidth,
  getProjectMessagesQueryKey,
  toRuntimeUIState,
} from "./utils";

const route = getRouteApi("/projects/$projectId");

export function ProjectDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listMessages = useServerFn(listProjectMessages);
  const removeProject = useServerFn(deleteProject);
  const saveProjectSettings = useServerFn(updateProjectSettings);
  const getRuntimeState = useServerFn(getDevRuntimeState);
  const startProjectPreview = useServerFn(startPreview);
  const stopProjectPreview = useServerFn(stopPreview);
  const fetchRetailSuggestions = useServerFn(generateRetailSuggestions);
  const { workspace } = route.useLoaderData();
  const router = useRouter();
  const { user } = route.useRouteContext();
  const [project, setProject] = useState<Project | undefined>(
    workspace?.project,
  );
  const [draft, setDraft] = useState("");
  const [retailSuggestions, setRetailSuggestions] = useState<string[]>([]);
  const [reasoningEffort, setReasoningEffort] =
    useState<ComposerReasoningEffort>("high");
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [planModeEnabled, setPlanModeEnabled] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [episCloudBlocked, setEpisCloudBlocked] = useState(false);
  const activate = useEpisCloudActivate(() => setEpisCloudBlocked(false));
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
  // runId whose runner-detail view currently occupies the preview shell, or
  // null when the preview/code view is showing. Only one runner's detail shows
  // at a time — the last one whose "Details" footer button was clicked.
  const [runnerDetailRunId, setRunnerDetailRunId] = useState<string | null>(
    null,
  );
  const [activeDevice, setActiveDevice] = useState<PreviewDevice>("desktop");
  const [previewDraftPath, setPreviewDraftPath] = useState("/");
  const [previewCommittedPath, setPreviewCommittedPath] = useState("/");
  // Live location reported by the preview itself (in-preview link clicks,
  // back/forward). Drives the path bar display + "open in new tab" without
  // re-committing the iframe src, so syncing never triggers a reload.
  const [previewLivePath, setPreviewLivePath] = useState("/");
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
  const previewStartPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const previewStopPollRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

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

  // The run is paused waiting on the user. Its runId drives plan-review mode.
  const awaitingInputRunId =
    chatState.activeRun?.status === "awaiting_input"
      ? chatState.activeRun.runId
      : null;

  // The single pending interactive message (design variant / skill
  // clarification / free-text clarification / plan review) the agent is blocked
  // on. It renders as a message INSIDE the runner detail (last item), scoped to
  // its own run. Pick the newest un-answered one; once answered it's gone from
  // state, so the clarification clears itself.
  const pendingClarification = useMemo<Message | null>(() => {
    const interactive = messages.filter(
      (m) =>
        m.kind === "agent_question" ||
        m.kind === "clarification" ||
        m.kind === "plan",
    );
    for (let i = interactive.length - 1; i >= 0; i -= 1) {
      const m = interactive[i];
      const selectedOptionId = (
        m.metadata as { selectedOptionId?: string | null } | null
      )?.selectedOptionId;
      if (m.kind === "plan") {
        // A plan only needs review while its run is the one awaiting input.
        if (m.runId && m.runId === awaitingInputRunId) return m;
        continue;
      }
      if (!selectedOptionId) return m;
    }
    return null;
  }, [messages, awaitingInputRunId]);

  // Inner steps of the runner whose detail view is open, sorted by the panel.
  const runnerDetailSteps = runnerDetailRunId
    ? (chatState.runnerMessages[runnerDetailRunId] ?? [])
    : [];

  // Auto-open the runner detail for a run that's blocked on user input so the
  // clarification message is visible without the user hunting for the Details
  // button. Only forces it open on the transition into a pending state; the
  // user can still close the detail afterward.
  const pendingClarificationRunId = pendingClarification?.runId ?? null;
  const prevPendingClarificationRunIdRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = prevPendingClarificationRunIdRef.current;
    prevPendingClarificationRunIdRef.current = pendingClarificationRunId;
    if (pendingClarificationRunId && pendingClarificationRunId !== previous) {
      setRunnerDetailRunId(pendingClarificationRunId);
    }
  }, [pendingClarificationRunId]);

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

    const savedModel = window.localStorage.getItem(SELECTED_MODEL_KEY);
    if (savedModel) setSelectedModel(savedModel);
  }, []);

  const handleModelChange = useCallback((modelId: string) => {
    setSelectedModel(modelId);
    window.localStorage.setItem(SELECTED_MODEL_KEY, modelId);
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
    setRunnerDetailRunId(null);
    setPreviewDraftPath("/");
    setPreviewCommittedPath("/");
    setPreviewLivePath("/");
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

  // Keep the path bar in sync with navigation happening *inside* the preview
  // (link clicks, back/forward). The preview iframe is cross-origin, so its
  // seeded root posts its location here via postMessage. We only update the
  // displayed path — never previewCommittedPath, which drives the iframe src;
  // re-committing would remount the iframe and fight the navigation the
  // preview just performed.
  useEffect(() => {
    const previewUrl = runtimeState.previewUrl;
    if (!previewUrl) return;
    let previewOrigin: string;
    try {
      previewOrigin = new URL(previewUrl).origin;
    } catch {
      return;
    }
    function handleNavMessage(event: MessageEvent) {
      if (event.origin !== previewOrigin) return;
      const data = event.data;
      if (
        !data ||
        typeof data !== "object" ||
        data.type !== "lumen:preview-nav" ||
        typeof data.path !== "string"
      ) {
        return;
      }
      const normalized = normalizePreviewPath(data.path);
      if (!normalized.ok) return;
      setPreviewLivePath(normalized.path);
      setPreviewDraftPath(normalized.path);
      setPreviewPathError(null);
    }
    window.addEventListener("message", handleNavMessage);
    return () => window.removeEventListener("message", handleNavMessage);
  }, [runtimeState.previewUrl]);

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
  // URL for "open in new tab": tracks the preview's live location so it opens
  // whatever page the user is actually viewing, not the last committed path.
  const livePreviewUrl =
    previewReady && runtimeState.previewUrl
      ? buildPreviewUrl(runtimeState.previewUrl, previewLivePath)
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
  // Slug of a known page the in-flight /generate-page run is authoring, so the
  // composer menu can mark it "designed" the moment the run completes without a
  // full route reload. The server persists the same slug; the two converge.
  const pendingGeneratedSlugRef = useRef<string | null>(null);
  useEffect(() => {
    const current = chatState.activeRun?.runId ?? null;
    const previous = prevActiveRunRef.current;
    prevActiveRunRef.current = current;
    if (previous && !current) {
      const completedSlug =
        chatState.lastRunOutcome === "completed"
          ? pendingGeneratedSlugRef.current
          : null;
      pendingGeneratedSlugRef.current = null;
      setProject((currentProject) => {
        if (
          !currentProject ||
          currentProject.processingStatus !== "processing"
        ) {
          return currentProject;
        }
        const generatedPages =
          completedSlug &&
          !(currentProject.generatedPages ?? []).some(
            (page) => page.slug === completedSlug,
          )
            ? [
                ...(currentProject.generatedPages ?? []),
                { slug: completedSlug, generatedAt: new Date().toISOString() },
              ]
            : currentProject.generatedPages;
        return {
          ...currentProject,
          processingStatus: "idle",
          activeRunId: undefined,
          generatedPages,
        };
      });
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
      // On a successful turn, ask the model for retail-oriented next steps and
      // surface them as clickable chips above the composer. Non-critical: any
      // failure just leaves the chip row empty.
      if (chatState.lastRunOutcome === "completed") {
        const history = chatState.messages;
        const lastUser = [...history].reverse().find((m) => m.role === "user");
        const lastAgent = [...history]
          .reverse()
          .find((m) => m.role === "agent" && m.kind === "answer");
        void fetchRetailSuggestions({
          data: {
            storeName: project?.name,
            recentUserPrompt: lastUser?.content?.slice(0, 1000),
            recentAgentAnswer: lastAgent?.content?.slice(0, 1000),
            generatedPageSlugs: project?.generatedPages?.map((p) => p.slug),
          },
        })
          .then((res) => setRetailSuggestions(res.suggestions))
          .catch(() => setRetailSuggestions([]));
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
    if (project?.processingStatus !== "processing" || project.activeRunId)
      return;
    setProject((currentProject) =>
      currentProject?.processingStatus === "processing" &&
      !currentProject.activeRunId
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

  // Runner-card "Details" footer button. Toggles the right-hand detail view for
  // the clicked run: showing it if hidden (or if a different run's detail was
  // showing), hiding it if this run's detail was already the one showing. Only
  // one run's detail shows at a time.
  function handleToggleRunnerDetails(runId: string) {
    setRunnerDetailRunId((current) => {
      const next = current === runId ? null : runId;
      // Lazy-load the run's inner steps when opening its detail view. Live runs
      // already hold theirs from the SSE stream; this fills archived runs whose
      // steps were never streamed to this client.
      if (next) void agentStream.fetchRunnerMessages(next);
      return next;
    });
  }

  // Runner-card "Preview" footer button. Returns to the preview/code view by
  // clearing the active runner detail.
  function handlePreviewRunner() {
    setRunnerDetailRunId(null);
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
    setRetailSuggestions([]);

    // Remember a known-page /generate-page target so the composer menu can mark
    // it designed once the run completes (server persists it too).
    const parsed = parseGeneratePageCommand(content);
    pendingGeneratedSlugRef.current = parsed?.target.isKnownPage
      ? parsed.target.slug
      : null;

    const result = await agentStream.sendPrompt({
      prompt: content,
      reasoningEffort,
      planMode: planModeEnabled,
      model: selectedModel,
    });
    if (!result.ok) {
      // Preserve the draft so the prompt isn't lost. When the block is an
      // un-activated Epis Cloud account, show the actionable notice instead of
      // the generic error banner — the user can activate inline and re-send.
      setDraft(content);
      if (result.code === "episcloud_not_activated") {
        setEpisCloudBlocked(true);
      } else {
        setSendError(result.message);
      }
      setSending(false);
      return;
    }
    setEpisCloudBlocked(false);
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
    setPreviewLivePath("/");
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
    if (!project?.id || previewStopping || runtimeState.status !== "running")
      return;
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
      await queryClient.invalidateQueries({
        queryKey: ["project-runtime", project.id],
      });
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
                domain={
                  project.selectedStoreSlug
                    ? `${project.selectedStoreSlug}.lumen.app`
                    : null
                }
                messageCount={messages.length}
              />

              <div className="min-h-0 flex-1 overflow-hidden px-3">
                <div className="flex h-full min-h-0 flex-col gap-2">
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ProjectMessagesPanel
                      messages={messages}
                      runnerDetailRunId={runnerDetailRunId}
                      onToggleRunnerDetails={handleToggleRunnerDetails}
                      onPreviewRunner={handlePreviewRunner}
                      activeRunId={chatState.activeRun?.runId ?? null}
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
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-hairline bg-paper/95 px-3 py-3">
                {retailSuggestions.length > 0 && !isProcessing ? (
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs text-subtle">Try next:</span>
                    {retailSuggestions.map((suggestion) => (
                      <Button
                        key={suggestion}
                        type="button"
                        variant="unstyled"
                        className="dashboard-suggestion-chip"
                        onClick={() => setDraft(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <MessageComposer
                  value={draft}
                  reasoningEffort={reasoningEffort}
                  planMode={planModeEnabled}
                  selectedModel={selectedModel}
                  sending={sending}
                  processing={isProcessing}
                  error={sendError}
                  episCloudBlocked={episCloudBlocked}
                  onActivateClick={activate.open}
                  disabled={false}
                  generatedPageSlugs={
                    project.generatedPages?.map((page) => page.slug) ?? []
                  }
                  onChange={setDraft}
                  onReasoningEffortChange={setReasoningEffort}
                  onPlanModeChange={setPlanModeEnabled}
                  onModelChange={handleModelChange}
                  onSend={handleSendMessage}
                  onStop={handleStopGeneration}
                  onScrollMessagesUp={() => scrollMessagesByPage("up")}
                  onScrollMessagesDown={scrollMessagesToLatest}
                />
              </div>
            </div>

            <Button
              type="button"
              variant="unstyled"
              className={`project-resize-handle ${chatVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              data-resizing={resizingChat}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize chat panel"
              onPointerDown={beginResize}
              onPointerMove={resize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
              onLostPointerCapture={endResize}
            >
              <span className="project-resize-handle-line" aria-hidden="true" />
              <span className="project-resize-handle-grip" aria-hidden="true" />
            </Button>

            <section className="project-preview-shell">
              {resizingChat ? (
                <div
                  className="absolute inset-0 z-30 cursor-col-resize"
                  aria-hidden="true"
                />
              ) : null}
              {runnerDetailRunId ? null : (
                <PreviewToolbar
                  previewDraftPath={previewDraftPath}
                  previewPathError={previewPathError}
                  previewReady={previewReady}
                  previewControlsLoading={previewControlsLoading}
                  activePreviewUrl={livePreviewUrl ?? activePreviewUrl}
                  runtimeState={runtimeState}
                  previewStopping={previewStopping}
                  projectStatus={project.status}
                  activeDevice={activeDevice}
                  onDeviceChange={setActiveDevice}
                  onPathChange={handlePreviewPathChange}
                  onPathSubmit={handlePreviewReload}
                  onPathReset={handlePreviewPathReset}
                  onStopPreview={handleStopPreview}
                />
              )}
              <div className="min-h-0 flex-1 overflow-hidden p-2 lg:p-3">
                <div className="project-preview-frame">
                  {runnerDetailRunId ? (
                    <RunnerDetailPanel
                      steps={runnerDetailSteps}
                      runActive={
                        chatState.activeRun?.runId === runnerDetailRunId
                      }
                      onClose={handlePreviewRunner}
                      clarification={
                        pendingClarification?.runId === runnerDetailRunId
                          ? pendingClarification
                          : null
                      }
                      planAwaitingReview={
                        pendingClarification?.kind === "plan" &&
                        chatState.activeRun?.status === "awaiting_input"
                      }
                      onSelectOption={handleSelectOption}
                      onPlanAction={async (message, action) => {
                        if (!message.runId) return;
                        const result = await agentStream.submitAnswer(
                          message.runId,
                          { planAction: action },
                        );
                        if (!result.ok) {
                          setSendError(result.message);
                        }
                      }}
                      onSubmitFreeText={async (message, freeText) => {
                        if (!message.runId) return false;
                        const result = await agentStream.submitAnswer(
                          message.runId,
                          { freeText },
                        );
                        if (!result.ok) {
                          setSendError(result.message);
                          return false;
                        }
                        return true;
                      }}
                    />
                  ) : detailMode === "preview" ? (
                    <PreviewWorkspace
                      previewUrl={activePreviewUrl}
                      previewReloadKey={previewReloadKey}
                      activeDevice={activeDevice}
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
                  <span className="text-paper/50" aria-hidden="true">
                    ·
                  </span>
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

          <EpisCloudActivateDialog
            open={activate.dialogOpen}
            activating={activate.activating}
            error={activate.error}
            onCancel={activate.cancel}
            onConfirm={() => void activate.confirm()}
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
