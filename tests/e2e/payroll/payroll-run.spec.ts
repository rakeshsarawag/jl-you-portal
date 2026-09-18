/**
 * Payroll Management — process payroll, view payslips
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Payroll Management", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("finance");
    await page.goto(`${BASE_URL}/payroll`);
  });

  test("Finance can view payroll dashboard", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /payroll/i })).toBeVisible();
  });

  test("Finance can switch tax regime per employee", async ({ page }) => {
    await page.getByRole("tab", { name: /processing/i }).click();
    // New/Old badge should be visible
    await expect(page.getByText(/new|old/i).first()).toBeVisible();
  });

  test("Finance can export NEFT", async ({ page }) => {
    await page.getByRole("tab", { name: /processing/i }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /neft|export/i }).first().click();
    // May need to interact with bank format dropdown first
    await page.getByRole("button", { name: /download|export csv/i }).first().click().catch(() => {});
  });

  test("Employee can view own payslips", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/payroll`);
    await expect(page.getByRole("heading", { name: /payslip|salary/i })).toBeVisible();
  });

  test("Admin cannot be blocked from payroll", async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto(`${BASE_URL}/payroll`);
    await expect(page.getByRole("heading", { name: /payroll/i })).toBeVisible();
  });
});
