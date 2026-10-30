import { createBrowserRouter } from "react-router";

import { ArenaPage } from "@/features/arena/ArenaPage";
import { OverviewPage } from "@/features/overview/OverviewPage";

import { Shell } from "./Shell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "arena", element: <ArenaPage /> },
    ],
  },
]);
