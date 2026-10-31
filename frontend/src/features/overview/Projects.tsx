import { Copy, Download, FolderOpen, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

import { ErrorAlert } from "@/components/Alert";
import { api, unwrap } from "@/lib/api/client";
import { download, ImportError, parseFile, projectFile, safeFilename } from "@/lib/storage/files";
import type { Repository, StoredExperiment, StoredProject } from "@/lib/storage/repository";
import { experiments as experimentRepo, projects as projectRepo } from "@/stores/persistence";
import { newProjectId, useProjectStore } from "@/stores/project";

type ApiClient = typeof api;

interface ProjectsProps {
  repository?: Repository<StoredProject>;
  experiments?: Repository<StoredExperiment>;
  client?: ApiClient;
}

const iconButton =
  "flex size-8 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-text";

/** Saved projects in this browser, plus import of RoboRoute files. */
export function Projects({
  repository = projectRepo,
  experiments = experimentRepo,
  client = api,
}: ProjectsProps) {
  const currentId = useProjectStore((s) => s.projectId);
  // Re-read the list whenever the current scenario is saved (autosave runs on every change).
  useProjectStore((s) => s.scenario);
  const replace = useProjectStore((s) => s.replace);
  const navigate = useNavigate();
  const [, refresh] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const { items, warnings } = repository.list();
  const saved = [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function open(project: StoredProject) {
    replace(project.scenario, project.id);
    void navigate("/arena");
  }

  function duplicate(project: StoredProject) {
    try {
      const name = `${project.name} (copy)`;
      repository.save({
        id: newProjectId(),
        name,
        updatedAt: new Date().toISOString(),
        scenario: { ...project.scenario, name },
      });
      refresh((n) => n + 1);
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    }
  }

  async function importFile(file: File) {
    setMessage(null);
    try {
      const parsed = parseFile(await file.text());
      if (parsed.kind === "experiment") {
        experiments.save({ ...parsed.experiment, id: newProjectId() });
        setMessage({
          kind: "ok",
          text: `Imported experiment “${parsed.experiment.name}”. Open it on the Experiments page.`,
        });
        return;
      }
      const report = await unwrap(
        client.POST("/api/v1/scenarios/validate", { body: parsed.scenario }),
      );
      const errors = report.issues.filter((issue) => issue.severity === "error");
      if (errors.length > 0) {
        setMessage({
          kind: "error",
          text: `The file's scenario is not valid: ${errors.map((e) => e.message).join("; ")}`,
        });
        return;
      }
      replace(parsed.scenario);
      setMessage({ kind: "ok", text: `Opened “${parsed.name}” as a new project.` });
    } catch (error) {
      const text =
        error instanceof ImportError || error instanceof Error ? error.message : String(error);
      setMessage({ kind: "error", text });
    }
  }

  return (
    <section aria-labelledby="projects-title" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="projects-title" className="text-xs font-medium tracking-wide text-muted uppercase">
          Your projects (saved in this browser)
        </h2>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-surface-2">
          <Upload aria-hidden="true" className="size-4" />
          Import file
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Import a RoboRoute file"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importFile(file);
            }}
          />
        </label>
      </div>
      {message?.kind === "error" && <ErrorAlert>{message.text}</ErrorAlert>}
      {message?.kind === "ok" && (
        <p className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-success">
          {message.text}
        </p>
      )}
      {warnings.map((warning) => (
        <p key={warning} className="text-xs text-warning">
          {warning}
        </p>
      ))}
      {saved.length === 0 ? (
        <p className="text-muted">
          Nothing saved yet. Open an example or start a blank field — RoboRoute saves your work
          automatically.
        </p>
      ) : (
        <ul
          aria-label="Saved projects"
          className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface"
        >
          {saved.map((project) => (
            <li key={project.id} className="flex items-center gap-3 px-4 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">
                  {project.name}
                  {project.id === currentId && (
                    <span className="ml-2 text-xs text-accent">open</span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {project.scenario.missions.length} missions · saved{" "}
                  {new Date(project.updatedAt).toLocaleString()}
                </div>
              </div>
              {confirming === project.id ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted">Delete for good?</span>
                  <button
                    type="button"
                    aria-label="Confirm delete"
                    onClick={() => {
                      repository.remove(project.id);
                      setConfirming(null);
                      refresh((n) => n + 1);
                    }}
                    className="cursor-pointer rounded-md bg-danger/20 px-2 py-1 text-danger hover:bg-danger/30"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null);
                    }}
                    className="cursor-pointer rounded-md px-2 py-1 text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Open ${project.name}`}
                    title="Open"
                    className={iconButton}
                    onClick={() => {
                      open(project);
                    }}
                  >
                    <FolderOpen aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Duplicate ${project.name}`}
                    title="Duplicate"
                    className={iconButton}
                    onClick={() => {
                      duplicate(project);
                    }}
                  >
                    <Copy aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Export ${project.name}`}
                    title="Export as a file"
                    className={iconButton}
                    onClick={() => {
                      download(
                        `${safeFilename(project.name)}.roboroute.json`,
                        projectFile(project),
                      );
                    }}
                  >
                    <Download aria-hidden="true" className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${project.name}`}
                    title="Delete"
                    className={iconButton}
                    onClick={() => {
                      setConfirming(project.id);
                    }}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
