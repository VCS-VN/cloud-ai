import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { HomePromptForm } from "@/components/home/HomePromptForm";
import { getCurrentUser } from "@/server/functions/auth";
import {
  createProjectFromPrompt,
  getProjectWorkspace,
} from "@/server/functions/projects";

export const Route = createFileRoute("/dashboard/")({
  beforeLoad: async () => {
    const { user } = await getCurrentUser();
    if (!user) throw redirect({ to: "/" });
    return { user };
  },
  loader: () => getProjectWorkspace({ data: {} }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const createProject = useServerFn(createProjectFromPrompt);

  const { projects } = Route.useLoaderData();
  const { user } = Route.useRouteContext();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function handleCreateProject(nextPrompt: string) {
    setLoading(true);
    setError(undefined);

    try {
      const workspace = await createProject({ data: { prompt: nextPrompt } });
      await navigate({
        to: "/projects/$projectId",
        params: { projectId: workspace.project.id },
      });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to create your project. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  function openProject(projectId: string) {
    void navigate({ to: "/projects/$projectId", params: { projectId } });
  }

  const firstName = getFirstName(user.displayName || user.email);

  function handleSuggestionClick(text: string) {
    setPrompt(text);
    void handleCreateProject(text);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--app-bg)] p-xs text-[var(--app-text)] sm:p-sm">
      <div className="grid min-h-[calc(100vh-16px)] gap-sm transition-[grid-template-columns] duration-200 lg:grid-cols-[290px_minmax(0,1fr)] has-[aside[data-collapsed=true]]:lg:grid-cols-[72px_minmax(0,1fr)]">
        <AppSidebar
          user={user}
          activeItem="dashboard"
          projects={projects}
          onOpenProject={openProject}
        />

        <section className="min-w-0 overflow-hidden rounded-lg bg-[var(--color-block-lilac)] [background-image:var(--app-hero-glow)] text-[var(--app-on-color-block)] transition-colors duration-300">
          <div className="flex min-h-[calc(100vh-16px)] flex-col items-center justify-center px-md py-xl text-center sm:px-xl">
            <p className="mb-md font-mono text-eyebrow uppercase tracking-[0.54px] text-[var(--app-on-color-block)] opacity-70">
              CLOUD AI
            </p>

            <h1 className="m-0 max-w-4xl text-display-lg font-[340] leading-[1.1] tracking-[-0.96px] text-[var(--app-on-color-block)]">
              What should we build, {firstName}?
            </h1>

            <p className="mt-md text-body-lg font-[330] text-[var(--app-on-color-block)] opacity-75">
              Describe your idea and Cloud AI will build it for you.
            </p>

            <div className="mt-lg flex flex-wrap justify-center gap-sm">
              {[
                "Build a landing page",
                "Create a SaaS dashboard",
                "Design a blog with CMS",
                "Make an e-commerce store",
              ].map((text) => (
                <button
                  key={text}
                  type="button"
                  className="rounded-pill bg-[var(--color-canvas)]/80 px-md py-xs text-body-sm font-[480] text-[var(--app-on-color-block)] backdrop-blur-sm transition-colors duration-200 hover:bg-[var(--color-canvas)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleSuggestionClick(text)}
                  disabled={loading}
                  aria-label={text}
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="mt-xl w-full max-w-[1040px]">
              <HomePromptForm
                prompt={prompt}
                loading={loading}
                error={error}
                onPromptChange={setPrompt}
                onSubmit={handleCreateProject}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function getFirstName(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "there";
  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken.includes("@") ? firstToken.split("@")[0] : firstToken;
}
