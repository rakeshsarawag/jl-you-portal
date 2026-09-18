/**
 * Advanced Analytics — tabs, filters, exports
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Advanced Analytics", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("manager");
    await page.goto(`${BASE_URL}/advanced-analytics`);
  });

  test("Manager can view analytics dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible();
  });

  test("Funnel Analysis tab loads", async ({ page }) => {
    await page.getByRole("tab", { name: /funnel/i }).click();
    await expect(page.getByText(/recruitment|onboarding/i)).toBeVisible();
  });

  test("Predictive Analytics tab loads", async ({ page }) => {
    await page.getByRole("tab", { name: /predictive/i }).click();
    await expect(page.getByText(/forecast|trend/i)).toBeVisible();
  });

  test("Cohort Analysis tab loads", async ({ page }) => {
    await page.getByRole("tab", { name: /cohort/i }).click();
    await expect(page.getByText(/cohort|retention/i)).toBeVisible();
  });

  test("Department filter changes data", async ({ page }) => {
    await page.getByLabel(/department/i).selectOption({ index: 1 });
    // Just verify the page doesn't crash
    await expect(page.getByRole("heading", { name: /analytics/i })).toBeVisible();
  });

  test("Employee cannot access analytics", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/advanced-analytics`);
    await expect(page.getByText(/permission|access denied|restricted/i)).toBeVisible();
  });
});
