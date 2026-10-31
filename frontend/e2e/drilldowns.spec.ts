import { expect, parseDisplayNumber, tableRows, test, waitForWidgets, widget } from "./helpers";

test.describe("audience cross-filtering", () => {
  test("selecting a device narrows browsers, hours and the trend", async ({ dashboard: page }) => {
    await page.getByRole("link", { name: "Audience" }).click();
    await waitForWidgets(page);

    const browsers = widget(page, "Browsers");
    const chromeBefore = parseDisplayNumber((await browsers.getByText(/^[\d,]+$/).first().textContent()) ?? "");

    await widget(page, "Devices").getByText("tablet", { exact: false }).first().click();
    await expect(page.getByText("Device: tablet")).toBeVisible();
    await waitForWidgets(page);

    const chromeAfter = parseDisplayNumber((await browsers.getByText(/^[\d,]+$/).first().textContent()) ?? "");
    expect(chromeAfter).toBeLessThan(chromeBefore);

    // Selecting a browser bar moves the filter to that dimension.
    await browsers.locator(".recharts-bar-rectangle").first().click();
    await expect(page.getByText(/Browser: /)).toBeVisible();
    await expect(page.getByText("Device: tablet")).toBeHidden();

    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(page.getByText(/Browser: /)).toBeHidden();
  });
});

test.describe("acquisition", () => {
  test("clicking a channel row focuses the stacked chart and tables on it", async ({ dashboard: page }) => {
    await page.getByRole("link", { name: "Acquisition" }).click();
    await waitForWidgets(page);

    const stacked = widget(page, "Sessions by channel over time");
    await expect(stacked).toContainText("Top 5 channels, stacked");
    await expect(stacked.locator(".recharts-area")).toHaveCount(6);

    const referral = tableRows(page, "Channels table").filter({ hasText: "Referral" });
    await referral.click();
    await expect(page.getByText("Channel: Referral")).toBeVisible();
    await expect(referral).toHaveAttribute("aria-selected", "true");
    await expect(stacked).toContainText("Only Referral");
    await expect(stacked.locator(".recharts-area")).toHaveCount(1);
    await waitForWidgets(page);

    // Clicking the selected row again clears the filter.
    await referral.click();
    await expect(page.getByText("Channel: Referral")).toBeHidden();
    await expect(stacked).toContainText("Top 5 channels, stacked");
  });

  test("source / medium table is searchable and paginated", async ({ dashboard: page }) => {
    await page.goto("/dashboard/acquisition");
    await waitForWidgets(page);
    const card = widget(page, "Source / medium");
    await expect(card.getByRole("navigation", { name: "Pagination" })).toContainText("Page 1 of");

    await card.getByRole("searchbox").fill("google");
    const rows = tableRows(page, "Source / medium table");
    await expect(rows.first()).toContainText("google");
    for (const row of await rows.all()) await expect(row).toContainText("google");
  });
});

test.describe("content", () => {
  test("clicking a page shows its trend and events", async ({ dashboard: page }) => {
    await page.goto("/dashboard/content");
    await waitForWidgets(page);

    await expect(widget(page, "Trend — all pages")).toBeVisible();
    const pricing = tableRows(page, "Top pages table").filter({ hasText: "/pricing" });
    await pricing.click();

    await expect(widget(page, "Trend for /pricing")).toBeVisible();
    await expect(widget(page, "Events")).toContainText("On /pricing");
    await expect(page.getByText("Page: /pricing")).toBeVisible();
    await waitForWidgets(page);
    await expect(widget(page, "Trend for /pricing").locator(".recharts-line")).toHaveCount(1);

    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(widget(page, "Trend — all pages")).toBeVisible();
  });

  test("trend metric chips add series", async ({ dashboard: page }) => {
    await page.goto("/dashboard/content");
    await waitForWidgets(page);
    const trend = widget(page, "Trend — all pages");
    await expect(trend.locator(".recharts-line")).toHaveCount(1);
    await trend.getByRole("group", { name: "Trend metrics" }).getByRole("button", { name: "Sessions" }).click();
    await expect(trend.locator(".recharts-line")).toHaveCount(2);
  });

  test("tables sort when a header is clicked", async ({ dashboard: page }) => {
    await page.goto("/dashboard/content");
    await waitForWidgets(page);
    const table = page.getByRole("table", { name: "Top pages table" });
    const viewsHeader = table.getByRole("columnheader", { name: /Views/ });
    await expect(viewsHeader).toHaveAttribute("aria-sort", "descending");

    await viewsHeader.getByRole("button").click();
    await expect(viewsHeader).toHaveAttribute("aria-sort", "ascending");
    const first = parseDisplayNumber((await tableRows(page, "Top pages table").first().locator("td").nth(1).textContent()) ?? "");
    const second = parseDisplayNumber((await tableRows(page, "Top pages table").nth(1).locator("td").nth(1).textContent()) ?? "");
    expect(first).toBeLessThanOrEqual(second);
  });
});

test.describe("geography", () => {
  test("drilling into a country shows only its cities, which add up to the country total", async ({ dashboard: page }) => {
    await page.goto("/dashboard/geography");
    await waitForWidgets(page);
    await expect(widget(page, "Top cities")).toBeVisible();

    const germany = tableRows(page, "Countries table").filter({ hasText: "Germany" });
    const germanySessions = parseDisplayNumber((await germany.locator("td").nth(1).textContent()) ?? "");
    await germany.click();

    await expect(page.getByText("Country: Germany")).toBeVisible();
    await expect(widget(page, "Sessions in Germany")).toBeVisible();
    await expect(widget(page, "Cities in Germany")).toBeVisible();
    await waitForWidgets(page);

    const cityRows = tableRows(page, "Cities table");
    await expect(cityRows).toHaveCount(3);
    const cities = await cityRows.allTextContents();
    expect(cities.join(" ")).toMatch(/Berlin/);
    expect(cities.join(" ")).toMatch(/Munich/);
    expect(cities.join(" ")).toMatch(/Hamburg/);

    let citiesTotal = 0;
    for (const row of await cityRows.all()) {
      citiesTotal += parseDisplayNumber((await row.locator("td").nth(1).textContent()) ?? "");
    }
    expect(Math.abs(citiesTotal - germanySessions)).toBeLessThanOrEqual(3); // rounding only
  });

  test("ranks countries by a different metric and selects from the bar chart", async ({ dashboard: page }) => {
    await page.goto("/dashboard/geography");
    await waitForWidgets(page);
    const top = widget(page, "Top countries");
    await top.getByRole("radio", { name: "New users" }).click();
    await expect(top).toContainText("By new users");

    await top.locator(".recharts-bar-rectangle").first().click();
    await expect(page.getByText(/Country: /)).toBeVisible();
    await expect(widget(page, /Cities in /)).toBeVisible();
  });
});
