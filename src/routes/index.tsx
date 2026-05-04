import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight } from "lucide-react";
import { LoginModal } from "@/components/auth/LoginModal";
import { UserMenu } from "@/components/auth/UserMenu";
import { HomePromptForm } from "@/components/home/HomePromptForm";
import { createProjectFromPrompt } from "@/server/functions/projects";
import { getCurrentUser } from "@/server/functions/auth";

export const Route = createFileRoute("/")({
  loader: () => getCurrentUser(),
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
    <main className="relative min-h-screen overflow-hidden bg-[#101216] text-white">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgb(19_20_22)_0%,rgb(25_32_44)_24%,transparent_42%),radial-gradient(circle_at_15%_20%,rgb(58_111_236)_0%,transparent_38%),radial-gradient(circle_at_82%_22%,rgb(70_108_239)_0%,transparent_36%),linear-gradient(180deg,#1b2129_0%,#466ee7_38%,#e980ed_68%,#ff2076_100%)]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgb(255_255_255_/_0.18)_0%,transparent_26%)] opacity-60"
        aria-hidden="true"
      />

      <div className="relative z-10 flex min-h-screen flex-col px-md py-md sm:px-xl sm:py-lg">
        <nav
          className="flex items-center justify-between gap-md"
          aria-label="Home navigation"
        >
          <a
            className="flex items-center gap-xs text-[15px] font-[650] no-underline transition-opacity duration-200 hover:opacity-80"
            href="/"
          >
            <span
              className="h-5 w-5 rounded-sm bg-gradient-to-br from-coral via-magenta to-lilac shadow-panel"
              aria-hidden="true"
            />
            Cloud AI
          </a>
          <div className="flex items-center gap-xs">
            {user ? (
              <>
                <span className="hidden max-w-[220px] truncate text-[13px] text-white/70 sm:inline">
                  {user.displayName || user.email}
                </span>
                <button
                  className="rounded-pill bg-white/10 px-md py-xs text-[14px] font-[650] text-white ring-1 ring-white/15 transition-all duration-200 hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  type="button"
                  onClick={() => void navigate({ to: "/projects" as never })}
                >
                  My projects
                </button>
                <UserMenu user={user} compact />
              </>
            ) : (
              <button
                className="rounded-pill bg-white px-md py-xs text-[14px] font-[700] text-[#17191f] shadow-panel transition-all duration-200 hover:translate-y-[-1px] hover:shadow-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                type="button"
                onClick={() => setLoginOpen(true)}
              >
                Sign in
              </button>
            )}
          </div>
        </nav>

        <section className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col items-center justify-center pb-xl pt-[8vh] text-center sm:pt-[10vh]">
          <a
            className="mb-xl inline-flex items-center gap-sm rounded-pill bg-[#242b38]/82 p-xxs pr-md text-[17px] font-[700] text-white shadow-[0_18px_45px_rgb(0_0_0_/_0.22)] backdrop-blur-md transition-all duration-300 ease-out hover:translate-y-[-2px] hover:bg-[#2b3444]"
            href="/"
            aria-label="Try Cloud AI for web projects"
          >
            <span className="rounded-pill bg-[#2458f5] px-sm py-xs">New</span>
            <span className="hidden sm:inline">
              Try Cloud AI for web projects
            </span>
            <span className="sm:hidden">Try Cloud AI</span>
            <ArrowRight aria-hidden="true" size={22} />
          </a>

          <h1 className="m-0 max-w-5xl text-[clamp(54px,8.7vw,118px)] font-[760] leading-[0.95] tracking-[-0.07em] text-[#fbf7ef] drop-shadow-[0_12px_32px_rgb(0_0_0_/_0.16)]">
            Build more with Monmi
          </h1>
          <p className="m-0 mt-md text-[clamp(24px,3vw,42px)] font-[450] leading-tight tracking-[-0.035em] text-white/62">
            Create websites by chatting with AI
          </p>

          <div className="mt-[9vh] w-full">
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
              className="mx-auto mt-md max-w-3xl rounded-pill border border-white/15 bg-black/20 px-md py-sm text-[14px] leading-5 text-white shadow-panel backdrop-blur"
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
