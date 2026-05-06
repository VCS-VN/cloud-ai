import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { LoginModal } from "@/components/auth/LoginModal";
import { HomePromptForm } from "@/components/home/HomePromptForm";
import { createProjectFromPrompt } from "@/server/functions/projects";
import { getCurrentUser } from "@/server/functions/auth";

export const Route = createFileRoute("/")({
  loader: async () => {
    const result = await getCurrentUser();
    if (result.user) throw redirect({ to: "/dashboard" });
    return result;
  },
  component: HomePage,
});

function HomePage() {
  const createProject = useServerFn(createProjectFromPrompt);
  const navigate = useNavigate();
  const { user } = Route.useLoaderData();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [createdProjectName, setCreatedProjectName] = useState<
    string | undefined
  >();

  async function handleCreateProject(nextPrompt: string) {
    if (!user) {
      setLoginOpen(true);
      return;
    }

    setLoading(true);
    setError(undefined);
    setCreatedProjectName(undefined);

    try {
      const workspace = await createProject({ data: { prompt: nextPrompt } });
      setCreatedProjectName(workspace.project.name);
      await navigate({
        to: "/projects" as never,
        search: { projectId: workspace.project.id } as never,
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

  return (
    <main className="min-h-screen bg-[var(--app-page-bg)] text-[var(--app-page-text)] transition-colors duration-300">
      <div className="flex min-h-screen flex-col px-md py-md sm:px-xl sm:py-lg">
        <nav
          className="flex items-center justify-between gap-md"
          aria-label="Home navigation"
        >
          <a
            className="flex items-center gap-xs text-[15px] font-[650] no-underline transition-opacity duration-200 hover:opacity-80"
            href="/"
          >
            <span
              className="h-5 w-5 rounded-sm bg-[var(--color-block-lilac)]"
              aria-hidden="true"
            />
            Cloud AI
          </a>
          <div className="flex items-center gap-xs">
            <button
              className="rounded-pill bg-[var(--color-primary)] px-md py-xs text-button font-[480] text-[var(--color-on-primary)] transition-opacity duration-200 hover:opacity-86 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
              type="button"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </div>
        </nav>

        <section className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-center pb-xl pt-section text-center">
          {/* <a
            className="mb-xl inline-flex self-center items-center gap-sm rounded-pill bg-[var(--color-primary)] p-xxs pr-md text-button font-[480] text-[var(--color-on-primary)] transition-opacity duration-200 hover:opacity-86"
            href="/"
            aria-label="Try Cloud AI for web projects"
          >
            <span className="rounded-pill bg-[var(--color-block-lime)] px-sm py-xs text-[var(--app-on-color-block)]">New</span>
            <span className="hidden sm:inline">
              Try Cloud AI for web projects
            </span>
            <span className="sm:hidden">Try Cloud AI</span>
            <ArrowRight aria-hidden="true" size={22} />
          </a> */}

          <h1 className="m-0 mx-auto max-w-5xl text-display-xl font-[340] leading-none tracking-[-1.72px] text-[var(--app-page-text)]">
            Build more with Cloud AI
          </h1>
          <p className="m-0 mx-auto mt-md max-w-3xl text-subhead font-[340] leading-[1.35] tracking-[-0.26px] text-[var(--app-muted)]">
            Create websites by chatting with AI
          </p>

          <div className="mt-xl w-full rounded-lg bg-[var(--color-block-lilac)] p-lg text-left text-[var(--app-on-color-block)] sm:p-xxl">
            <HomePromptForm
              prompt={prompt}
              loading={loading}
              error={error}
              onPromptChange={setPrompt}
              onSubmit={handleCreateProject}
            />
          </div>

          {createdProjectName ? (
            <p
              className="mx-auto mt-md max-w-3xl rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-md py-sm text-body-sm leading-5 text-[var(--app-panel-text)]"
              role="status"
            >
              Created “{createdProjectName}”.
            </p>
          ) : null}
        </section>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
