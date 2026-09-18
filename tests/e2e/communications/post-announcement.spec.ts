/**
 * Communications Hub — announcements, pinning, and reactions
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Communications Hub', () => {
  test('employee can view announcements feed', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/communications');
    await expect(page.getByRole('heading', { name: /communications|announcements/i })).toBeVisible();
  });

  test('HR can create a new announcement', async ({ page }) => {
    await loginAs(page, 'hr');
    await page.goto('/communications');
    await page.getByRole('button', { name: /new announcement|create/i }).click();
    await page.getByLabel(/title/i).fill('E2E Test Announcement');
    await page.getByLabel(/message|body|content/i).fill('This is an automated test announcement.');
    await page.getByRole('button', { name: /post|publish|save/i }).click();
    await expect(page.getByText('E2E Test Announcement')).toBeVisible();
  });

  test('HR can pin an announcement', async ({ page }) => {
    await loginAs(page, 'hr');
    await page.goto('/communications');
    await page.getByText('E2E Test Announcement').first().click();
    await page.getByRole('button', { name: /pin/i }).click();
    await expect(page.getByText(/pinned/i)).toBeVisible();
  });

  test('employee can react to an announcement', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/communications');
    await page.getByRole('button', { name: /react|like|👍/i }).first().click();
    await expect(page.getByText(/reaction added|reacted/i).or(page.locator('[data-testid=reaction-count]'))).toBeVisible();
  });

  test('employee cannot create announcements', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/communications');
    await expect(page.getByRole('button', { name: /new announcement/i })).not.toBeVisible();
  });
});
