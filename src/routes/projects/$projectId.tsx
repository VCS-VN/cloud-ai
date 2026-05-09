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
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { AgentEventTimeline } from "@/features/ai-agent/ui/agent-event-timeline";
import { UserMenu } from "@/components/auth/UserMenu";
import { FilePreviewPanel } from "@/components/projects/FilePreviewPanel";
import { MessageComposer } from "@/components/projects/MessageComposer";
import { ProjectFileExplorer } from "@/components/projects/ProjectFileExplorer";
import { ProjectMessagesPanel } from "@/components/projects/ProjectMessagesPanel";
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
} from "@/server/functions/projects";
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
} from "@/shared/project-types";

type DetailMode = "preview" | "code";

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

  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>();
  const [detailMode, setDetailMode] = useState<DetailMode>("preview");
  const [previewPath, setPreviewPath] = useState("/");
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [chatVisible, setChatVisible] = useState(true);
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
  const activeStreamRef = useRef<ActiveStream | null>(null);
  const [agentEvents, setAgentEvents] = useState<AgentStreamEvent[]>([]);

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
      activeStreamRef.current = { agentMessageId, url, source, hasTerminalEvent: false };

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
        const event = JSON.parse((rawEvent as MessageEvent<string>).data) as AgentStreamEvent;
        setAgentEvents((current) => [...current, event]);
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
          void queryClient.invalidateQueries({ queryKey: ["project-runs", project?.id] });
        }
        if (event.type === "done") {
          void queryClient.invalidateQueries({ queryKey: ["project", project?.id] });
          void queryClient.invalidateQueries({ queryKey: ["project-files", project?.id] });
          void queryClient.invalidateQueries({ queryKey: ["project-runs", project?.id] });
          void queryClient.invalidateQueries({ queryKey: ["project-preview", project?.id] });
        }
      };

      const handleTerminal = (rawEvent: Event) => {
        const event = JSON.parse(
          (rawEvent as MessageEvent<string>).data,
        ) as MessageTerminalEvent;
        if (activeStreamRef.current?.agentMessageId === event.messageId) {
          activeStreamRef.current.hasTerminalEvent = true;
        }
        updateMessage((message) => ({
          ...message,
          content: event.content,
          processingStatus: event.processingStatus,
          providerResponseId: event.providerResponseId,
          errorMessage: event.error?.message,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
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
        void queryClient.invalidateQueries({ queryKey: ["project-runs", project?.id] });
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
        void queryClient.invalidateQueries({ queryKey: ["project", project?.id] });
        void queryClient.invalidateQueries({ queryKey: getProjectMessagesQueryKey(project?.id) });
        void queryClient.invalidateQueries({ queryKey: ["project-runs", project?.id] });
        void queryClient.invalidateQueries({ queryKey: ["project-preview", project?.id] });
        void router.invalidate();
      };
    },
    [closeActiveStream, project?.id, queryClient, router],
  );

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(CHAT_WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth >= MIN_CHAT_WIDTH) {
      setChatWidth(savedWidth);
    }

    const savedVisible = window.localStorage.getItem(CHAT_VISIBLE_KEY);
    if (savedVisible === "false") setChatVisible(false);
  }, []);

  useEffect(() => {
    closeActiveStream();
    setProject(workspace?.project);
    setSendError(undefined);
    setAgentEvents([]);
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

  function handleDeletedProject() {
    if (!project) return;
    void removeProject({ data: { projectId: project.id } }).finally(() => {
      void navigate({ to: "/projects" as never });
    });
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
    const maxWidth = Math.max(
      MIN_CHAT_WIDTH,
      Math.floor(window.innerWidth * 0.55),
    );
    resizeRef.current = {
      startX: event.clientX,
      startWidth: chatWidth,
      latestWidth: chatWidth,
      maxWidth,
    };
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
    event.currentTarget.releasePointerCapture(event.pointerId);
    window.localStorage.setItem(
      CHAT_WIDTH_KEY,
      String(resizeRef.current.latestWidth),
    );
    resizeRef.current = null;
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

  return (
    <main className="h-25 min-h-0 overflow-hidden bg-(--app-bg) text-(--app-text)">
      {workspace && project ? (
        <div className="flex h-full min-h-0 min-w-0 overflow-hidden">
          {chatVisible ? (
            <div
              className="flex min-h-0 w-105 shrink-0 flex-col overflow-hidden border-r border-(--app-border) bg-(--app-panel) transition-colors duration-300"
              style={{ width: chatWidth }}
            >
              <ChatHeader
                project={project}
                processing={project.processingStatus === "processing"}
                onBack={() => void navigate({ to: "/projects" as never })}
                onDelete={handleDeletedProject}
                onToggleChat={toggleChat}
              />

              <div className="min-h-0 h-1 flex-1 overflow-hidden px-sm ">
                <div className="flex h-full min-h-0 flex-col gap-sm">
                  <AgentEventTimeline events={agentEvents} />
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
          ) : null}

          {chatVisible ? (
            <button
              type="button"
              className="left-0 z-[12000] group relative w-2 shrink-0 cursor-col-resize touch-none border-30 border-blue-500 p-0 outline-none transition-colors duration-200"
              aria-label="Resize chat panel"
              onPointerDown={beginResize}
              onPointerMove={resize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
            >
              <span
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--app-border-strong)] transition-colors duration-200 group-hover:bg-[var(--app-accent)]"
                aria-hidden="true"
              />
            </button>
          ) : null}

          <section
            style={{
              paddingTop: 8,
            }}
            className="flex min-h-0 min-w-0 flex-1 shrink-0 flex-col overflow-hidden bg-(--app-panel) transition-colors duration-300"
          >
            <PreviewToolbar
              chatVisible={chatVisible}
              mode={detailMode}
              previewPath={previewPath}
              onToggleChat={toggleChat}
              onModeChange={setDetailMode}
              onPathChange={setPreviewPath}
              user={user}
            />
            <div className="min-h-0 flex-1 overflow-hidden p-sm">
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-md  border-[var(--app-border)] bg-[var(--app-panel)] transition-colors duration-300">
                {detailMode === "preview" ? (
                  <PreviewWorkspace
                    selectedNode={selectedNode}
                    previewPath={previewPath}
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

function ChatHeader({
  project,
  processing = false,
  onBack,
  onDelete,
  onToggleChat,
}: {
  project: Project;
  processing?: boolean;
  onBack: () => void;
  onDelete: () => void;
  onToggleChat: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-[var(--app-border)] p-sm">
      <div className="flex min-w-0 items-start gap-sm">
        <button
          className="inline-flex h-8 shrink-0 items-center rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[12px] text-[var(--app-danger-text)] transition-colors duration-200 hover:border-[var(--app-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          onClick={onDelete}
        >
          Delete
        </button>
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
          <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">
            {processing
              ? "Generating a response"
              : "Previewing last saved version"}
          </p>
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
        <button
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          onClick={onToggleChat}
          aria-label="Hide chat"
        >
          <PanelLeftClose aria-hidden="true" size={16} />
        </button>
      </div>
    </header>
  );
}

function PreviewToolbar({
  chatVisible,
  mode,
  previewPath,
  onToggleChat,
  onModeChange,
  onPathChange,
  user,
}: {
  chatVisible: boolean;
  mode: DetailMode;
  previewPath: string;
  onToggleChat: () => void;
  onModeChange: (mode: DetailMode) => void;
  onPathChange: (path: string) => void;
  user?: import("@/auth/types").AuthUserSummary;
}) {
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
          className={`inline-flex h-8 items-center gap-xs rounded-sm border-0 px-sm text-[12px] transition ${mode === "preview" ? "bg-[var(--color-block-lime)] text-[var(--app-on-color-block)] [&_svg]:text-[var(--app-icon-on-color-block)] ring-1 ring-[var(--color-primary)]" : "bg-transparent text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"}`}
          type="button"
          aria-pressed={mode === "preview"}
          onClick={() => onModeChange("preview")}
        >
          <Globe aria-hidden="true" size={15} />
          Preview
        </button>
        <button
          className={`inline-flex h-8 items-center gap-xs rounded-sm border-0 px-sm text-[12px] transition ${mode === "code" ? "bg-[var(--color-block-lime)] text-[var(--app-on-color-block)] [&_svg]:text-[var(--app-icon-on-color-block)] ring-1 ring-[var(--color-primary)]" : "bg-transparent text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"}`}
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
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-icon-muted)] transition-colors duration-200 hover:text-[var(--app-icon)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
          type="button"
          aria-label="Open preview"
        >
          <ExternalLink aria-hidden="true" size={15} />
        </button>
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
  selectedNode,
  previewPath,
}: {
  selectedNode?: ProjectFileNode;
  previewPath: string;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--app-panel)] transition-colors duration-300">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sm border border-[var(--app-border)] bg-[var(--app-surface)] transition-colors duration-300">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto p-sm">
          <FilePreviewPanel node={selectedNode} />
        </div>
      </div>
    </section>
  );
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
