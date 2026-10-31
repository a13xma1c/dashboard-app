import { expect, tableRows, test, waitForWidgets, widget } from "./helpers";

test.describe("explore / custom reports", () => {
  test("runs the default sessions-by-date report", async ({ dashboard: page }) => {
    await page.getByRole("link", { name: "Explore" }).click();
    await waitForWidgets(page);
    await expect(page.getByRole("checkbox", { name: "Date" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "Sessions", exact: true })).toBeChecked();
    await expect(widget(page, "Chart").locator(".recharts-line")).toHaveCount(2);
    await expect(widget(page, "Results")).toContainText("30 rows");
  });

  test("builds a categorical report and charts it as bars", async ({ dashboard: page }) => {
    await page.goto("/dashboard/explore");
    await waitForWidgets(page);

    await page.getByRole("checkbox", { name: "Date" }).uncheck();
    await page.getByRole("checkbox", { name: "Country" }).check();
    await page.getByRole("checkbox", { name: "Total users" }).uncheck();
    await page.getByRole("checkbox", { name: "Engagement rate" }).check();
    await page.getByLabel("Row limit").fill("8");
    await page.getByRole("button", { name: "Run report" }).click();

    await expect(widget(page, "Top 8 by sessions")).toBeVisible();
    await expect(widget(page, "Top 8 by sessions").locator(".recharts-bar-rectangle")).toHaveCount(8);
    await expect(tableRows(page, "Custom report results")).toHaveCount(8);
    const headers = page.getByRole("table", { name: "Custom report results" }).getByRole("columnheader");
    await expect(headers).toHaveText([/Country/, /Sessions/, /Engagement rate/]);
    await expect(tableRows(page, "Custom report results").first()).toContainText(/%/);
    await expect(page.getByRole("button", { name: "Re-run" })).toBeVisible();
  });

  test("enforces field limits", async ({ dashboard: page }) => {
    await page.goto("/dashboard/explore");
    await waitForWidgets(page);

    await page.getByRole("checkbox", { name: "Sessions", exact: true }).uncheck();
    await page.getByRole("checkbox", { name: "Total users" }).uncheck();
    await expect(page.getByRole("alert")).toHaveText("Select at least one metric.");
    await expect(page.getByRole("button", { name: "Run report" })).toBeDisabled();

    for (const name of ["Sessions", "Total users", "New users", "Views", "Event count"]) {
      await page.getByRole("checkbox", { name, exact: true }).check();
    }
    await expect(page.getByText("Metrics (5/5)")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Conversions" })).toBeDisabled();
  });

  test("multi-dimension reports render a table without a chart", async ({ dashboard: page }) => {
    await page.goto("/dashboard/explore");
    await waitForWidgets(page);
    await page.getByRole("checkbox", { name: "Device category" }).check();
    await page.getByRole("button", { name: "Run report" }).click();
    await waitForWidgets(page);
    await expect(widget(page, "Chart")).toBeHidden();
    const headers = page.getByRole("table", { name: "Custom report results" }).getByRole("columnheader");
    await expect(headers).toHaveText([/Date/, /Device/, /Sessions/, /Users/]);
  });

  test("exports the result as a CSV download", async ({ dashboard: page }) => {
    await page.goto("/dashboard/explore");
    await waitForWidgets(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBe("ga-123456789-date.csv");
    const path = await download.path();
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(path!, "utf8");
    const lines = content.trim().split("\r\n");
    expect(lines[0]).toBe("date,sessions,totalUsers");
    expect(lines).toHaveLength(31); // header + 30 days
    expect(lines[1]).toMatch(/^\d{8},\d+,\d+$/);
  });
});
