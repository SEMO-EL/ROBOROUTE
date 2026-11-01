import { NavLink } from "react-router";

import { NAV_ITEMS } from "./navigation";

export function Sidebar() {
  return (
    <aside className="flex w-14 shrink-0 flex-col border-r border-border bg-surface md:w-52">
      <div className="flex h-12 items-center gap-2 border-b border-border px-4.5 md:px-4">
        <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="size-5" />
        <span className="hidden font-semibold tracking-tight md:inline">RoboRoute</span>
      </div>
      <nav aria-label="Main" className="flex flex-col gap-0.5 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, description }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={description}
            className={({ isActive }) =>
              [
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 transition-colors duration-150",
                isActive
                  ? "bg-surface-2 text-text"
                  : "text-muted hover:bg-surface-2/60 hover:text-text",
              ].join(" ")
            }
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {/* Phones show icons only; the name stays available to screen readers. */}
            <span className="sr-only md:not-sr-only">{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
