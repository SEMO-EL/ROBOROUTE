import { Ban, Circle, Flag, MousePointer2, Square, type LucideIcon } from "lucide-react";

import type { Tool } from "./ArenaCanvas";

export const TOOLS: { tool: Tool; label: string; icon: LucideIcon; shortcut: string }[] = [
  { tool: "select", label: "Select", icon: MousePointer2, shortcut: "V" },
  { tool: "rect", label: "Add rectangle obstacle", icon: Square, shortcut: "R" },
  { tool: "circle", label: "Add circle obstacle", icon: Circle, shortcut: "C" },
  { tool: "nogo", label: "Add keep-out area", icon: Ban, shortcut: "K" },
  { tool: "mission", label: "Add mission", icon: Flag, shortcut: "M" },
];

export const TOOL_SHORTCUTS: Record<string, Tool> = Object.fromEntries(
  TOOLS.map(({ tool, shortcut }) => [shortcut.toLowerCase(), tool]),
);
