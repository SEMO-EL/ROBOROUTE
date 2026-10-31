import type { ReactNode } from "react";
import { Link } from "react-router";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-4 py-2.5">
        <h2 className="font-semibold">{title}</h2>
      </header>
      <div className="flex flex-col gap-3 p-4 text-sm">{children}</div>
    </section>
  );
}

/** What is missing before a lesson can run, and where to fix it. */
export function Missing({
  children,
  to,
  action,
}: {
  children: ReactNode;
  to: string;
  action: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-surface p-4 text-sm">
      <p className="text-muted">{children}</p>
      <Link
        to={to}
        className="rounded-md border border-border bg-surface-2 px-3 py-1.5 hover:border-border-strong"
      >
        {action}
      </Link>
    </div>
  );
}

export const primaryButton =
  "cursor-pointer self-start rounded-md bg-accent px-3 py-1.5 font-medium text-on-accent transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60";

/** Formulas set in monospace, preserving line breaks. */
export function Formula({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs leading-5 text-text">
      {children}
    </pre>
  );
}
