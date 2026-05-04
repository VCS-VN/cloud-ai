import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { EmptyState } from '../components/common/EmptyState'
import { FilePreviewPanel } from '../components/projects/FilePreviewPanel'
import { MessageComposer } from '../components/projects/MessageComposer'
import { ProjectFileExplorer } from '../components/projects/ProjectFileExplorer'
import { ProjectList } from '../components/projects/ProjectList'
import { ProjectMessagesPanel } from '../components/projects/ProjectMessagesPanel'
import type { Message, ProjectFileNode } from '../features/storefront-builder/types'
import { sendProjectMessage } from '../server/functions/project-messages'
import { getProjectWorkspace } from '../server/functions/projects'

type ProjectsSearch = {
  projectId?: string
}

export const Route = createFileRoute('/projects')({
  validateSearch: (search: Record<string, unknown>): ProjectsSearch => ({
    projectId: typeof search.projectId === 'string' ? search.projectId : undefined
  }),
  loaderDeps: ({ search }) => ({ projectId: search.projectId }),
  loader: ({ deps }) => getProjectWorkspace({ data: { projectId: deps.projectId } }),
  component: ProjectsPage
})

function ProjectsPage() {
  const navigate = useNavigate()
  const sendMessage = useServerFn(sendProjectMessage)
  const { projects, selectedProjectId, workspace } = Route.useLoaderData()
  const [messages, setMessages] = useState<Message[]>(workspace?.messages ?? [])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | undefined>()
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>()

  useEffect(() => {
    setMessages(workspace?.messages ?? [])
    setSendError(undefined)
    setSelectedNodeId(workspace?.fileTree[0]?.id)
  }, [workspace?.project.id, workspace?.messages, workspace?.fileTree])

  const selectedNode = useMemo(() => findNode(workspace?.fileTree ?? [], selectedNodeId), [workspace?.fileTree, selectedNodeId])

  async function selectProject(projectId: string) {
    await navigate({ to: '/projects', search: { projectId } })
  }

  async function goHome() {
    await navigate({ to: '/' })
  }

  async function handleSendMessage(content: string) {
    if (!workspace) return
    setSending(true)
    setSendError(undefined)

    try {
      const appendedMessages = await sendMessage({ data: { projectId: workspace.project.id, content } })
      setMessages((currentMessages) => [...currentMessages, ...appendedMessages])
      setDraft('')
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Không gửi được message. Vui lòng thử lại.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="min-h-screen bg-surface-soft px-md py-lg text-ink sm:px-lg lg:px-xl">
      <header className="mb-lg rounded-xl bg-canvas p-lg shadow-panel">
        <p className="m-0 font-mono text-caption uppercase tracking-[0.16em]">Workspace</p>
        <h1 className="mb-sm mt-xs text-display-lg">Projects</h1>
        <p className="m-0 max-w-3xl text-body-sm">Chọn storefront project để xem conversation và cấu trúc file ảo.</p>
      </header>

      <section className="grid gap-lg xl:grid-cols-[320px_360px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-hairline bg-canvas p-md">
          <ProjectList projects={projects} selectedProjectId={selectedProjectId} onSelectProject={selectProject} onCreateProject={goHome} />
        </aside>

        <aside className="space-y-md rounded-xl border border-hairline bg-canvas p-md">
          {workspace ? (
            <>
              <ProjectFileExplorer fileTree={workspace.fileTree} selectedNodeId={selectedNodeId} onSelectNode={(node) => setSelectedNodeId(node.id)} />
              <FilePreviewPanel node={selectedNode} />
            </>
          ) : (
            <EmptyState title="Chọn project để xem files" description="Explorer sẽ hiển thị cấu trúc storefront ảo của project được chọn." />
          )}
        </aside>

        <section className="flex min-h-[640px] min-w-0 flex-col rounded-xl border border-hairline bg-canvas p-lg">
          {workspace ? (
            <>
              <div className="mb-lg">
                <p className="m-0 font-mono text-caption uppercase tracking-[0.16em]">Project đang chọn</p>
                <h2 className="mb-sm mt-xs text-headline">{workspace.project.name}</h2>
                <p className="m-0 max-w-3xl break-words text-body-sm">{workspace.project.description}</p>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <ProjectMessagesPanel messages={messages} />
              </div>
              <div className="mt-lg">
                <MessageComposer value={draft} sending={sending} error={sendError} onChange={setDraft} onSend={handleSendMessage} />
              </div>
            </>
          ) : (
            <EmptyState title="Chọn một project" description="Danh sách bên trái sẽ mở workspace chi tiết cho project được chọn." />
          )}
        </section>
      </section>
    </main>
  )
}

function findNode(nodes: ProjectFileNode[], nodeId?: string): ProjectFileNode | undefined {
  if (!nodeId) return undefined
  for (const node of nodes) {
    if (node.id === nodeId) return node
    const child = findNode(node.children ?? [], nodeId)
    if (child) return child
  }
  return undefined
}
