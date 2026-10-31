import { expect, tableRows, test, waitForWidgets } from "./helpers";

test.describe("date range picker", () => {
  test("presets change the amount of data shown", async ({ dashboard: page }) => {
    await page.getByRole("link", { name: "Explore" }).click();
    await expect(tableRows(page, "Custom report results")).toHaveCount(15); // first page of 30 daily rows
    await expect(page.getByRole("region", { name: "Results" })).toContainText("30 rows");

    await page.getByRole("button", { name: /Last 30 days/ }).click();
    await page.getByRole("button", { name: "Last 7 days" }).click();
    await waitForWidgets(page);
    await expect(page.getByRole("region", { name: "Results" })).toContainText("7 rows");
    await expect(tableRows(page, "Custom report results")).toHaveCount(7);
  });

  test("applies a custom range and labels it", async ({ dashboard: page }) => {
    await page.getByRole("button", { name: /Last 30 days/ }).click();
    const dialog = page.getByRole("dialog", { name: "Select date range" });
    await dialog.getByLabel("Start").fill("2025-03-01");
    await dialog.getByLabel("End").fill("2025-03-14");
    await dialog.getByRole("button", { name: "Apply" }).click();

    await expect(page.getByRole("button", { name: /Mar 1, 2025 – Mar 14, 2025/ })).toBeVisible();
    await waitForWidgets(page);
    await expect(page.getByText(/Mar 1, 2025 – Mar 14, 2025 compared to the previous period/)).toBeVisible();

    await page.getByRole("link", { name: "Explore" }).click();
    await expect(page.getByRole("region", { name: "Results" })).toContainText("14 rows");
  });

  test("rejects an inverted custom range", async ({ dashboard: page }) => {
    await page.getByRole("button", { name: /Last 30 days/ }).click();
    const dialog = page.getByRole("dialog", { name: "Select date range" });
    await dialog.getByLabel("Start").fill("2025-03-10");
    await dialog.getByLabel("End").fill("2025-03-01");
    await dialog.getByRole("button", { name: "Apply" }).click();

    await expect(dialog.getByRole("alert")).toHaveText(/Start date must be before end date/);
    await expect(dialog).toBeVisible(); // stays open
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /Last 30 days/ })).toBeVisible(); // unchanged
  });

  test("closes with Escape", async ({ dashboard: page }) => {
    await page.getByRole("button", { name: /Last 30 days/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});
