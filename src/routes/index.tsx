import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { HomePromptForm } from "../components/home/HomePromptForm";
import { createProjectFromPrompt } from "../server/functions/projects";

const promptIdeas = [
  "Website giới thiệu studio chụp ảnh cưới, nhẹ nhàng và có nút đặt lịch.",
  "Trang bán đồ decor tối giản, màu ấm, có danh mục sản phẩm nổi bật.",
  "Landing page cho lớp yoga cuối tuần với lịch học và form đăng ký.",
];

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const createProject = useServerFn(createProjectFromPrompt);
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [createdProjectName, setCreatedProjectName] = useState<
    string | undefined
  >();

  async function handleCreateProject(nextPrompt: string) {
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
          : "Không thể tạo website. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="builder-shell text-[var(--app-text)]">
      <div className="builder-page">
        <nav
          className="mb-xl flex items-center justify-between gap-md"
          aria-label="Trang chủ builder"
        >
          <a
            className="flex items-center gap-xs text-[15px] font-[540] no-underline"
            href="/"
          >
            <span
              className="h-5 w-5 rounded-sm bg-gradient-to-br from-coral via-magenta to-lilac"
              aria-hidden="true"
            />
            Cloud AI
          </a>
          <button
            className="builder-button bg-[var(--app-control)] text-[var(--app-text)] ring-1 ring-[var(--app-border)]"
            type="button"
            onClick={() => void navigate({ to: "/projects" as never })}
          >
            Dự án của tôi
          </button>
        </nav>

        <section className="mx-auto mb-lg flex max-w-4xl flex-col items-center text-center">
          <p className="builder-kicker rounded-pill bg-[var(--app-text)] px-sm py-xs text-[var(--app-bg)]">
            AI Website Builder
          </p>
          <h1 className="builder-title mt-md max-w-4xl">
            Chào bạn, hôm nay mình cùng tạo website nhé?
          </h1>
          <p className="builder-copy mt-md max-w-2xl text-[var(--app-muted)]">
            Kể cho Cloud AI về ý tưởng, phong cách và điều bạn muốn khách hàng
            nhìn thấy. Chúng tôi sẽ giúp bạn khởi tạo một website gọn gàng để
            tiếp tục chỉnh sửa.
          </p>
        </section>

        <HomePromptForm
          prompt={prompt}
          loading={loading}
          error={error}
          onPromptChange={setPrompt}
          onSubmit={handleCreateProject}
        />

        {createdProjectName ? (
          <p
            className="builder-truncate-safe mx-auto mt-md max-w-3xl rounded-md border border-[var(--app-border)] bg-[var(--app-control)] p-md text-[15px] leading-6"
            role="status"
          >
            Đã tạo dự án “{createdProjectName}”.
          </p>
        ) : null}

        <section
          className="mx-auto mt-lg grid max-w-4xl gap-sm md:grid-cols-3"
          aria-label="Gợi ý prompt"
        >
          {promptIdeas.map((idea) => (
            <button
              key={idea}
              type="button"
              className="builder-card builder-truncate-safe p-md text-left text-[14px] leading-5 text-[var(--app-muted)] transition hover:border-[var(--app-border-strong)] hover:text-[var(--app-text)]"
              onClick={() => setPrompt(idea)}
            >
              {idea}
            </button>
          ))}
        </section>
      </div>
    </main>
  );
}
