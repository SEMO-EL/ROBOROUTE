import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { router } from "./app/routes";
import { restoreLastProject, startAutosave } from "./stores/autosave";
import { projects, storage } from "./stores/persistence";

restoreLastProject(projects, storage);
startAutosave(projects, storage);

const container = document.getElementById("root");
if (!container) throw new Error("index.html is missing the #root element");

createRoot(container).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
