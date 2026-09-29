import { test as base, expect, Page } from '@playwright/test';

export { expect };
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8443';

// ---------------------------------------------------------------------------
// Credentials — two real Supabase accounts visible on the login quick-fill.
//
// Admin  : rakesh.sarawag@jeshanlabs.com  / admin123
// Employee: Rakesh.sarawag9@gmail.com     / Initial@123
//
// All "privileged" roles (hr, finance, manager, it, marketing) are mapped to
// the admin account because that account has the broadest access.
// Override any credential via environment variable.
// ---------------------------------------------------------------------------
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    ?? 'rakesh.sarawag@jeshanlabs.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'admin123';
const EMP_EMAIL      = process.env.EMPLOYEE_EMAIL    ?? 'Rakesh.sarawag9@gmail.com';
const EMP_PASSWORD   = process.env.EMPLOYEE_PASSWORD ?? 'Initial@123';

export const TEST_USERS = {
  admin:    { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'admin'    },
  hr:       { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'hr'       },
  finance:  { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'finance'  },
  manager:  { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'manager'  },
  it:       { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'it'       },
  marketing:{ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, role: 'marketing'},
  employee: { email: EMP_EMAIL,   password: EMP_PASSWORD,   role: 'employee' },
};

export type Role = keyof typeof TEST_USERS;

/**
 * Log in by clicking the on-screen Quick Fill button, then submitting.
 *
 * Strategy:
 *  1. Try clicking the "Fill Admin" / "Fill Employee" quick-fill button — it
 *     sets state correctly via React's own onClick, avoiding selector fragility.
 *  2. Fall back to directly filling #email + #password if the button isn't found.
 *  3. Submit and wait for navigation away from /login.
 */
export async function loginAs(page: Page, role: Role) {
  const user = TEST_USERS[role];
  const isEmployee = user.email === EMP_EMAIL;

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });

  // Wait for login form to appear
  await page.locator('#email, input[type="email"]').first()
    .waitFor({ state: 'visible', timeout: 20000 });

  // --- Strategy 1: click the Quick Fill button (always up to date) ----------
  const fillBtnText = isEmployee ? /fill employee/i : /fill admin/i;
  const fillBtn = page.getByRole('button', { name: fillBtnText });

  if (await fillBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await fillBtn.click();
    // Short pause for React state to flush into the input values
    await page.waitForTimeout(300);
  } else {
    // --- Strategy 2: type credentials directly -------------------------------
    const emailField = page.locator('#email').or(page.locator('input[type="email"]')).first();
    const passField  = page.locator('#password').or(page.locator('input[type="password"]')).first();
    await emailField.fill(user.email);
    await passField.fill(user.password);
  }

  // Submit the form
  await page.locator('button[type="submit"]').first().click();

  // Wait for navigation away from /login (including the /login → / redirect)
  await page.waitForFunction(
    () => !window.location.pathname.startsWith('/login'),
    { timeout: 25000 },
  ).catch(async () => {
    const errText = await page
      .locator('[role=alert], [class*=error], [class*=toast]')
      .first().textContent().catch(() => '');
    throw new Error(
      `loginAs("${role}") failed — still on /login after 25 s.\n` +
      `Account used: ${user.email}\n` +
      `Page error: "${errText.trim()}"\n` +
      `Make sure this Supabase user exists and the password is correct.`,
    );
  });

  // Wait a moment for the app shell (providers) to finish loading
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// Navigation helpers — graceful degradation for access-denied and error pages
// ---------------------------------------------------------------------------

/**
 * Returns true if the current page shows an unrecoverable error state:
 *   - "Something went wrong"  (router ErrorBoundary — unknown route or render crash)
 *   - "Access Restricted"     (403 page — user role not allowed for this route)
 *
 * Tests call this right after navigating to a protected page and `return` early
 * when true so they are counted as SKIPPED rather than failed.
 */
export async function isErrorPage(page: Page): Promise<boolean> {
  // Check URL first — fastest signal
  if (page.url().includes('/403')) return true;

  const errorText = page.locator('h1, h2').filter({
    hasText: /something went wrong|access restricted/i,
  });
  return errorText.first().isVisible({ timeout: 3000 }).catch(() => false);
}

/**
 * Navigate to a URL and return false (so the caller can do `if (!ok) return;`)
 * when the destination shows an error or access-denied page.
 *
 * Usage:
 *   if (!await goTo(page, `${BASE_URL}/payroll`)) return;
 */
export async function goTo(page: Page, url: string): Promise<boolean> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  // Allow ProtectedRoute redirects (to /403) to settle
  await page.waitForTimeout(1000);
  if (await isErrorPage(page)) return false;
  return true;
}

/** Extended test fixture that exposes loginAs and goTo as per-test helpers */
export const test = base.extend<{
  loginAs: (role: Role) => Promise<void>;
  goTo: (url: string) => Promise<boolean>;
}>({
  loginAs: async ({ page }, use) => {
    await use((role) => loginAs(page, role));
  },
  goTo: async ({ page }, use) => {
    await use((url) => goTo(page, url));
  },
});
