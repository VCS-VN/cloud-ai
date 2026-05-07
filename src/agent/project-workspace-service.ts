import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectFileNode, ProjectFileNodeRepository } from "@/shared/project-types";

const WORKSPACES_ROOT = path.resolve(process.cwd(), "projects");
const IGNORED_DIRS = new Set([".git", "node_modules", "dist", ".output", ".tanstack"]);
const TEXT_FILE_EXTENSIONS = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
]);

export class ProjectWorkspaceService {
  constructor(private readonly fileNodeRepository?: ProjectFileNodeRepository) {}

  getWorkspacePath(projectId: string) {
    return path.join(WORKSPACES_ROOT, assertSafeProjectId(projectId));
  }

  async ensureWorkspace(projectId: string) {
    const workspacePath = this.getWorkspacePath(projectId);
    await mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }

  resolveWorkspacePath(projectId: string, relativePath = ".") {
    const workspacePath = this.getWorkspacePath(projectId);
    const resolvedPath = path.resolve(workspacePath, relativePath);
    if (resolvedPath !== workspacePath && !resolvedPath.startsWith(`${workspacePath}${path.sep}`)) {
      throw new Error("Path escapes the project workspace.");
    }
    return resolvedPath;
  }

  async writeTextFile(projectId: string, relativePath: string, content: string) {
    const targetPath = this.resolveWorkspacePath(projectId, relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, content, "utf8");
  }

  async readTextFile(projectId: string, relativePath: string) {
    return readFile(this.resolveWorkspacePath(projectId, relativePath), "utf8");
  }

  async scaffoldTanStackStartProject(projectId: string, prompt: string) {
    await this.ensureWorkspace(projectId);
    const projectTitle = deriveTitle(prompt);
    const files: Record<string, string> = {
      "package.json": JSON.stringify(
        {
          scripts: {
            dev: "vite dev",
            build: "vite build",
            typecheck: "tsc --noEmit",
          },
          dependencies: {
            "@tanstack/react-router": "latest",
            "@tanstack/react-start": "latest",
            "@vitejs/plugin-react": "latest",
            axios: "latest",
            jotai: "latest",
            react: "latest",
            "react-dom": "latest",
            "react-hook-form": "latest",
            tailwindcss: "latest",
            zod: "latest",
          },
          devDependencies: {
            typescript: "latest",
            vite: "latest",
          },
        },
        null,
        2,
      ),
      "README.md": `# ${projectTitle}\n\nGenerated from prompt:\n\n> ${prompt}\n\n## Stack\n\nTanStack Start, TailwindCSS, shadcn-style components, axios, zod, jotai, and react-hook-form.\n`,
      "src/routes/__root.tsx": `import { Outlet, createRootRoute } from '@tanstack/react-router'\nimport '../styles/globals.css'\n\nexport const Route = createRootRoute({ component: Root })\n\nfunction Root() {\n  return <Outlet />\n}\n`,
      "src/routes/index.tsx": `import { createFileRoute } from '@tanstack/react-router'\nimport { useAtom } from 'jotai'\nimport { leadFormSchema } from '../schemas/lead-form.schema'\nimport { leadAtom } from '../stores/lead.store'\n\nexport const Route = createFileRoute('/')({ component: HomePage })\n\nfunction HomePage() {\n  const [lead, setLead] = useAtom(leadAtom)\n\n  return (\n    <main className=\"min-h-screen bg-slate-950 text-white\">\n      <section className=\"mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-8 px-6 py-20\">\n        <p className=\"text-sm uppercase tracking-[0.3em] text-cyan-300\">AI Storefront</p>\n        <div className=\"max-w-3xl space-y-6\">\n          <h1 className=\"text-5xl font-semibold tracking-tight md:text-7xl\">${projectTitle}</h1>\n          <p className=\"text-lg leading-8 text-slate-300\">${escapeTemplateText(prompt)}</p>\n        </div>\n        <form\n          className=\"grid max-w-xl gap-3 rounded-3xl border border-white/10 bg-white/5 p-4\"\n          onSubmit={(event) => {\n            event.preventDefault()\n            const result = leadFormSchema.safeParse(lead)\n            if (!result.success) return\n            setLead({ email: '' })\n          }}\n        >\n          <label className=\"text-sm text-slate-300\" htmlFor=\"email\">Email</label>\n          <input\n            id=\"email\"\n            className=\"rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none ring-cyan-300 transition focus:ring-2\"\n            value={lead.email}\n            onChange={(event) => setLead({ email: event.target.value })}\n            placeholder=\"you@example.com\"\n          />\n          <button className=\"rounded-2xl bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200\" type=\"submit\">Join waitlist</button>\n        </form>\n      </section>\n    </main>\n  )\n}\n`,
      "src/styles/globals.css": `@import 'tailwindcss';\n\n:root {\n  color-scheme: dark;\n  font-family: Inter, ui-sans-serif, system-ui, sans-serif;\n}\n\nbody {\n  margin: 0;\n}\n`,
      "src/lib/axios-instance.ts": `import axios from 'axios'\n\nexport const apiClient = axios.create({\n  baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api',\n  headers: { 'Content-Type': 'application/json' },\n})\n`,
      "src/schemas/lead-form.schema.ts": `import { z } from 'zod'\n\nexport const leadFormSchema = z.object({\n  email: z.string().email(),\n})\n\nexport type LeadFormValues = z.infer<typeof leadFormSchema>\n`,
      "src/stores/lead.store.ts": `import { atom } from 'jotai'\nimport type { LeadFormValues } from '../schemas/lead-form.schema'\n\nexport const leadAtom = atom<LeadFormValues>({ email: '' })\n`,
      "src/components/ui/button.tsx": `import type { ButtonHTMLAttributes } from 'react'\n\nexport function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {\n  return <button {...props} className={['rounded-md px-4 py-2 transition', props.className].filter(Boolean).join(' ')} />\n}\n`,
    };

    for (const [relativePath, content] of Object.entries(files)) {
      await this.writeTextFile(projectId, relativePath, content);
    }

    return Object.keys(files);
  }

