import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { WorkspaceShell } from "@/components/layout/WorkspaceShell";
import { HomePromptForm } from "@/components/home/HomePromptForm";
import { useReveal } from "@/hooks/useReveal";
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
  const heroRef = useReveal<HTMLDivElement>();

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
    <WorkspaceShell
      mainClassName="h-screen overflow-hidden bg-[var(--color-canvas)] p-xs text-[var(--color-ink)] sm:p-sm"
      sectionClassName="min-w-0 overflow-y-auto rounded-lg border border-[var(--color-hairline)] bg-[var(--color-block-lilac)] text-[var(--color-ink)] transition-colors duration-300 ease-out"
      sidebar={
        <AppSidebar
          user={user}
          activeItem="dashboard"
          projects={projects}
          onOpenProject={openProject}
        />
      }
    >
      <div className="flex min-h-full flex-col items-center justify-center px-md py-xl text-center sm:px-xl lg:px-xxl">
            <div ref={heroRef} data-reveal="cinematic" className="w-full">
            <p className="mb-md font-mono text-eyebrow uppercase tracking-[0.54px] text-[var(--color-ink)] opacity-70">
              CLOUD AI
            </p>

            <h1 className="type-display-lg m-0 mx-auto max-w-4xl text-[var(--color-ink)]">
              What should we build, {firstName}?
            </h1>

            <p className="mt-md mx-auto max-w-2xl text-body-lg font-[330] leading-[1.4] tracking-[-0.14px] text-[var(--color-ink)] opacity-70">
              Describe your idea and Cloud AI will build it for you.
            </p>

            <div className="mt-lg flex flex-wrap justify-center gap-sm">
              {[
                "Fashion store homepage",
                "Product collection page",
                "Flash sale landing page",
                "Checkout upsell flow",
                "New arrival campaign",
                "Retail loyalty page",
              ].map((text, index) => (
                <button
                  key={text}
                  type="button"
                  data-reveal
                  style={{ "--reveal-index": index } as React.CSSProperties}
                  className="motion-press rounded-pill border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-md py-xs text-body-sm font-[480] text-[var(--color-ink)] hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => handleSuggestionClick(text)}
                  disabled={loading}
                  aria-label={text}
                >
                  {text}
                </button>
              ))}
            </div>

            <div className="mt-xl mx-auto w-full max-w-[1040px]">
              <HomePromptForm
                prompt={prompt}
                loading={loading}
                error={error}
                onPromptChange={setPrompt}
                onSubmit={handleCreateProject}
              />
            </div>
            </div>
          </div>
    </WorkspaceShell>
  );
}

function getFirstName(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return "there";
  const firstToken = trimmed.split(/\s+/)[0];
  return firstToken.includes("@") ? firstToken.split("@")[0] : firstToken;
}
