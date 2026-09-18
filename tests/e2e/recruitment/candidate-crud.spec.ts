/**
 * Recruitment — candidate CRUD and stage pipeline
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Recruitment Tracker", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("hr");
    await page.goto(`${BASE_URL}/recruitment`);
  });

  test("HR can view candidate list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /recruitment/i })).toBeVisible();
  });

  test("HR can add a new candidate", async ({ page }) => {
    await page.getByRole("button", { name: /add candidate/i }).click();
    await page.getByLabel(/name/i).fill("Test Candidate E2E");
    await page.getByLabel(/job title/i).fill("QA Engineer");
    await page.getByLabel(/email/i).fill("e2e.candidate@test.com");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText("Test Candidate E2E")).toBeVisible();
  });

  test("HR can advance candidate stage", async ({ page }) => {
    await page.getByText("Test Candidate E2E").first().click();
    await page.getByRole("button", { name: /screening/i }).click();
    await expect(page.getByText("Screening")).toBeVisible();
  });

  test("HR can schedule an interview", async ({ page }) => {
    await page.getByText("Test Candidate E2E").first().click();
    await page.getByRole("button", { name: /schedule interview/i }).click();
    await page.getByLabel(/date/i).fill("2026-09-01");
    await page.getByLabel(/interviewer/i).fill("Jane Smith");
    await page.getByRole("button", { name: /confirm/i }).click();
    await expect(page.getByText("Interview scheduled")).toBeVisible();
  });

  test("Employee cannot access recruitment", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/recruitment`);
    await expect(page.getByText(/permission|access denied/i)).toBeVisible();
  });
});
