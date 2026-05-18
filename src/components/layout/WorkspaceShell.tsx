import type { ReactNode } from "react";

type WorkspaceShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  sectionClassName?: string;
  mainClassName?: string;
};

const DEFAULT_MAIN_CLASS =
  "h-screen overflow-hidden bg-[var(--app-bg)] p-xs text-[var(--app-text)] sm:p-sm";

const DEFAULT_SECTION_CLASS =
  "min-w-0 overflow-y-auto rounded-sm bg-[var(--app-surface)] p-sm transition-colors duration-300 sm:p-md";

export function WorkspaceShell({
  sidebar,
  children,
  sectionClassName = DEFAULT_SECTION_CLASS,
  mainClassName = DEFAULT_MAIN_CLASS,
}: WorkspaceShellProps) {
  return (
    <main className={mainClassName}>
      <div className="grid h-[calc(100vh-16px)] gap-sm transition-[grid-template-columns] duration-200 lg:grid-cols-[290px_minmax(0,1fr)] has-[aside[data-collapsed=true]]:lg:grid-cols-[72px_minmax(0,1fr)]">
        {sidebar}
        <section className={sectionClassName}>{children}</section>
      </div>
    </main>
  );
}
