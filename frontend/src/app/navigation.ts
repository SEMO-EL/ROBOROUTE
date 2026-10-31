import {
  ChartNoAxesColumn,
  Flag,
  LayoutDashboard,
  Map,
  Route,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Pages shown in the sidebar. Only pages that actually work are listed — RoboRoute never shows
 * placeholder navigation for features that do not exist yet.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, description: "Project summary" },
  { to: "/arena", label: "Arena", icon: Map, description: "Field, obstacles and missions" },
  {
    to: "/missions",
    label: "Missions",
    icon: Flag,
    description: "Points, durations, reliability, constraints",
  },
  { to: "/strategy", label: "Strategy", icon: Route, description: "Optimal mission plan" },
  {
    to: "/simulation",
    label: "Simulation",
    icon: ChartNoAxesColumn,
    description: "Plans under uncertainty",
  },
];
