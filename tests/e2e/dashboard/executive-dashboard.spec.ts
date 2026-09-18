/**
 * Executive Dashboard — KPI cards, drill-through, exports
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Executive Dashboard", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto(`${BASE_URL}/executive-dashboard`);
  });

  test("Admin can view executive dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /executive|dashboard/i })).toBeVisible();
  });

  test("KPI cards are visible", async ({ page }) => {
    await expect(page.getByText(/employee|headcount|total/i).first()).toBeVisible();
  });

  test("People tab shows charts", async ({ page }) => {
    await page.getByRole("tab", { name: /people/i }).click();
    await expect(page.getByText(/headcount|department|attrition/i)).toBeVisible();
  });

  test("Finance tab shows charts", async ({ page }) => {
    await page.getByRole("tab", { name: /finance/i }).click();
    await expect(page.getByText(/revenue|payroll|invoice/i)).toBeVisible();
  });

  test("OKR tab shows completion ring", async ({ page }) => {
    await page.getByRole("tab", { name: /okr/i }).click();
    await expect(page.getByText(/completion|okr/i)).toBeVisible();
  });

  test("Non-admin employee cannot view executive dashboard", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/executive-dashboard`);
    await expect(page.getByText(/restricted|permission|access/i)).toBeVisible();
  });
});
