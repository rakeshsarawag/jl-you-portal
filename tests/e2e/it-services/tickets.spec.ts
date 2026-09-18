/**
 * IT Services — ticket lifecycle, data isolation
 */
import { test, expect, BASE_URL } from "../shared/fixtures";

test.describe("IT Services", () => {
  test("Employee can raise a ticket", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/it-services`);
    await page.getByRole("button", { name: /raise ticket/i }).click();
    await page.getByLabel(/subject/i).fill("E2E Test Ticket");
    await page.getByLabel(/category/i).selectOption("Software");
    await page.getByLabel(/priority/i).selectOption("Low");
    await page.getByLabel(/description/i).fill("Created by E2E test");
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page.getByText("E2E Test Ticket")).toBeVisible();
  });

  test("Employee only sees own tickets", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/it-services`);
    // Should not contain tickets from other users — verify ticket count matches only own
    const tickets = page.locator("[data-testid='ticket-row']");
    const count = await tickets.count();
    // All visible tickets must belong to the logged-in user (verified via email in row)
    for (let i = 0; i < count; i++) {
      await expect(tickets.nth(i)).toContainText("test.employee@jlyou.com");
    }
  });

  test("IT Admin can see all tickets", async ({ page, loginAs }) => {
    await loginAs("it");
    await page.goto(`${BASE_URL}/it-services`);
    // All-tickets tab visible for IT admin
    await expect(page.getByRole("tab", { name: /all/i })).toBeVisible();
  });

  test("IT Admin can resolve a ticket", async ({ page, loginAs }) => {
    await loginAs("it");
    await page.goto(`${BASE_URL}/it-services`);
    await page.getByRole("tab", { name: /open/i }).click();
    await page.getByText("E2E Test Ticket").first().click();
    await page.getByRole("button", { name: /resolve/i }).click();
    await expect(page.getByText(/resolved/i)).toBeVisible();
  });
});
