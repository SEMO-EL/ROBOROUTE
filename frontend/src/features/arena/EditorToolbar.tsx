import { Magnet, Redo2, Undo2 } from "lucide-react";

import type { Tool } from "./ArenaCanvas";
import { TOOLS } from "./tools";

interface ToolbarProps {
  tool: Tool;
  onTool: (tool: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  snap: boolean;
  onSnap: (snap: boolean) => void;
}

const buttonClass =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-surface-2 aria-pressed:text-accent";

export function EditorToolbar({
  tool,
  onTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  snap,
  onSnap,
}: ToolbarProps) {
  return (
    <div role="toolbar" aria-label="Editing tools" className="flex items-center gap-0.5">
      {TOOLS.map(({ tool: value, label, icon: Icon, shortcut }) => (
        <button
          key={value}
          type="button"
          className={buttonClass}
          aria-label={label}
          aria-pressed={tool === value}
          title={`${label} (${shortcut})`}
          onClick={() => {
            onTool(value);
          }}
        >
          <Icon aria-hidden="true" className="size-4" />
        </button>
      ))}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
      <button
        type="button"
        className={buttonClass}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
      >
        <Undo2 aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={buttonClass}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={onRedo}
      >
        <Redo2 aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={buttonClass}
        aria-label="Snap to 1 cm"
        aria-pressed={snap}
        title="Snap positions to 1 cm"
        onClick={() => {
          onSnap(!snap);
        }}
      >
        <Magnet aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
