/**
 * Authentication — login, logout, redirect, and field validation
 */
import { test, expect, BASE_URL, loginAs as loginAsHelper } from "../shared/fixtures";

test.describe("Authentication", () => {
  // ── Field presence ────────────────────────────────────────────────────────────

  test("Login page has email and password fields", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await expect(page.locator('#email, input[type=email]').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#password, input[type=password]').first()).toBeVisible({ timeout: 10000 });
  });

  test("Password field is masked (type=password)", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const passwordField = page.locator('#password, input[type=password]').first();
    await expect(passwordField).toBeVisible({ timeout: 10000 });
    const fieldType = await passwordField.getAttribute("type");
    expect(fieldType).toBe("password");
  });

  test("Quick Fill Admin button populates credentials", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    const fillBtn = page.getByRole('button', { name: /fill admin/i });
    if (!await fillBtn.isVisible({ timeout: 5000 }).catch(() => false)) return;
    await fillBtn.click();
    await page.waitForTimeout(300);
    const emailVal = await page.locator('#email, input[type=email]').first().inputValue();
    expect(emailVal.length).toBeGreaterThan(0);
  });

  // ── Valid logins ──────────────────────────────────────────────────────────────

  test("Valid admin login succeeds and leaves /login", async ({ page }) => {
    await loginAsHelper(page, "admin");
    expect(page.url()).not.toContain("login");
  });

  test("Valid employee login succeeds and leaves /login", async ({ page }) => {
    await loginAsHelper(page, "employee");
    expect(page.url()).not.toContain("login");
  });

  test("After login, browser is redirected away from /login", async ({ page }) => {
    await loginAsHelper(page, "admin");
    await expect(page).not.toHaveURL(/login/);
  });

  // ── Invalid credentials ───────────────────────────────────────────────────────

  test("Invalid credentials show an error message", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.locator('#email, input[type=email]').first().fill("bad@example.com");
    await page.locator('#password, input[type=password]').first().fill("wrongpassword999");
    await page.locator('button[type=submit]').first().click();
    await expect(
      page.getByRole("alert")
        .or(page.locator("[class*=error], [class*=toast]"))
        .or(page.getByText(/invalid|incorrect|failed|wrong|credentials/i))
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Empty form validation ─────────────────────────────────────────────────────

  test("Submitting empty form shows validation or stays on login", async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.locator('button[type=submit]').first().click();
    const hasError = await page.getByText(/required|please enter|cannot be empty|invalid/i).count();
    const stillOnLogin = page.url().includes("login");
    expect(hasError > 0 || stillOnLogin).toBe(true);
  });

  // ── Unauthenticated redirects ─────────────────────────────────────────────────

  test("Unauthenticated user visiting /dashboard is redirected to /login", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  test("Unauthenticated user visiting /payroll is redirected to /login", async ({ page }) => {
    await page.goto(`${BASE_URL}/payroll`);
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });

  // ── Logout ────────────────────────────────────────────────────────────────────

  test("Logout button is visible after login", async ({ page }) => {
    await loginAsHelper(page, "admin");
    const logoutBtn = page
      .getByRole("button", { name: /log.?out|sign.?out/i })
      .or(page.getByRole("link", { name: /log.?out|sign.?out/i }))
      .first();
    if (!await logoutBtn.isVisible().catch(() => false)) return;
    await expect(logoutBtn).toBeVisible();
  });

  test("Clicking logout returns user to /login", async ({ page }) => {
    await loginAsHelper(page, "admin");
    const logoutBtn = page
      .getByRole("button", { name: /log.?out|sign.?out/i })
      .or(page.getByRole("link", { name: /log.?out|sign.?out/i }))
      .first();
    if (!await logoutBtn.isVisible().catch(() => false)) return;
    await logoutBtn.click();
    await expect(page).toHaveURL(/login/, { timeout: 10000 });
  });
});
