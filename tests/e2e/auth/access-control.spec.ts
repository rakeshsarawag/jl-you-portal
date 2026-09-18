/**
 * Access Control — verify role-based route protection.
 * Every route must redirect unauthorised roles to access-denied.
 */
import { test, expect, loginAs, BASE_URL } from "../shared/fixtures";

const RESTRICTED_ROUTES = [
  { path: "/user-management",   allowedRoles: ["admin"] },
  { path: "/permissions",       allowedRoles: ["admin"] },
  { path: "/invoices",          allowedRoles: ["admin", "finance"] },
  { path: "/payroll",           allowedRoles: ["admin", "hr", "finance"] },
  { path: "/recruitment",       allowedRoles: ["admin", "hr"] },
  { path: "/onboarding",        allowedRoles: ["admin", "hr"] },
  { path: "/assets",            allowedRoles: ["admin", "it"] },
  { path: "/linkedin",          allowedRoles: ["admin", "marketing"] },
];

for (const { path, allowedRoles } of RESTRICTED_ROUTES) {
  test(`Employee cannot access ${path}`, async ({ page }) => {
    await loginAs(page, "employee");
    await page.goto(`${BASE_URL}${path}`);
    const body = await page.textContent("body");
    expect(body).toMatch(/permission|access denied|not authorized/i);
  });
}

test("Unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto(`${BASE_URL}/dashboard`);
  await expect(page).toHaveURL(/login|auth/i);
});

test("Admin can access all routes", async ({ page }) => {
  await loginAs(page, "admin");
  for (const { path } of RESTRICTED_ROUTES) {
    await page.goto(`${BASE_URL}${path}`);
    const body = await page.textContent("body");
    expect(body).not.toMatch(/access denied|not authorized/i);
  }
});
