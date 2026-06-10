import type { ReactNode } from "react";

type WorkspaceShellProps = {
  sidebar: ReactNode;
  children: ReactNode;
  sectionClassName?: string;
  mainClassName?: string;
};

const DEFAULT_MAIN_CLASS =
  "h-screen overflow-hidden bg-paper p-2 text-ink sm:p-3";

const DEFAULT_SECTION_CLASS =
  "min-w-0 overflow-y-auto rounded-card bg-surface p-3 transition-colors duration-base sm:p-4";

export function WorkspaceShell({
  sidebar,
  children,
  sectionClassName = DEFAULT_SECTION_CLASS,
  mainClassName = DEFAULT_MAIN_CLASS,
}: WorkspaceShellProps) {
  return (
    <main className={mainClassName}>
      <div className="grid h-[calc(100vh-16px)] gap-3 transition-[grid-template-columns] duration-200 lg:grid-cols-[290px_minmax(0,1fr)] has-[aside[data-collapsed=true]]:lg:grid-cols-[72px_minmax(0,1fr)]">
        {sidebar}
        <section className={sectionClassName}>{children}</section>
      </div>
    </main>
  );
}
