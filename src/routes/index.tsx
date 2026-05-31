import { useState } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoginModal } from "@/components/auth/LoginModal";
import { HomePromptForm } from "@/components/home/HomePromptForm";
import { useReveal } from "@/hooks/useReveal";
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
  const heroRef = useReveal<HTMLDivElement>();
  const cardsRef = useReveal<HTMLDivElement>({ threshold: 0.1 });

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
              className="motion-press rounded-pill bg-[var(--color-primary)] px-md py-xs text-button font-[480] text-[var(--color-on-primary)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
              type="button"
              onClick={() => setLoginOpen(true)}
            >
              Sign in
            </button>
          </div>
        </nav>

        <section className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-center pb-xl pt-xl text-center sm:pt-xxl">
          <div ref={heroRef} data-reveal="cinematic">
            <h1 className="type-display-xl m-0 mx-auto max-w-5xl text-[var(--app-page-text)]">
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
          </div>

          {createdProjectName ? (
            <p
              className="mx-auto mt-md max-w-3xl rounded-pill border border-[var(--app-border)] bg-[var(--app-panel-bg)] px-md py-sm text-body-sm leading-5 text-[var(--app-panel-text)]"
              role="status"
            >
              Created “{createdProjectName}”.
            </p>
          ) : null}

          <div
            ref={cardsRef}
            className="mt-xl grid gap-sm text-left md:grid-cols-[1.05fr_0.95fr]"
          >
            <article
              data-reveal
              style={{ "--reveal-index": 0 } as React.CSSProperties}
              className="motion-lift rounded-lg bg-[var(--color-block-lime)] p-lg text-[var(--color-ink)] sm:p-xl"
            >
              <p className="m-0 font-mono text-caption uppercase tracking-[0.6px] opacity-70">
                FAST START
              </p>
              <h2 className="m-0 mt-lg max-w-xl text-headline font-[540] leading-[1.35] tracking-[-0.26px]">
                Turn a rough prompt into a structured website workspace.
              </h2>
              <div className="mt-xl grid gap-sm sm:grid-cols-3">
                {[
                  ["01", "Describe the page"],
                  ["02", "Review generated sections"],
                  ["03", "Iterate by chatting"],
                ].map(([step, label]) => (
                  <div
                    key={step}
                    className="motion-lift rounded-md border border-[rgb(0_0_0_/_0.12)] bg-[var(--color-canvas)] p-md"
                  >
                    <span className="font-mono text-caption uppercase tracking-[0.6px] opacity-60">
                      {step}
                    </span>
                    <p className="m-0 mt-md text-body-sm font-[330] leading-[1.45] tracking-[-0.14px]">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </article>

            <aside className="grid gap-sm sm:grid-cols-2 md:grid-cols-1">
              <div
                data-reveal
                style={{ "--reveal-index": 1 } as React.CSSProperties}
                className="motion-lift rounded-lg bg-[var(--color-block-cream)] p-lg text-[var(--color-ink)]"
              >
                <p className="m-0 font-mono text-caption uppercase tracking-[0.6px] opacity-70">
                  PROMPT IDEAS
                </p>
                <div className="mt-lg flex flex-wrap gap-xs">
                  {[
                    "Fashion store homepage",
                    "Product collection page",
                    "Flash sale landing page",
                    "Checkout upsell flow",
                    "New arrival campaign",
                    "Retail loyalty page",
                  ].map((label) => (
                    <button
                      key={label}
                      className="motion-press rounded-pill border border-[rgb(0_0_0_/_0.12)] bg-[var(--color-canvas)] px-sm py-xs text-body-sm font-[480] hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-focus-ring)]"
                      type="button"
                      onClick={() => setPrompt(label)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div
                data-reveal
                style={{ "--reveal-index": 2 } as React.CSSProperties}
                className="motion-lift rounded-lg bg-[var(--color-block-navy)] p-lg text-[var(--color-inverse-ink)]"
              >
                <p className="m-0 font-mono text-caption uppercase tracking-[0.6px] opacity-70">
                  WORKFLOW
                </p>
                <p className="m-0 mt-lg text-body font-[320] leading-[1.45] tracking-[-0.26px] opacity-90">
                  Generate, preview, and refine pages in one focused builder flow.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
