import { expect, test as base } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";

export const PROPERTY_ID = "123456789";
export const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:8000";

/** Click through the mock-mode login and land on the dashboard. */
export async function signIn(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: /Continue with demo data/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/overview(\?.*)?$/);
}

/** Enter a property ID in the header and wait for the dashboards to appear. */
export async function selectProperty(page: Page, propertyId = PROPERTY_ID): Promise<void> {
  const input = page.getByLabel("GA4 Property ID").first();
  await input.fill(propertyId);
  await input.press("Enter");
  await expect(page.getByText(`Property ${propertyId}`)).toBeVisible();
}

/** Wait until no widget on the page is loading or refetching. */
export async function waitForWidgets(page: Page): Promise<void> {
  await expect(page.locator("[role='status'][aria-busy='true']")).toHaveCount(0);
  await expect(page.locator("section[aria-busy='true']")).toHaveCount(0);
}

/** A widget card by its accessible name. */
export function widget(page: Page, title: string | RegExp): Locator {
  return page.getByRole("region", { name: title });
}

/** Parse "12,345" / "64.1%" / "3m 59s" into a number for comparisons. */
export function parseDisplayNumber(text: string): number {
  const match = /-?[\d,]+(\.\d+)?/.exec(text);
  if (!match) throw new Error(`No number in ${JSON.stringify(text)}`);
  return Number(match[0].replace(/,/g, ""));
}

/** Body rows of a table by accessible name. */
export function tableRows(page: Page, name: string): Locator {
  return page.getByRole("table", { name }).locator("tbody tr");
}

/**
 * Test fixture that starts every test signed in with a property selected,
 * on the Overview page with all widgets loaded.
 */
export const test = base.extend<{ dashboard: Page }>({
  dashboard: async ({ page }, provide) => {
    await signIn(page);
    await selectProperty(page);
    await waitForWidgets(page);
    await provide(page);
  },
});

export { expect };
