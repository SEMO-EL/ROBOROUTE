import { Link, useRouteError } from "react-router";

import { ErrorAlert } from "@/components/Alert";

/** Shown in place of a page that failed to render; the sidebar keeps working. */
export function PageError() {
  const error = useRouteError();
  return (
    <div className="flex flex-col gap-3 p-6">
      <h1 className="text-lg font-semibold">This page could not be shown</h1>
      <ErrorAlert>{error instanceof Error ? error.message : String(error)}</ErrorAlert>
      <p>
        <Link to="/" className="underline underline-offset-2">
          Back to the overview
        </Link>
      </p>
    </div>
  );
}
