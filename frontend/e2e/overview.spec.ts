import { expect, parseDisplayNumber, tableRows, test, waitForWidgets, widget } from "./helpers";

test.describe("overview dashboard", () => {
  test("shows six KPI cards with period-over-period deltas", async ({ dashboard: page }) => {
    const kpis = page.getByRole("group", { name: "Key metrics" }).getByRole("button");
    await expect(kpis).toHaveCount(6);
    for (const label of ["Sessions", "Users", "New users", "Views", "Avg. session duration", "Engagement rate"]) {
      const card = kpis.filter({ hasText: label }).first();
      await expect(card).toBeVisible();
      await expect(card.getByTitle("vs. previous period")).toContainText(/[+-]\d+\.\d%/);
    }
    expect(parseDisplayNumber((await kpis.nth(0).textContent()) ?? "")).toBeGreaterThan(0);
  });

  test("KPI cards toggle series on the trend chart", async ({ dashboard: page }) => {
    const trend = widget(page, "Trend");
    await expect(trend.locator(".recharts-line")).toHaveCount(2);
    await expect(trend).toContainText("Sessions, Users");

    await page.getByRole("button", { name: /^Views/ }).click();
    await expect(trend.locator(".recharts-line")).toHaveCount(3);
    await expect(trend).toContainText("Sessions, Users, Views");

    await page.getByRole("button", { name: /^Users/ }).click();
    await page.getByRole("button", { name: /^Views/ }).click();
    await expect(trend.locator(".recharts-line")).toHaveCount(1);

    // The last series cannot be removed.
    await page.getByRole("button", { name: /^Sessions/ }).click();
    await expect(trend.locator(".recharts-line")).toHaveCount(1);
  });

  test("rate metrics get a secondary axis", async ({ dashboard: page }) => {
    const trend = widget(page, "Trend");
    await expect(trend.locator(".recharts-yAxis")).toHaveCount(1);
    await page.getByRole("button", { name: /^Engagement rate/ }).click();
    await expect(trend.locator(".recharts-yAxis")).toHaveCount(2);
  });

  test("switches between line, area and bar charts", async ({ dashboard: page }) => {
    const trend = widget(page, "Trend");
    await page.getByRole("radio", { name: "Bar" }).click();
    await expect(trend.locator(".recharts-bar")).toHaveCount(2);
    await page.getByRole("radio", { name: "Area" }).click();
    await expect(trend.locator(".recharts-area")).toHaveCount(2);
    await page.getByRole("radio", { name: "Line" }).click();
    await expect(trend.locator(".recharts-line")).toHaveCount(2);
  });

  test("hovering the trend shows a tooltip with formatted values", async ({ dashboard: page }) => {
    const surface = widget(page, "Trend").locator(".recharts-wrapper").first();
    const box = await surface.boundingBox();
    if (!box) throw new Error("chart not rendered");
    // Glide across the plot area so Recharts receives real mousemove events.
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.4, { steps: 10 });
    const tooltip = widget(page, "Trend").locator(".recharts-tooltip-wrapper");
    await expect(tooltip).toContainText("Sessions");
    await expect(tooltip).toContainText(/\d/);
  });

  test("clicking a channel filters KPIs and charts, and the numbers agree with the channel table", async ({
    dashboard: page,
  }) => {
    const totalSessions = parseDisplayNumber((await page.getByRole("button", { name: /^Sessions/ }).textContent()) ?? "");

    // Select "Organic Search" from the channel donut's legend.
    await widget(page, "Sessions by channel").getByText("Organic Search", { exact: false }).first().click();
    await expect(page.getByText("Channel: Organic Search")).toBeVisible();
    await waitForWidgets(page);

    const filteredSessions = parseDisplayNumber((await page.getByRole("button", { name: /^Sessions/ }).textContent()) ?? "");
    expect(filteredSessions).toBeGreaterThan(0);
    expect(filteredSessions).toBeLessThan(totalSessions);

    // Cross-check against the Acquisition channel table (same backend data, different endpoint).
    await page.getByRole("link", { name: "Acquisition" }).click();
    const row = tableRows(page, "Channels table").filter({ hasText: "Organic Search" });
    const tableSessions = parseDisplayNumber((await row.locator("td").nth(1).textContent()) ?? "");
    expect(tableSessions).toBe(filteredSessions);
  });

  test("selecting a device replaces the channel filter; clearing restores totals", async ({ dashboard: page }) => {
    const sessionsCard = page.getByRole("button", { name: /^Sessions/ });
    const total = (await sessionsCard.textContent()) ?? "";

    await widget(page, "Sessions by channel").getByText("Direct", { exact: false }).first().click();
    await expect(page.getByText("Channel: Direct")).toBeVisible();
    await waitForWidgets(page);

    await widget(page, "Sessions by device").getByText("mobile", { exact: false }).first().click();
    await expect(page.getByText("Device: mobile")).toBeVisible();
    await expect(page.getByText("Channel: Direct")).toBeHidden();
    await waitForWidgets(page);

    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(page.getByText("Device: mobile")).toBeHidden();
    await waitForWidgets(page);
    await expect(sessionsCard).toHaveText(total);
  });
});
