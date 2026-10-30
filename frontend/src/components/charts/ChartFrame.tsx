import type { ReactNode } from "react";

/** Title, chart, and a table view of the same data (charts never rely on sight alone). */
export function ChartFrame({
  title,
  subtitle,
  children,
  table,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption>
        <div className="font-medium">{title}</div>
        {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
      </figcaption>
      {children}
      <details className="text-xs text-muted">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <div className="mt-2 max-h-56 overflow-auto">{table}</div>
      </details>
    </figure>
  );
}

export const tableClass =
  "w-full text-left font-mono text-xs [&_td]:py-0.5 [&_th]:py-0.5 [&_th]:font-sans [&_th]:font-medium";
