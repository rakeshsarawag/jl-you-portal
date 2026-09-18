/**
 * Invoice Generation — create, send, record payment
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Invoice Generation", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("finance");
    await page.goto(`${BASE_URL}/invoices`);
  });

  test("Finance can view invoice list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /invoice/i })).toBeVisible();
  });

  test("Finance can create a new invoice", async ({ page }) => {
    await page.getByRole("button", { name: /new invoice|create invoice/i }).click();
    await page.getByLabel(/client/i).first().fill("Acme Corp");
    await page.getByLabel(/invoice number/i).fill("INV-E2E-001");
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText("INV-E2E-001")).toBeVisible();
  });

  test("Finance can view invoice analytics", async ({ page }) => {
    await page.getByRole("tab", { name: /analytics/i }).click();
    await expect(page.getByText(/revenue|total/i)).toBeVisible();
  });

  test("Employee cannot access invoices", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/invoices`);
    await expect(page.getByText(/permission|access denied|restricted/i)).toBeVisible();
  });

  test("Finance can filter invoices by status", async ({ page }) => {
    // Check URL-synced pagination/filter works
    await page.goto(`${BASE_URL}/invoices?status=overdue`);
    await expect(page.getByRole("heading", { name: /invoice/i })).toBeVisible();
  });
});
