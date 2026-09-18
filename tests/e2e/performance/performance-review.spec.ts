/**
 * Performance Tracker — review CRUD, self-assessment, and role-based views
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Performance Tracker', () => {
  test('employee can submit a self-assessment', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/performance');
    await expect(page.getByRole('heading', { name: /performance/i })).toBeVisible();
    await page.getByRole('button', { name: /self.?assessment/i }).click();
    await page.getByLabel(/achievements/i).fill('Delivered project X on time');
    await page.getByLabel(/goals/i).fill('Improve team communication');
    await page.getByRole('button', { name: /submit/i }).click();
    await expect(page.getByText(/submitted|saved/i)).toBeVisible();
  });

  test('manager can create a performance review for a report', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/performance');
    await page.getByRole('button', { name: /new review|create review/i }).click();
    await page.getByLabel(/employee/i).fill('emp@jlyou.com');
    await page.getByLabel(/rating|score/i).fill('4');
    await page.getByLabel(/comments/i).fill('Good performance this quarter');
    await page.getByRole('button', { name: /save|submit/i }).click();
    await expect(page.getByText(/review saved|created/i)).toBeVisible();
  });

  test('manager sees team review dashboard', async ({ page }) => {
    await loginAs(page, 'manager');
    await page.goto('/performance');
    await expect(page.getByText(/team|reports|direct/i)).toBeVisible();
  });

  test('employee sees only own review, not team dashboard', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/performance');
    await expect(page.getByText(/my review|self/i)).toBeVisible();
    await expect(page.getByText(/manage team reviews/i)).not.toBeVisible();
  });

  test('employee cannot access /performance/admin', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/performance/admin');
    await expect(page.getByText(/permission|access denied|not authorized/i)).toBeVisible();
  });
});
