import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  InfiniteData,
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
  agentEventReducer,
  createInitialAgentEventState,
} from "@/features/ai-agent/ui/agent-event-reducer";
import type { RuntimeUIState } from "@/features/ai-agent/ui/agent-event-reducer";
import { AgentEventTimeline } from "@/features/ai-agent/ui/agent-event-timeline";
import { synthesizeAgentProgressContent, shouldReplaceStaleAgentContent } from "@/features/ai-agent/ui/agent-progress";
import { isProjectPreviewStartAvailable, isProjectPreviewTemporarilyUnavailable } from "@/features/ai-agent/ui/preview-availability";
import { StreamingTextPanel } from "@/features/ai-agent/ui/streaming-text-panel";
import { useUserPresence } from "@/hooks/useUserPresence";
import { UserMenu } from "@/components/auth/UserMenu";
import { MessageComposer } from "@/components/projects/MessageComposer";
import { ProjectFileExplorer } from "@/components/projects/ProjectFileExplorer";
import { ProjectMessagesPanel } from "@/components/projects/ProjectMessagesPanel";
import { ProjectDeleteConfirmDialog } from "@/components/projects/ProjectDeleteConfirmDialog";
import { ProjectSettingsDrawer } from "@/components/projects/ProjectSettingsDrawer";
import { getCurrentUser } from "@/server/functions/auth";
import {
  listProjectMessages,
  retryProjectMessage,
  sendProjectMessage,
  stopProjectGeneration,
} from "@/server/functions/project-messages";
import {
  deleteProject,
  getProjectWorkspace,
  updateProjectSettings,
} from "@/server/functions/projects";
import { getDevRuntimeState, startPreview } from "@/server/functions/preview";
import type { AgentStreamEvent } from "@/features/ai-agent/agent/agent-events";
import type {
  ComposerReasoningEffort,
  Message,
  MessageDeltaEvent,
  MessagePage,
  MessageStartedEvent,
  MessageTerminalEvent,
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

function mapDevRuntimeStatus(s: string): RuntimeUIState["status"] {
  if (s === "installing") return "installing";
  if (s === "installed") return "installed";
  if (s === "starting") return "starting";
  if (s === "running") return "running";
  if (s === "stopped") return "stopped";
  if (s === "fixing") return "fixing";
  if (s === "error") return "error";
  return "idle";
}

type ActiveStream = {
  agentMessageId: string;
  url: string;
  source: EventSource;
  hasTerminalEvent: boolean;
};

const MESSAGE_PAGE_SIZE = 20;

function getProjectMessagesQueryKey(projectId?: string) {
  return ["project-messages", projectId] as const;
}

function mergeMessages(pages: MessagePage[]) {
  const deduped = new Map<string, Message>();
  for (const page of pages) {
    for (const message of page.messages) deduped.set(message.id, message);
  }
  return [...deduped.values()].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

function updateMessagePages(
  data: InfiniteData<MessagePage> | undefined,
  updater: (pages: MessagePage[]) => MessagePage[],
): InfiniteData<MessagePage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: updater(data.pages),
  };
}

function appendMessagesToNewestPage(
  data: InfiniteData<MessagePage> | undefined,
  messages: Message[],
): InfiniteData<MessagePage> | undefined {
  if (!data) {
    return {
      pages: [{ messages, total: messages.length }],
      pageParams: [undefined],
    };
  }
  const pages = [...data.pages];
  if (pages.length === 0) {
    return { ...data, pages: [{ messages, total: messages.length }] };
  }

  const newestPageIndex = 0;
  const newestPage = pages[newestPageIndex];
  const existingIds = new Set(
    pages.flatMap((page) => page.messages.map((message) => message.id)),
  );
  const nextMessages = messages.filter(
    (message) => !existingIds.has(message.id),
  );
  const nextTotal =
    Math.max(...pages.map((page) => page.total), newestPage.total) +
    nextMessages.length;
  pages[newestPageIndex] = {
    ...newestPage,
    messages: [...newestPage.messages, ...nextMessages],
    total: nextTotal,
  };
  return { ...data, pages };
}

function replaceMessageInPages(
  data: InfiniteData<MessagePage> | undefined,
  matcher: (message: Message) => boolean,
  replacement: Message,
): InfiniteData<MessagePage> | undefined {
  if (!data) return data;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) =>
      matcher(message) ? replacement : message,
    ),
  }));
  return { ...data, pages };
}

