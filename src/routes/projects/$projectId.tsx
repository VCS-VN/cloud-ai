import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  Globe,
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
} from "lucide-react";
import { EmptyState } from "../../components/common/EmptyState";
import { FilePreviewPanel } from "../../components/projects/FilePreviewPanel";
import { MessageComposer } from "../../components/projects/MessageComposer";
import { ProjectFileExplorer } from "../../components/projects/ProjectFileExplorer";
import { ProjectMessagesPanel } from "../../components/projects/ProjectMessagesPanel";
import type {
  Message,
  Project,
  ProjectFileNode,
} from "../../features/storefront-builder/types";
import { sendProjectMessage } from "../../server/functions/project-messages";
import { getProjectWorkspace } from "../../server/functions/projects";

type DetailMode = "preview" | "code";

const CHAT_WIDTH_KEY = "project-detail-chat-width";
const CHAT_VISIBLE_KEY = "project-detail-chat-visible";
const DEFAULT_CHAT_WIDTH = 420;
const MIN_CHAT_WIDTH = 320;

const statusLabel: Record<Project["status"], string> = {
  draft: "Nháp",
  generating: "Đang tạo",
  ready: "Sẵn sàng",
  failed: "Lỗi",
};

export const Route = createFileRoute("/projects/$projectId")({
  loader: ({ params }) =>
    getProjectWorkspace({ data: { projectId: params.projectId } }),
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const navigate = useNavigate();
  const sendMessage = useServerFn(sendProjectMessage);
  const { workspace } = Route.useLoaderData();
  const [messages, setMessages] = useState<Message[]>(
    workspace?.messages ?? [],
  );
  const [draft, setDraft] = useState("");
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

  useEffect(() => {
    const savedWidth = Number(window.localStorage.getItem(CHAT_WIDTH_KEY));
    if (Number.isFinite(savedWidth) && savedWidth >= MIN_CHAT_WIDTH)
      setChatWidth(savedWidth);

    const savedVisible = window.localStorage.getItem(CHAT_VISIBLE_KEY);
    if (savedVisible === "false") setChatVisible(false);
  }, []);

  useEffect(() => {
    setMessages(workspace?.messages ?? []);
    setSendError(undefined);
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
  }, [workspace?.project.id, workspace?.messages, workspace?.fileTree]);

  const selectedNode = useMemo(
    () => findNode(workspace?.fileTree ?? [], selectedNodeId),
    [workspace?.fileTree, selectedNodeId],
  );

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

  async function handleSendMessage(content: string) {
    if (!workspace) return;
    setSending(true);
    setSendError(undefined);

    try {
      const appendedMessages = await sendMessage({
        data: { projectId: workspace.project.id, content },
      });
      setMessages((currentMessages) => [
        ...currentMessages,
        ...appendedMessages,
      ]);
      setDraft("");
    } catch (cause) {
      setSendError(
        cause instanceof Error
          ? cause.message
          : "Không gửi được message. Vui lòng thử lại.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      {workspace ? (
        <div className="flex h-screen min-w-0 overflow-hidden">
          {chatVisible ? (
            <aside
              className="flex min-w-[320px] shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-panel)]"
              style={{ width: chatWidth }}
            >
              <ChatHeader
                project={workspace.project}
                onBack={() => void navigate({ to: "/projects" })}
                onToggleChat={toggleChat}
              />
              <div className="min-h-0 flex-1 overflow-hidden px-sm py-md">
                <ProjectMessagesPanel messages={messages} />
              </div>
              <div className="p-sm">
                <MessageComposer
                  value={draft}
                  sending={sending}
                  error={sendError}
                  onChange={setDraft}
                  onSend={handleSendMessage}
                />
              </div>
            </aside>
          ) : null}

          {chatVisible ? (
            <button
              type="button"
              className="group relative z-10 w-2 shrink-0 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none"
              aria-label="Resize chat panel"
              onPointerDown={beginResize}
              onPointerMove={resize}
              onPointerUp={endResize}
              onPointerCancel={endResize}
            >
              <span
                className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[var(--app-border-strong)] group-hover:bg-[var(--app-accent)]"
                aria-hidden="true"
              />
            </button>
          ) : null}

          <section className="flex min-w-0 flex-1 flex-col bg-[var(--app-panel)]">
            <PreviewToolbar
              chatVisible={chatVisible}
              mode={detailMode}
              previewPath={previewPath}
              onToggleChat={toggleChat}
              onModeChange={setDetailMode}
              onPathChange={setPreviewPath}
            />
            <div className="min-h-0 flex-1 p-sm">
              <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-md border border-[var(--app-border)] bg-[var(--app-panel)]">
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
            title="Không tìm thấy project"
            description="Project này không còn khả dụng hoặc bạn chưa chọn project hợp lệ."
          />
        </div>
      )}
    </main>
  );
}

function ChatHeader({
  project,
  onBack,
  onToggleChat,
}: {
  project: Project;
  onBack: () => void;
  onToggleChat: () => void;
}) {
  return (
    <header className="flex items-start gap-sm border-b border-[var(--app-border)] p-sm">
      <button
        className="mt-xxs inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
        type="button"
        onClick={onBack}
        aria-label="Back to projects"
      >
        <ArrowLeft aria-hidden="true" size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="m-0 truncate text-[16px] font-[620] leading-5 tracking-[-0.02em]">
          {project.name}
        </h1>
        <p className="m-0 mt-xxs text-[12px] leading-4 text-[var(--app-muted)]">
          Previewing last saved version
        </p>
        <div className="mt-xs flex flex-wrap gap-xs text-[11px] leading-4 text-[var(--app-muted)]">
          <span className="rounded-pill bg-[var(--app-control)] px-xs py-xxs">
            {statusLabel[project.status]}
          </span>
          <span className="rounded-pill bg-[var(--app-control)] px-xs py-xxs">
            Edited {new Date(project.updatedAt).toLocaleDateString("vi-VN")}
          </span>
        </div>
      </div>
      <button
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
        type="button"
        onClick={onToggleChat}
        aria-label="Hide chat"
      >
        <PanelLeftClose aria-hidden="true" size={16} />
      </button>
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
}: {
  chatVisible: boolean;
  mode: DetailMode;
  previewPath: string;
  onToggleChat: () => void;
  onModeChange: (mode: DetailMode) => void;
  onPathChange: (path: string) => void;
}) {
  return (
    <header className="flex min-h-14 items-center gap-sm border-b border-[var(--app-border)] px-sm py-xs">
      {!chatVisible ? (
        <button
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
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
        aria-label="Chọn chế độ xem"
      >
        <button
          className={`inline-flex h-8 items-center gap-xs rounded-md border-0 px-sm text-[13px] transition ${mode === "preview" ? "bg-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] text-[var(--app-text)] ring-1 ring-[var(--app-accent)]" : "bg-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]"}`}
          type="button"
          aria-pressed={mode === "preview"}
          onClick={() => onModeChange("preview")}
        >
          <Globe aria-hidden="true" size={15} />
          Preview
        </button>
        <button
          className={`inline-flex h-8 items-center gap-xs rounded-md border-0 px-sm text-[13px] transition ${mode === "code" ? "bg-[color-mix(in_srgb,var(--app-accent)_22%,transparent)] text-[var(--app-text)] ring-1 ring-[var(--app-accent)]" : "bg-transparent text-[var(--app-muted)] hover:text-[var(--app-text)]"}`}
          type="button"
          aria-pressed={mode === "code"}
          onClick={() => onModeChange("code")}
        >
          <Code2 aria-hidden="true" size={15} />
          Code
        </button>
      </div>

      <label
        className="mx-auto flex h-9 w-full max-w-[640px] items-center gap-xs rounded-pill border border-[var(--app-border)] bg-[var(--app-control)] px-sm text-[13px] text-[var(--app-text)]"
        htmlFor="preview-path"
      >
        <Globe
          aria-hidden="true"
          className="text-[var(--app-subtle)]"
          size={14}
        />
        <span className="sr-only">Preview path</span>
        <input
          id="preview-path"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-[var(--app-text)] outline-none placeholder:text-[var(--app-subtle)]"
          value={previewPath}
          placeholder="/"
          onChange={(event) => onPathChange(event.target.value)}
        />
      </label>

      <div className="flex shrink-0 items-center gap-xs">
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
          type="button"
          aria-label="Open preview"
        >
          <ExternalLink aria-hidden="true" size={15} />
        </button>
        <button
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--app-border)] bg-[var(--app-control)] text-[var(--app-muted)] hover:text-[var(--app-text)]"
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
    <section className="flex min-h-0 flex-1 flex-col bg-[var(--app-panel)] p-sm">
      <div className="mb-sm flex items-center justify-between gap-sm text-[12px] text-[var(--app-muted)]">
        <span className="truncate">Preview path: {previewPath || "/"}</span>
        <Eye aria-hidden="true" size={14} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] p-sm">
        <FilePreviewPanel node={selectedNode} />
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
    <div className="grid min-h-0 flex-1 gap-0 overflow-hidden xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="min-h-0 overflow-auto border-r border-[var(--app-border)] p-sm">
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
    <section className="flex min-h-0 min-w-0 flex-col bg-[var(--app-panel)]">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-control)] px-sm">
        <div className="flex min-w-0 items-center gap-xs">
          <span className="truncate rounded-t-md bg-[var(--app-panel)] px-sm py-xs text-[14px] font-[540]">
            {node?.path ?? "Select a file"}
          </span>
        </div>
        <div className="flex items-center gap-sm text-[13px] text-[var(--app-muted)]">
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
      <div className="min-h-0 flex-1 overflow-auto p-md">
        {node?.content ? (
          node.contentType?.startsWith("image/") ? (
            <div className="flex min-h-full items-center justify-center bg-white p-md">
              <pre className="whitespace-pre-wrap break-words text-[12px] text-black">
                {node.content}
              </pre>
            </div>
          ) : (
            <pre className="builder-truncate-safe min-h-full whitespace-pre-wrap rounded-md bg-[var(--app-control)] p-sm font-mono text-[12px] leading-5 text-[var(--app-text)]">
              {node.content}
            </pre>
          )
        ) : (
          <p className="m-0 rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-sm text-[13px] leading-5 text-[var(--app-muted)]">
            Select a file to inspect its content. Folders expand in the file
            tree and do not show content here.
          </p>
        )}
      </div>
    </section>
  );
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
