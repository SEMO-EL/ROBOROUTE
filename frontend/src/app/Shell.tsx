import { Outlet } from "react-router";

import { Sidebar } from "./Sidebar";

/** Application frame: navigation on the left, the routed page fills the workspace. */
export function Shell() {
  return (
    <div className="flex h-full min-h-0">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