function updateSingleMessageInPages(
  data: InfiniteData<MessagePage> | undefined,
  messageId: string,
  updater: (message: Message) => Message,
): InfiniteData<MessagePage> | undefined {
  if (!data) return data;
  const pages = data.pages.map((page) => ({
    ...page,
    messages: page.messages.map((message) =>
      message.id === messageId ? updater(message) : message,
    ),
  }));
  return { ...data, pages };
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
  const sendMessage = useServerFn(sendProjectMessage);
  const listMessages = useServerFn(listProjectMessages);
  const retryMessage = useServerFn(retryProjectMessage);
  const stopGeneration = useServerFn(stopProjectGeneration);
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
  const [manualRuntime, setManualRuntime] = useState<RuntimeUIState | null>(
    null,
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode>("preview");
  const [previewPath, setPreviewPath] = useState("/");
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

  const activeStreamRef = useRef<ActiveStream | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentStreamEvent[]>([]);
  const [agentReasoning, setAgentReasoning] = useState("");

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
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = mergeMessages(allPages).length;
      if (loadedCount >= lastPage.total) return undefined;
      return lastPage.nextCursor;
    },
    initialData:
      workspace?.project.id === project?.id
        ? {
            pages: [
              {
                messages: workspace?.messages ?? [],
                nextCursor:
                  (workspace?.messages?.length ?? 0) >= MESSAGE_PAGE_SIZE
                    ? {
                        beforeCreatedAt: workspace?.messages?.[0]?.createdAt,
                        beforeId: workspace?.messages?.[0]?.id,
                      }
                    : undefined,
                total:
                  (workspace?.messages?.length ?? 0) >= MESSAGE_PAGE_SIZE
                    ? (workspace?.messages?.length ?? 0) + 1
                    : (workspace?.messages?.length ?? 0),
              },
            ],
            pageParams: [undefined],
          }
        : undefined,
    enabled: !!project?.id,
    refetchOnMount: true,
  });

  const messages = useMemo(
    () => mergeMessages(messagesQuery.data?.pages ?? []),
    [messagesQuery.data?.pages],
  );

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

  const runtimeState = useMemo<RuntimeUIState>(() => {
    const base = createInitialAgentEventState();
    const runtime = runtimeQuery.data ?? workspace?.devRuntime;
    if (runtime) base.runtime = toRuntimeUIState(runtime);
    if (manualRuntime) base.runtime = manualRuntime;
    return agentEvents.reduce(
      (state, event) => agentEventReducer(state, event),
      base,
    ).runtime;
  }, [agentEvents, manualRuntime, runtimeQuery.data, workspace?.devRuntime]);
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

  const loadedMessageCount = messages.length;
  const totalMessages = messagesQuery.data
    ? Math.max(...messagesQuery.data.pages.map((page) => page.total))
    : messages.length;
  const hasMoreMessages =
    !!messagesQuery.hasNextPage && loadedMessageCount < totalMessages;
  const loadingOlder = messagesQuery.isFetchingNextPage;

  const closeActiveStream = useCallback((agentMessageId?: string) => {
    const activeStream = activeStreamRef.current;
    if (!activeStream) return;
    if (agentMessageId && activeStream.agentMessageId !== agentMessageId)
      return;
    activeStream.source.close();
    activeStreamRef.current = null;
  }, []);

  const connectMessageStream = useCallback(
    (url: string, agentMessageId: string) => {
      const existingStream = activeStreamRef.current;
      if (
        existingStream &&
        existingStream.agentMessageId === agentMessageId &&
        existingStream.url === url
      ) {
        return;
      }

      closeActiveStream();

      const source = new EventSource(url);
      activeStreamRef.current = {
        agentMessageId,
        url,
        source,
        hasTerminalEvent: false,
      };

      const updateMessage = (updater: (message: Message) => Message) => {
        queryClient.setQueryData<InfiniteData<MessagePage>>(
          getProjectMessagesQueryKey(project?.id),
          (current) =>
            updateSingleMessageInPages(current, agentMessageId, updater),
        );
      };

      const handleStarted = (rawEvent: Event) => {
        const event = JSON.parse(
          (rawEvent as MessageEvent<string>).data,
        ) as MessageStartedEvent;
        updateMessage((message) => ({
          ...message,
          processingStatus: event.processingStatus,
          providerResponseId: event.providerResponseId,
          startedAt: message.startedAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
        setProject((currentProject) =>
          currentProject
            ? {
                ...currentProject,
                processingStatus: "processing",
                activeAgentMessageId: event.messageId,
              }
            : currentProject,
        );
      };

      const handleDelta = (rawEvent: Event) => {
        const event = JSON.parse(
          (rawEvent as MessageEvent<string>).data,
        ) as MessageDeltaEvent;
        updateMessage((message) => ({
          ...message,
          content: `${message.content}${event.delta}`,
          processingStatus: "streaming",
          updatedAt: new Date().toISOString(),
        }));
      };

      const handleAgentEvent = (rawEvent: Event) => {
        const event = JSON.parse(
          (rawEvent as MessageEvent<string>).data,
        ) as AgentStreamEvent;
        setAgentEvents((current) => {
          const next = [...current, event];
          if (event.type !== "assistant_message_delta") {
            const synthesized = synthesizeAgentProgressContent(next, [...messages].reverse().find((message) => message.role === "user")?.content);
            updateMessage((message) => shouldReplaceStaleAgentContent(message.content) || message.processingStatus === "streaming"
              ? { ...message, content: synthesized, processingStatus: "streaming", updatedAt: new Date().toISOString() }
              : message,
            );
          }
          return next;
        });
        if (event.type === "assistant_message_delta") {
          setAgentReasoning((prev) => prev + event.delta);
        }
        if (event.type === "clarification_required") {
          setProject((currentProject) =>
            currentProject
              ? {
                  ...currentProject,
                  processingStatus: "idle",
                  activeAgentMessageId:
                    currentProject.activeAgentMessageId === agentMessageId
                      ? undefined
                      : currentProject.activeAgentMessageId,
                  updatedAt: new Date().toISOString(),
                }
              : currentProject,
          );
          void queryClient.invalidateQueries({
            queryKey: ["project-runs", project?.id],
          });
        }
        if (event.type === "dev_ready") {
          setManualRuntime((current) => ({
            ...(current ?? createInitialAgentEventState().runtime),
            status: "running",
            previewUrl: event.previewUrl,
            previewPort: event.port,
            error: null,
            errorTier: null,
          }));
        }
        if (event.type === "done") {
          void queryClient.invalidateQueries({
            queryKey: ["project", project?.id],
          });
          void queryClient.invalidateQueries({
            queryKey: ["project-files", project?.id],
          });
          void queryClient.invalidateQueries({
            queryKey: ["project-runs", project?.id],
          });
          void queryClient.invalidateQueries({
            queryKey: ["project-preview", project?.id],
          });
        }
      };

      const handleTerminal = (rawEvent: Event) => {
        const event = JSON.parse(
          (rawEvent as MessageEvent<string>).data,
        ) as MessageTerminalEvent;
        if (activeStreamRef.current?.agentMessageId === event.messageId) {
          activeStreamRef.current.hasTerminalEvent = true;
        }
        updateMessage((message) => {
          const synthesized = synthesizeAgentProgressContent(agentEvents, [...messages].reverse().find((item) => item.role === "user")?.content, event.content || "Request completed.");
          const nextContent = shouldReplaceStaleAgentContent(event.content) ? synthesized : event.content;
          return {
            ...message,
            content: nextContent,
            processingStatus: event.processingStatus,
            providerResponseId: event.providerResponseId,
            errorMessage: event.error?.message,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        setProject((currentProject) =>
          currentProject
            ? {
                ...currentProject,
                processingStatus: event.projectProcessingStatus,
                activeAgentMessageId:
                  currentProject.activeAgentMessageId === event.messageId
                    ? undefined
                    : currentProject.activeAgentMessageId,
                processingStartedAt:
                  event.projectProcessingStatus === "processing"
                    ? currentProject.processingStartedAt
                    : undefined,
                updatedAt: new Date().toISOString(),
              }
            : currentProject,
        );
        void queryClient.invalidateQueries({
          queryKey: ["project-runs", project?.id],
        });
        setAgentEvents((current) => {
          const last = current.at(-1);
          if (last?.type === "done" || last?.type === "error") return current;
          if (event.type === "message.completed") {
            return [
              ...current,
              {
                type: "done",
                runId: event.messageId,
                summary: event.content || "Request completed.",
                changedFiles: [],
              },
            ];
          }
          return [
            ...current,
            {
              type: "error",
              code: event.error?.code ?? event.type,
              message: event.error?.message ?? (event.type === "message.stopped" ? "Processing stopped." : "Could not complete the request."),
              recoverable: event.type !== "message.stopped",
            },
          ];
        });
        if (event.type === "message.failed" && event.error?.message) {
          setSendError(event.error.message);
        }
        closeActiveStream(agentMessageId);
        void router.invalidate();
      };

      source.addEventListener("agent_event", handleAgentEvent);
      source.addEventListener("message.started", handleStarted);
      source.addEventListener("message.delta", handleDelta);
      source.addEventListener("message.completed", handleTerminal);
      source.addEventListener("message.failed", handleTerminal);
      source.addEventListener("message.stopped", handleTerminal);
      source.onerror = () => {
        const activeStream = activeStreamRef.current;
        if (activeStream?.agentMessageId !== agentMessageId) return;

        const hasTerminalEvent = activeStream.hasTerminalEvent;
        closeActiveStream(agentMessageId);

        if (hasTerminalEvent) return;

        setAgentEvents((current) => {
          const last = current.at(-1);
          if (last?.type === "done" || last?.type === "error") return current;
          return [
            ...current,
            {
              type: "error",
              code: "STREAM_DISCONNECTED",
              message: "Something interrupted the response. You can retry safely.",
              recoverable: true,
            },
          ];
        });
        updateMessage((message) => ({
          ...message,
          content: shouldReplaceStaleAgentContent(message.content)
            ? `${synthesizeAgentProgressContent(agentEvents, [...messages].reverse().find((item) => item.role === "user")?.content)}
- ✕ Something interrupted the response. You can retry safely.`
            : message.content,
          processingStatus: "failed",
          errorMessage: "Something interrupted the response. You can retry safely.",
          updatedAt: new Date().toISOString(),
        }));
        setSendError("Something interrupted the response. You can retry safely.");

        setProject((currentProject) =>
          currentProject
            ? {
                ...currentProject,
                processingStatus: "idle",
                activeAgentMessageId:
                  currentProject.activeAgentMessageId === agentMessageId
                    ? undefined
                    : currentProject.activeAgentMessageId,
                processingStartedAt: undefined,
                updatedAt: new Date().toISOString(),
              }
            : currentProject,
        );
        void queryClient.invalidateQueries({
          queryKey: ["project", project?.id],
        });
        void queryClient.invalidateQueries({
          queryKey: getProjectMessagesQueryKey(project?.id),
        });
        void queryClient.invalidateQueries({
          queryKey: ["project-runs", project?.id],
        });
        void queryClient.invalidateQueries({
          queryKey: ["project-preview", project?.id],
        });
        void router.invalidate();
      };
    },
    [closeActiveStream, project?.id, queryClient, router],
  );

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(CHAT_WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth >= MIN_CHAT_WIDTH) {
      setChatWidth(clamp(savedWidth, MIN_CHAT_WIDTH, getMaxChatWidth()));
    }

    const savedVisible = window.localStorage.getItem(CHAT_VISIBLE_KEY);
    if (savedVisible === "false") setChatVisible(false);
  }, []);

  useEffect(() => {
    closeActiveStream();
    setProject(workspace?.project);
    setSendError(undefined);
    setPreviewStarting(false);
    setPreviewStartError(null);
    setPreviewTokenState({ status: "idle", error: null, refreshedAt: null });
    setManualRuntime(null);
    setAgentEvents([]);
    setAgentReasoning("");
    setSelectedNodeId(firstFileNode(workspace?.fileTree ?? [])?.id);
    setDetailMode("preview");
    setPreviewPath("/");
    setCodeQuery("");
    setExpandedFolderIds(
      new Set(
        (workspace?.fileTree ?? [])
          .filter((node) => node.type === "folder")
          .map((node) => node.id),
      ),
    );
  }, [closeActiveStream, workspace?.project.id, workspace?.fileTree]);

  useEffect(() => () => closeActiveStream(), [closeActiveStream]);

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
  const activeAgentMessage = useMemo(
    () =>
      project?.activeAgentMessageId
        ? messages.find(
            (message) => message.id === project.activeAgentMessageId,
          )
        : undefined,
    [messages, project?.activeAgentMessageId],
  );

  useEffect(() => {
    if (
      !project?.activeAgentMessageId ||
      project.processingStatus !== "processing"
    ) {
      return;
    }
    if (
      activeAgentMessage &&
      ["completed", "failed", "stopped"].includes(
        activeAgentMessage.processingStatus,
      )
    ) {
      return;
    }
    connectMessageStream(
      buildProjectMessageStreamUrl(project.id, project.activeAgentMessageId),
      project.activeAgentMessageId,
    );
  }, [
    activeAgentMessage,
    connectMessageStream,
    project?.activeAgentMessageId,
    project?.id,
    project?.processingStatus,
  ]);


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

    await messagesQuery.fetchNextPage();

    if (container) {
      requestAnimationFrame(() => {
        const newScrollHeight = container.scrollHeight;
        container.scrollTop =
          previousScrollTop + (newScrollHeight - oldScrollHeight);
      });
    }
  }, [hasMoreMessages, loadingOlder, messagesQuery]);

  async function handleRetryMessage(messageId: string) {
    if (!project) return;
    const retriedMessage = await retryMessage({
      data: { projectId: project.id, messageId },
    });
    queryClient.setQueryData<InfiniteData<MessagePage>>(
      getProjectMessagesQueryKey(project.id),
      (current) =>
        replaceMessageInPages(
          current,
          (message) => message.id === retriedMessage.id,
          retriedMessage,
        ),
    );
  }

  async function handleSendMessage(content: string) {
    if (!project) return;
    setSending(true);
    setSendError(undefined);
    setAgentEvents([]);
    setAgentReasoning("");
    setDraft("");

    const clientId = `client-${crypto.randomUUID()}`;
    const optimisticMessage: Message = {
      id: clientId,
      projectId: project.id,
      role: "user",
      content,
      status: "pending",
      processingStatus: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    queryClient.setQueryData<InfiniteData<MessagePage>>(
      getProjectMessagesQueryKey(project.id),
      (current) => appendMessagesToNewestPage(current, [optimisticMessage]),
    );

    try {
      const streamState = await sendMessage({
        data: {
          projectId: project.id,
          content,
          reasoningEffort,
          planMode: planModeEnabled,
        },
      });
      setProject((currentProject) =>
        currentProject
          ? {
              ...currentProject,
              processingStatus: streamState.project.processingStatus,
              activeAgentMessageId: streamState.project.activeAgentMessageId,
              processingStartedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : currentProject,
      );
      queryClient.setQueryData<InfiniteData<MessagePage>>(
        getProjectMessagesQueryKey(project.id),
        (current) => {
          const replacedUser = replaceMessageInPages(
            current,
            (message) => message.id === clientId,
            streamState.userMessage,
          );
          return appendMessagesToNewestPage(replacedUser, [
            streamState.agentMessage,
          ]);
        },
      );
      connectMessageStream(streamState.stream.url, streamState.agentMessage.id);
    } catch (cause) {
      queryClient.setQueryData<InfiniteData<MessagePage>>(
        getProjectMessagesQueryKey(project.id),
        (current) =>
          updateSingleMessageInPages(current, clientId, (message) => ({
            ...message,
            status: "failed",
            processingStatus: "failed",
          })),
      );
      setSendError(
        cause instanceof Error
          ? cause.message
          : "Unable to send message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  async function handleStopGeneration() {
    if (!project?.activeAgentMessageId) return;
    try {
      const result = await stopGeneration({
        data: {
          projectId: project.id,
          agentMessageId: project.activeAgentMessageId,
        },
      });
      setProject(result.project);
      queryClient.setQueryData<InfiniteData<MessagePage>>(
        getProjectMessagesQueryKey(project.id),
        (current) =>
          replaceMessageInPages(
            current,
            (message) => message.id === result.agentMessage.id,
            result.agentMessage,
          ),
      );
      closeActiveStream(result.agentMessage.id);
    } catch (cause) {
      setSendError(
        cause instanceof Error
          ? cause.message
          : "Unable to stop the current response.",
      );
    }
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
    setManualRuntime((current) => ({
      ...(current ?? createInitialAgentEventState().runtime),
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
          ...(current ?? createInitialAgentEventState().runtime),
          status: "error",
          error: result.error,
          errorTier: result.errorTier,
          previewUrl: null,
          previewPort: null,
        }));
        return;
      }
      setManualRuntime((current) => ({
        ...(current ?? createInitialAgentEventState().runtime),
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
        ...(current ?? createInitialAgentEventState().runtime),
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
              processing={project.processingStatus === "processing"}
              onBack={() => void navigate({ to: "/projects" as never })}
              onOpenSettings={() => setSettingsOpen(true)}
              onToggleChat={toggleChat}
            />

            <div className="min-h-0 flex-1 overflow-hidden px-sm">
              <div className="flex h-full min-h-0 flex-col gap-sm">
                {/* <StreamingTextPanel text={agentReasoning} isStreaming={project.processingStatus === "processing"} /> */}
                <div className="builder-scrollbar-hidden max-h-[40vh] shrink-0 overflow-y-auto">
                  <AgentEventTimeline
                    events={agentEvents}
                    userPrompt={[...messages].reverse().find((message) => message.role === "user")?.content}
                  />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ProjectMessagesPanel
                    messages={messages}
                    loadingOlder={loadingOlder}
                    hasMore={hasMoreMessages}
                    onLoadOlder={loadOlderMessages}
                    onRetryMessage={handleRetryMessage}
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
                processing={project.processingStatus === "processing"}
                error={sendError}
                disabled={project.processingStatus === "processing"}
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
              previewPath={previewPath}
              runtimeState={runtimeState}
              previewStarting={previewStarting}
              projectStatus={project.status}
              projectProcessingStatus={project.processingStatus}
              onToggleChat={toggleChat}
              onModeChange={setDetailMode}
              onPathChange={setPreviewPath}
              onStartPreview={handleStartPreview}
              user={user}
            />
            <div className="min-h-0 flex-1 overflow-hidden p-sm">
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-md  border-[var(--app-border)] bg-[var(--app-panel)] transition-colors duration-300">
                {detailMode === "preview" ? (
                  <PreviewWorkspace
                    previewPath={previewPath}
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
  state: RuntimeUIState,
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
  previewPath,
  runtimeState,
  previewStarting,
  projectStatus,
  projectProcessingStatus,
  onToggleChat,
  onModeChange,
  onPathChange,
  onStartPreview,
  user,
}: {
  chatVisible: boolean;
  mode: DetailMode;
  previewPath: string;
  runtimeState: RuntimeUIState;
  previewStarting: boolean;
  projectStatus: Project["status"];
  projectProcessingStatus: Project["processingStatus"];
  onToggleChat: () => void;
  onModeChange: (mode: DetailMode) => void;
  onPathChange: (path: string) => void;
  onStartPreview: () => void;
  user?: import("@/auth/types").AuthUserSummary;
}) {
  const previewUrl =
    runtimeState.status === "running" ? runtimeState.previewUrl : null;
  const canStartPreview = isProjectPreviewStartAvailable({
    projectStatus,
    projectProcessingStatus,
    runtimeStatus: runtimeState.status,
    previewUrl,
  });
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({ projectStatus, projectProcessingStatus });

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

      <label
        className="mx-auto flex h-9 w-full max-w-[640px] items-center gap-xs rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-text)]"
        htmlFor="preview-path"
      >
        <Globe
          aria-hidden="true"
          className="text-[var(--app-icon-subtle)]"
          size={14}
        />

        <input
          id="preview-path"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[12px] text-[var(--app-page-text)] outline-none placeholder:text-[var(--app-subtle-text)]"
          value={previewPath}
          placeholder="/"
          onChange={(event) => onPathChange(event.target.value)}
        />
      </label>

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
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            aria-label="Open preview"
          >
            <ExternalLink aria-hidden="true" size={15} />
          </a>
        ) : (
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
            type="button"
            aria-label="Open preview"
          >
            <ExternalLink aria-hidden="true" size={15} />
          </button>
        )}
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          aria-label="Refresh preview"
        >
          <RefreshCw aria-hidden="true" size={15} />
        </button>
      </div>
    </header>
  );
}

function PreviewWorkspace({
  previewPath: _previewPath,
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
  previewPath: string;
  runtimeState: RuntimeUIState;
  projectId: string;
  previewStarting: boolean;
  projectStatus: Project["status"];
  projectProcessingStatus: Project["processingStatus"];
  previewTokenState: PreviewTokenState;
  previewStartError: string | null;
  onStartPreview: () => void;
  onRefreshPreviewToken: () => void;
}) {
  const showIframe =
    runtimeState.status === "running" && runtimeState.previewUrl && previewTokenState.status === "ready";
  const previewTemporarilyUnavailable = isProjectPreviewTemporarilyUnavailable({ projectStatus, projectProcessingStatus });
  const showInitPanel =
    !previewTemporarilyUnavailable &&
    ["idle", "stopped", "error"].includes(runtimeState.status) &&
    runtimeState.status !== "running";
  const statusBadge = runtimeStatusBadge(runtimeState, previewStarting);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)] transition-colors duration-300">
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
            src={runtimeState.previewUrl!}
            className="h-full w-full border-0"
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
): RuntimeUIState {
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
