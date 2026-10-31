import { Outlet } from "react-router";

import { useProjectStore } from "@/stores/project";

import { Sidebar } from "./Sidebar";
import { StatusBar } from "./StatusBar";

/** Application frame: navigation on the left, the routed page fills the workspace. */
function SaveStatus() {
  const storageError = useProjectStore((s) => s.storageError);
  if (!storageError) return null;
  return (
    <div
      role="alert"
      className="border-b border-warning/40 bg-warning/10 px-4 py-1.5 text-sm text-warning"
    >
      {storageError}
    </div>
  );
}

export function Shell() {
  return (
    <div className="flex h-full min-h-0">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent focus:not-sr-only focus:absolute focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <SaveStatus />
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-auto outline-none">
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
