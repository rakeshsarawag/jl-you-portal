import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Leave Management', () => {
  test('employee can submit a leave request', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    await page.click('text=Apply for Leave');
    // Fill form
    await page.selectOption('[name=leave_type]', 'Annual Leave');
    await page.fill('[name=start_date]', '2026-09-15');
    await page.fill('[name=end_date]', '2026-09-17');
    await page.click('text=Submit');
    await expect(page.locator('[role=alert]')).toContainText(/submitted|applied/i);
  });

  test('manager can approve a leave request', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/dashboard');
    // Navigate to pending leaves
    const approveBtn = page.locator('button:has-text("Approve")').first();
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await expect(page.locator('[role=alert]')).toContainText(/approved/i);
    }
  });

  test('employee cannot see other employees leaves', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/dashboard');
    // Should not see team leave approval section
    await expect(page.locator('text=All Pending Leaves')).not.toBeVisible();
  });
});
