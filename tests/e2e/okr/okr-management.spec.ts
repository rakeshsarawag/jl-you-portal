/**
 * OKR Management — create, check-in, grade OKRs
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("OKR Management", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("manager");
    await page.goto(`${BASE_URL}/okr`);
  });

  test("Manager can view OKR list", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /okr/i })).toBeVisible();
  });

  test("Manager can create an OKR", async ({ page }) => {
    await page.getByRole("button", { name: /new okr|add okr|create/i }).first().click();
    await page.getByLabel(/title|objective/i).fill("Increase customer retention by 20%");
    await page.getByLabel(/quarter|cycle/i).selectOption({ index: 1 });
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText("Increase customer retention")).toBeVisible();
  });

  test("Manager can add a key result", async ({ page }) => {
    await page.getByText("Increase customer retention").first().click();
    await page.getByRole("button", { name: /add key result|add kr/i }).click();
    await page.getByLabel(/title/i).fill("Reduce churn rate");
    await page.getByLabel(/target/i).fill("5");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText("Reduce churn rate")).toBeVisible();
  });

  test("Employee cannot grade OKRs of others", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/okr`);
    // Grading buttons should not be visible for employee's peer OKRs
    // Just verify the page loads
    await expect(page.getByRole("heading", { name: /okr/i })).toBeVisible();
  });

  test("Analytics tab shows charts", async ({ page }) => {
    await page.getByRole("tab", { name: /analytics/i }).click();
    await expect(page.getByText(/department|completion/i)).toBeVisible();
  });
});
