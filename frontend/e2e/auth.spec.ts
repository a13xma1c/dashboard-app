import { expect, test } from "@playwright/test";
import { PROPERTY_ID, selectProperty, signIn } from "./helpers";

test.describe("authentication", () => {
  test("shows the demo-mode login page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "GA Dashboard" })).toBeVisible();
    await expect(page.getByText(/Demo mode is on/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with demo data/ })).toBeVisible();
  });

  test("signs in through the backend and lands on the overview", async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
    await expect(page.getByText("demo@example.com")).toBeVisible();
    await expect(page.getByText("Demo data")).toBeVisible();
  });

  test("keeps the session across reloads", async ({ page }) => {
    await signIn(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Overview" })).toBeVisible();
  });

  test("redirects protected routes to the login page when signed out", async ({ page }) => {
    await page.goto("/dashboard/audience");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /Continue with demo data/ })).toBeVisible();
  });

  test("signs out and clears access", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /Continue with demo data/ })).toBeVisible();

    await page.goto("/dashboard/overview");
    await expect(page).toHaveURL(/\/$/);
  });

  test("remembers the property after signing back in", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await signIn(page);
    await expect(page.getByText(`Property ${PROPERTY_ID}`)).toBeVisible();
  });
});

test.describe("session expiry", () => {
  test("a 401 from the API signs the user out instead of breaking every widget", async ({ page }) => {
    await signIn(page);
    await selectProperty(page);
    // Simulate the backend session vanishing (e.g. cookie expired / server restarted with a new secret).
    await page.context().clearCookies();
    await page.getByRole("button", { name: "Refresh data" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /Continue with demo data/ })).toBeVisible();
  });
});
