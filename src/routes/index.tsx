import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { HomePromptForm } from "../components/home/HomePromptForm";
import { createProjectFromPrompt } from "../server/functions/projects";

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
          : "Không thể tạo storefront. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-canvas px-md py-xl text-ink sm:px-xl lg:px-xxl">
      <section className="mx-auto mb-xl max-w-5xl rounded-xl bg-lime p-xl lg:p-xxl">
        <p className="m-0 font-mono text-eyebrow uppercase tracking-[0.16em]">
          AI Storefront Builder
        </p>
        <h1 className="mb-md mt-lg max-w-4xl text-display-lg">
          Bạn muốn xây storefront như thế nào?
        </h1>
        <p className="m-0 max-w-3xl text-body-lg">
          Mô tả cửa hàng, khách hàng mục tiêu, phong cách thương hiệu và sản
          phẩm. Agent sẽ tạo workspace storefront ban đầu để bạn tiếp tục tinh
          chỉnh.
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
          className="mx-auto mt-lg max-w-4xl rounded-md border border-hairline bg-surface-soft p-md text-body-sm"
          role="status"
        >
          Đã tạo project “{createdProjectName}”.
        </p>
      ) : null}
    </main>
  );
}
