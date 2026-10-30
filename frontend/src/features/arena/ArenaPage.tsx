import { useState } from "react";
import { Link } from "react-router";

import { useProjectStore } from "@/stores/project";

import { ArenaCanvas } from "./ArenaCanvas";
import type { Selection } from "./ArenaLayers";
import { PropertiesPanel } from "./PropertiesPanel";

export function ArenaPage() {
  const scenario = useProjectStore((s) => s.scenario);
  const [selection, setSelection] = useState<Selection>(null);

  if (!scenario) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">No scenario loaded</h1>
        <p className="max-w-md text-muted">
          The arena view shows the field, obstacles and missions of a scenario. Load one from the
          overview to begin.
        </p>
        <Link
          to="/"
          className="rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong"
        >
          Choose a scenario
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <section aria-label={`Arena of ${scenario.name}`} className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <h1 className="font-semibold">Arena</h1>
          <span className="truncate text-muted">{scenario.name}</span>
        </header>
        <div className="min-h-0 flex-1">
          <ArenaCanvas scenario={scenario} selection={selection} onSelect={setSelection} />
        </div>
      </section>
      <PropertiesPanel scenario={scenario} selection={selection} />
    </div>
  );
}
