import { expect, test } from "@playwright/test";
import { selectProperty, signIn, waitForWidgets } from "./helpers";

const PAGES = [
  { path: "overview", title: "Overview", marker: /compared to the previous period/ },
  { path: "audience", title: "Audience", marker: /Who your visitors are/ },
  { path: "acquisition", title: "Acquisition", marker: /Where your traffic comes from/ },
  { path: "content", title: "Content", marker: /Which pages and events perform best/ },
  { path: "geography", title: "Geography", marker: /Where in the world/ },
  { path: "explore", title: "Explore", marker: /Build a report/ },
];

test.describe("navigation & shell", () => {
  test("asks for a property before showing any dashboard", async ({ page }) => {
    await signIn(page);
    await expect(page.getByText("Connect a GA4 property")).toBeVisible();
    await expect(page.getByText(/In demo mode any number works/)).toBeVisible();

    // The empty state is shown on every page until a property is chosen.
    await page.getByRole("link", { name: "Geography" }).click();
    await expect(page.getByText("Connect a GA4 property")).toBeVisible();

    await selectProperty(page, "42");
    await expect(page.getByText(/Where in the world/)).toBeVisible();
  });

  test("navigates between every dashboard via the sidebar", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);

    for (const { path, title, marker } of PAGES) {
      await page.getByRole("navigation", { name: "Dashboards" }).getByRole("link", { name: title }).click();
      await expect(page).toHaveURL(new RegExp(`/dashboard/${path}(\\?.*)?$`));
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
      await expect(page.getByText(marker)).toBeVisible();
      await expect(page.getByRole("link", { name: title, exact: true })).toHaveAttribute("aria-current", "page");
      await waitForWidgets(page);
    }
  });

  test("deep links work and unknown routes fall back sensibly", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);

    await page.goto("/dashboard/content");
    await expect(page.getByRole("heading", { level: 1, name: "Content" })).toBeVisible();

    await page.goto("/dashboard/does-not-exist");
    await expect(page).toHaveURL(/\/dashboard\/overview(\?.*)?$/);

    await page.goto("/nowhere");
    await expect(page).toHaveURL(/\/dashboard\/overview(\?.*)?$/); // signed in → straight to the dashboard
  });

  test("property and date range persist across pages and reloads", async ({ page }) => {
    await signIn(page);
    await selectProperty(page, "777");

    await page.getByRole("button", { name: /Last 30 days/ }).click();
    await page.getByRole("button", { name: "Last 7 days" }).click();

    await page.getByRole("link", { name: "Audience" }).click();
    await expect(page.getByRole("button", { name: /Last 7 days/ })).toBeVisible();
    await expect(page.getByText("Property 777")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /Last 7 days/ })).toBeVisible();
    await expect(page.getByLabel("GA4 Property ID").first()).toHaveValue("777");
  });

  test("changing the property reloads every widget with different numbers", async ({ page }) => {
    await signIn(page);
    await selectProperty(page, "111");
    await waitForWidgets(page);
    const sessionsFor111 = await page.getByRole("button", { name: /^Sessions/ }).textContent();

    await selectProperty(page, "222");
    await waitForWidgets(page);
    const sessionsFor222 = await page.getByRole("button", { name: /^Sessions/ }).textContent();

    expect(sessionsFor111).not.toEqual(sessionsFor222);
  });
});

test.describe("shareable URLs", () => {
  test("state is mirrored into the query string and restored from it", async ({ page }) => {
    await signIn(page);
    await selectProperty(page, "321");
    await page.getByRole("button", { name: /Last 30 days/ }).click();
    await page.getByRole("button", { name: "Last 14 days" }).click();

    await expect(page).toHaveURL(/property=321/);
    await expect(page).toHaveURL(/start=13daysAgo/);
    await expect(page).toHaveURL(/end=today/);

    // Sidebar navigation keeps the query string.
    await page.getByRole("link", { name: "Content", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/content\?.*property=321/);

    // Open the link in a brand-new context (fresh localStorage) → same view.
    const url = page.url();
    const fresh = await page.context().browser()!.newContext();
    const other = await fresh.newPage();
    await other.goto("/");
    await other.getByRole("button", { name: /Continue with demo data/ }).click();
    await other.goto(url);
    await expect(other.getByRole("heading", { level: 1, name: "Content" })).toBeVisible();
    await expect(other.getByText("Property 321")).toBeVisible();
    await expect(other.getByRole("button", { name: /Last 14 days/ })).toBeVisible();
    await fresh.close();
  });

  test("refresh button refetches data and reports when it was updated", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);
    await waitForWidgets(page);
    const refresh = page.getByRole("button", { name: "Refresh data" });
    await expect(refresh).toContainText(/Updated just now/);
    await refresh.click();
    await waitForWidgets(page);
    await expect(refresh).toBeEnabled();
    await expect(refresh).toContainText(/Updated just now/);
  });

  test("document title follows the page", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);
    await expect(page).toHaveTitle("Overview · GA Dashboard");
    await page.getByRole("link", { name: "Explore" }).click();
    await expect(page).toHaveTitle("Explore · GA Dashboard");
  });
});