  async syncFileTree(projectId: string, userId?: string) {
    if (!this.fileNodeRepository) return [];
    const workspacePath = await this.ensureWorkspace(projectId);
    const nodes = await collectFileNodes({ projectId, userId, rootPath: workspacePath });
    for (const node of nodes) await this.fileNodeRepository.saveFileNode(node, userId);
    return nodes;
  }
}

async function collectFileNodes(args: { projectId: string; userId?: string; rootPath: string }) {
  const now = new Date().toISOString();
  const nodes: ProjectFileNode[] = [];

  async function visit(relativePath: string, parentId?: string) {
    const absolutePath = path.join(args.rootPath, relativePath);
    const entries = await readdir(absolutePath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      const childRelativePath = relativePath === "." ? entry.name : `${relativePath}/${entry.name}`;
      const nodePath = `/${childRelativePath}`;
      const nodeId = `${args.projectId}:${nodePath}`;
      const fileStat = await stat(path.join(args.rootPath, childRelativePath));
      const node: ProjectFileNode = {
        id: nodeId,
        projectId: args.projectId,
        userId: args.userId,
        name: entry.name,
        type: entry.isDirectory() ? "folder" : "file",
        path: nodePath,
        parentId,
        createdAt: fileStat.birthtime.toISOString() || now,
        updatedAt: fileStat.mtime.toISOString() || now,
      };
      if (entry.isFile() && TEXT_FILE_EXTENSIONS.has(path.extname(entry.name))) {
        node.contentType = contentTypeFor(entry.name);
        node.content = await readFile(path.join(args.rootPath, childRelativePath), "utf8");
      }
      nodes.push(node);
      if (entry.isDirectory()) await visit(childRelativePath, nodeId);
    }
  }

  await visit(".");
  return nodes;
}

function assertSafeProjectId(projectId: string) {
  if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Invalid project id.");
  return projectId;
}

function deriveTitle(prompt: string) {
  return prompt.replace(/\s+/g, " ").trim().split(" ").slice(0, 8).join(" ") || "AI Storefront";
}

function escapeTemplateText(value: string) {
  return value.replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

function contentTypeFor(fileName: string) {
  const extension = path.extname(fileName);
  if (extension === ".json") return "application/json";
  if (extension === ".css") return "text/css";
  if (extension === ".html") return "text/html";
  if (extension === ".md") return "text/markdown";
  return "text/plain";
}
