/**
 * Onboarding Portal — full flow from creation to directory sync
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Onboarding Portal", () => {
  test.beforeEach(async ({ loginAs }) => { await loginAs("hr"); });

  test("HR can create a new joiner record", async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding`);
    await page.getByRole("button", { name: /add new joiner/i }).click();
    await page.getByLabel(/name/i).fill("E2E Joiner");
    await page.getByLabel(/email/i).fill("e2e.joiner@test.com");
    await page.getByLabel(/joining date/i).fill("2026-09-01");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText("E2E Joiner")).toBeVisible();
  });

  test("HR can complete checklist tasks", async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding`);
    await page.getByText("E2E Joiner").click();
    const firstTask = page.locator("[data-testid='task-checkbox']").first();
    await firstTask.check();
    await expect(page.getByText(/progress/i)).toBeVisible();
  });

  test("HR can enable portal access", async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding`);
    await page.getByText("E2E Joiner").click();
    await page.getByRole("button", { name: /enable.*access/i }).click();
    await expect(page.getByText(/access enabled|account created/i)).toBeVisible();
  });

  test("HR can sync joiner to directory", async ({ page }) => {
    await page.goto(`${BASE_URL}/onboarding`);
    await page.getByText("E2E Joiner").click();
    await page.getByRole("button", { name: /sync.*directory/i }).click();
    await expect(page.getByText(/synced|success/i)).toBeVisible();
  });

  test("Employee cannot access onboarding portal", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/onboarding`);
    await expect(page.getByText(/permission|access denied/i)).toBeVisible();
  });
});
