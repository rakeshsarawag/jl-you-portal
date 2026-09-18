import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Authentication', () => {
  test('admin can log in', async ({ page }) => {
    await loginAs(page, 'admin');
    await expect(page).not.toHaveURL('/login');
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name=email]', 'wrong@test.com');
    await page.fill('[name=password]', 'wrong');
    await page.click('[type=submit]');
    await expect(page.locator('[role=alert], .error, [data-testid=error]')).toBeVisible({ timeout: 5000 });
  });

  test('redirects unauthenticated user to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/);
  });
});
