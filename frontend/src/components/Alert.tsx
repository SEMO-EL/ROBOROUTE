import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorAlert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-danger"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}
