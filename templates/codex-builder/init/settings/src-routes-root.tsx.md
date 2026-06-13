---
target: src/routes/__root.tsx
---
import '@vitejs/plugin-react/preamble';
import '@/styles/app.css';
import { Suspense } from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Providers } from "@/app/providers";
import { RouteLoadingBar } from "@/components/layout/route-loading-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NotFound } from "@/components/store/not-found";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRoute({ component: Root, notFoundComponent: NotFound });

const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('storefront-theme')||'light';if(t==='dark'){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){document.documentElement.classList.remove('dark');}})();`;

function Root() {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body>
        <Providers>
          <RouteLoadingBar />
          <SiteHeader />
          <Suspense fallback={<RouteSuspenseFallback />}>
            <Outlet />
          </Suspense>
          <SiteFooter />
          <Toaster />
        </Providers>
        <Scripts />
      </body>
    </html>
  );
}

function RouteSuspenseFallback() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-12">
      <div className="space-y-8">
        <div className="space-y-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted/50" />
          <div className="h-12 w-full max-w-xl animate-pulse rounded bg-muted/60" />
          <div className="h-5 w-full max-w-2xl animate-pulse rounded bg-muted/50" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-lg border bg-muted/40" />
          ))}
        </div>
      </div>
    </main>
  );
}
