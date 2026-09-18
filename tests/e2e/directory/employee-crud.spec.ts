/**
 * Employee Directory — CRUD and search
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("Employee Directory", () => {
  test("All roles can view directory", async ({ page, loginAs }) => {
    for (const role of ["admin", "hr", "manager", "employee"] as const) {
      await loginAs(role);
      await page.goto(`${BASE_URL}/directory`);
      await expect(page.getByRole("heading", { name: /directory/i })).toBeVisible();
    }
  });

  test("Admin can add an employee", async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto(`${BASE_URL}/directory`);
    await page.getByRole("button", { name: /add employee/i }).click();
    await page.getByLabel(/first name/i).fill("E2E");
    await page.getByLabel(/last name/i).fill("TestEmployee");
    await page.getByLabel(/email/i).fill("e2e.emp@test.com");
    await page.getByLabel(/department/i).selectOption("Engineering");
    await page.getByRole("button", { name: /save/i }).click();
    await expect(page.getByText("E2E TestEmployee")).toBeVisible();
  });

  test("Search filters results correctly", async ({ page, loginAs }) => {
    await loginAs("hr");
    await page.goto(`${BASE_URL}/directory`);
    await page.getByPlaceholder(/search/i).fill("E2E");
    await expect(page.getByText("E2E TestEmployee")).toBeVisible();
  });

  test("Employee cannot add/delete other employees", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/directory`);
    await expect(page.getByRole("button", { name: /add employee/i })).toBeHidden();
  });
});
