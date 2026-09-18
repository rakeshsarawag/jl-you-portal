import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('RBAC Access Control', () => {
  test('employee cannot access user management', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/user-management');
    await expect(page.locator('text=Access Denied, text=Unauthorized')).toBeVisible({ timeout: 5000 });
  });

  test('admin can access all apps', async ({ page }) => {
    await loginAs(page, 'admin');
    for (const route of ['/user-management', '/permissions', '/master-data']) {
      await page.goto(route);
      await expect(page.locator('text=Access Denied')).not.toBeVisible();
    }
  });
});
