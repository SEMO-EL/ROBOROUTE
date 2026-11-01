import { createBrowserRouter } from "react-router";

import { OverviewPage } from "@/features/overview/OverviewPage";

import { PageError } from "./PageError";
import { Shell } from "./Shell";

// Pages other than the overview are loaded on first visit, keeping the initial download small.
export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <Shell />,
      hydrateFallbackElement: <p className="p-6 text-muted">Loading…</p>,
      children: [
        {
          // A page that fails to render shows an error in place; the sidebar keeps working.
          errorElement: <PageError />,
          children: [
            { index: true, element: <OverviewPage /> },
            {
              path: "arena",
              lazy: async () => ({
                Component: (await import("@/features/arena/ArenaPage")).ArenaPage,
              }),
            },
            {
              path: "missions",
              lazy: async () => ({
                Component: (await import("@/features/missions/MissionsPage")).MissionsPage,
              }),
            },
            {
              path: "robot",
              lazy: async () => ({
                Component: (await import("@/features/robot/RobotPage")).RobotPage,
              }),
            },
            {
              path: "strategy",
              lazy: async () => ({
                Component: (await import("@/features/strategy/StrategyPage")).StrategyPage,
              }),
            },
            {
              path: "simulation",
              lazy: async () => ({
                Component: (await import("@/features/simulation/SimulationPage")).SimulationPage,
              }),
            },
            {
              path: "experiments",
              lazy: async () => ({
                Component: (await import("@/features/experiments/ExperimentsPage")).ExperimentsPage,
              }),
            },
            {
              path: "learn",
              lazy: async () => ({
                Component: (await import("@/features/learn/LearnPage")).LearnPage,
              }),
            },
          ],
        },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
