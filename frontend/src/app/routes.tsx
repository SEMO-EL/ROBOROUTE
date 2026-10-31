import { createBrowserRouter } from "react-router";

import { ArenaPage } from "@/features/arena/ArenaPage";
import { MissionsPage } from "@/features/missions/MissionsPage";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { SimulationPage } from "@/features/simulation/SimulationPage";
import { StrategyPage } from "@/features/strategy/StrategyPage";

import { Shell } from "./Shell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: "arena", element: <ArenaPage /> },
      { path: "missions", element: <MissionsPage /> },
      { path: "strategy", element: <StrategyPage /> },
      { path: "simulation", element: <SimulationPage /> },
    ],
  },
]);
