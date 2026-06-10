import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { renderUserGuide } from "@/lib/render-user-guide";

export const Route = createFileRoute("/user-guide")({
  component: UserGuidePage,
});

function UserGuidePage() {
  const [markdown, setMarkdown] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/docs/user-guide.md")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load the user guide.");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) {
          setMarkdown(text);
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not load the user guide. Please try again.",
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const html = useMemo(() => (markdown ? renderUserGuide(markdown) : ""), [markdown]);

  // Smooth-scroll for in-page anchor links so the TOC feels native.
  useEffect(() => {
    if (!html) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("#")) return;
      const id = href.slice(1);
      const node = document.getElementById(id);
      if (node) {
        event.preventDefault();
        node.scrollIntoView({ behavior: "smooth", block: "start" });
        if (typeof history !== "undefined" && history.replaceState) {
          history.replaceState(null, "", `#${id}`);
        }
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [html]);

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="text-ui-sm text-muted">Loading user guide…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="mb-4 text-h2 font-semibold">User Guide</h1>
        <p className="rounded-card border border-hairline bg-danger-bg p-4 text-danger-fg">
          {error}
        </p>
      </main>
    );
  }

  return (
    <main className="user-guide mx-auto max-w-3xl px-6 py-12 text-ink">
      <article
        className="user-guide-content"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
