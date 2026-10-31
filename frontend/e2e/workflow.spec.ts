import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

/** Clicks the arena at (x, y) metres in field coordinates (origin bottom-left, y up). */
async function clickField(page: Page, x: number, y: number, field = { width: 2.36, height: 1.14 }) {
  const box = await page.getByTestId("arena-svg").locator("rect.fill-field").first().boundingBox();
  if (!box) throw new Error("arena field not visible");
  await page.mouse.click(
    box.x + (x / field.width) * box.width,
    box.y + (1 - y / field.height) * box.height,
  );
}

async function go(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: label, exact: true })
    .click();
}

async function setNumber(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(value);
  await field.press("Enter");
}

test("a student builds a field, plans, simulates, saves and explains a strategy", async ({
  page,
}) => {
  test.setTimeout(180_000);

  // 1. A new blank project for a single-run competition.
  await page.goto("/");
  await page.getByRole("button", { name: /One continuous run/ }).click();
  await expect(page.getByText("Valid scenario")).toBeVisible();

  // 2. The arena (2.36 m × 1.14 m blank field): one obstacle and two missions. "Valid scenario"
  // also means the robot can stand at every approach pose.
  await page.getByRole("button", { name: "Add rectangle obstacle" }).click();
  await clickField(page, 0.9, 0.6);
  await page.getByRole("button", { name: "Add mission" }).click();
  await clickField(page, 1.7, 0.75);
  await page.getByRole("button", { name: "Add mission" }).click();
  await clickField(page, 1.9, 0.35);
  await expect(page.getByText("Valid scenario")).toBeVisible();

  // 3. Mission details: points for each mission.
  await go(page, "Missions");
  const missionList = page.getByRole("navigation", { name: "Mission list" });
  const missions = missionList.getByRole("button").filter({ hasNotText: "Add mission" });
  await expect(missions).toHaveCount(2);
  await missions.nth(0).click();
  await setNumber(page, "Points (pts)", "40");
  await missions.nth(1).click();
  await setNumber(page, "Points (pts)", "25");

  // 4. Robot calibration from two stopwatch measurements.
  await go(page, "Robot");
  await page.getByLabel("Distance 1 (cm)").fill("50");
  await page.getByLabel("Time 1 (s)").fill("2.2");
  if ((await page.getByLabel("Distance 2 (cm)").count()) === 0) {
    await page.getByRole("button", { name: "Add measurement" }).first().click();
  }
  await page.getByLabel("Distance 2 (cm)").fill("100");
  await page.getByLabel("Time 2 (s)").fill("3.9");
  await page.getByRole("button", { name: "Fit driving speed" }).click();
  await expect(page.getByText("Top speed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Apply to robot" }).first().click();

  // 5. The optimal plan.
  await go(page, "Strategy");
  await page.getByRole("button", { name: "Optimise" }).click();
  await expect(page.getByText("Why this plan")).toBeVisible({ timeout: 30_000 });

  // 6. Monte Carlo simulation of the optimal and greedy plans.
  await go(page, "Simulation");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByText("Plans compared")).toBeVisible({ timeout: 60_000 });

  // 7. Saved as an experiment.
  await page.getByRole("button", { name: "Save as experiment" }).click();
  await page.getByRole("link", { name: "Open experiments" }).click();
  await expect(page).toHaveURL(/\/experiments$/);
  await expect(page.getByRole("button", { name: /^View / })).toHaveCount(1);

  // 8. After a reload the project and experiment are still there and reproduce exactly.
  await page.reload();
  await page
    .getByRole("button", { name: /^View / })
    .first()
    .click();
  await page.getByRole("button", { name: "Reproduce" }).click();
  await expect(page.getByText(/Reproduced exactly/)).toBeVisible({ timeout: 60_000 });

  // 9. Exports: the experiment file and the per-trial CSV.
  const [jsonDownload] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: /^Export / })
      .first()
      .click(),
  ]);
  const exported = JSON.parse(await readFile(await jsonDownload.path(), "utf-8")) as {
    format: string;
    schema_version: number;
  };
  expect(exported.format).toBe("roboroute-experiment");
  expect(exported.schema_version).toBe(1);
  const [csvDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Trials CSV/ }).click(),
  ]);
  const csv = await readFile(await csvDownload.path(), "utf-8");
  expect(csv.split("\n")[0]).toMatch(/^plan,trial,score,completion_time_s,cut_off/);

  // 10. The Learn page replays the search behind a route.
  await go(page, "Learn");
  await page.getByRole("button", { name: "Plan route" }).click();
  await expect(page.getByText(/Step 0 of/)).toBeVisible();
  await page.getByRole("button", { name: "Last step" }).click();
  await expect(page.getByText(/matches the route's grid path/)).toBeVisible();
});
