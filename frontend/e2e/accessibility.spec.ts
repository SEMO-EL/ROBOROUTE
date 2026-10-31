import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** WCAG 2.2 A/AA violations of any impact, summarised for a readable failure. */
async function wcagViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
  }));
}

async function go(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: label, exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: label })).toBeVisible();
}

test("every page passes the automated WCAG 2.2 AA checks", async ({ page }) => {
  test.setTimeout(180_000);
  const report: Record<string, unknown[]> = {};

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  report.overview = await wcagViolations(page);

  await page.getByRole("button", { name: /Scenario B/ }).click();
  await expect(page.getByText("Fictional data")).toBeVisible();
  report["overview with scenario"] = await wcagViolations(page);

  for (const label of ["Arena", "Missions", "Robot", "Experiments"]) {
    await go(page, label);
    report[label] = await wcagViolations(page);
  }

  await go(page, "Strategy");
  await page.getByRole("button", { name: "Optimise" }).click();
  await expect(page.getByText("Why this plan")).toBeVisible({ timeout: 30_000 });
  report.Strategy = await wcagViolations(page);

  await go(page, "Simulation");
  await page.getByRole("button", { name: "Run simulation" }).click();
  await expect(page.getByText("Plans compared")).toBeVisible({ timeout: 60_000 });
  report.Simulation = await wcagViolations(page);

  await go(page, "Learn");
  await page.getByRole("button", { name: "Plan route" }).click();
  await expect(page.getByText(/Step 0 of/)).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  report["Learn: pathfinding"] = await wcagViolations(page);
  await page.getByRole("tab", { name: "Optimisation" }).click();
  report["Learn: optimisation"] = await wcagViolations(page);
  await page.getByRole("tab", { name: "Simulation" }).click();
  report["Learn: simulation"] = await wcagViolations(page);

  const failing = Object.fromEntries(Object.entries(report).filter(([, v]) => v.length > 0));
  expect(failing).toEqual({});
});

test("the main controls work from the keyboard", async ({ page }) => {
  await page.goto("/");
  // The first Tab reaches a skip link that jumps past the sidebar to the page content.
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main")).toBeFocused();
  await page.getByRole("button", { name: /Scenario A/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Fictional data")).toBeVisible();

  // Navigate inside the app: an example stays unsaved until edited, so a reload would drop it.
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Learn" }).click();
  await page.getByRole("tab", { name: "Pathfinding" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Optimisation" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Optimisation" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
