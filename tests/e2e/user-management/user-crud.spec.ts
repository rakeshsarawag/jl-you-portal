/**
 * User Management — create user, change role, deactivate, audit log
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('User Management', () => {
  test('admin can view the user list', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/user-management');
    await expect(page.getByRole('heading', { name: /user management|users/i })).toBeVisible();
  });

  test('admin can create a new user', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/user-management');
    await page.getByRole('button', { name: /add user|new user|create/i }).click();
    await page.getByLabel(/name/i).fill('E2E Test User');
    await page.getByLabel(/email/i).fill('e2e.newuser@jlyou.com');
    await page.getByLabel(/role/i).selectOption('employee');
    await page.getByRole('button', { name: /save|create/i }).click();
    await expect(page.getByText('E2E Test User')).toBeVisible();
  });

  test('admin can change a user role', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/user-management');
    await page.getByText('E2E Test User').first().click();
    await page.getByLabel(/role/i).selectOption('manager');
    await page.getByRole('button', { name: /save|update/i }).click();
    await expect(page.getByText(/role updated|saved/i)).toBeVisible();
  });

  test('admin can deactivate a user', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/user-management');
    await page.getByText('E2E Test User').first().click();
    await page.getByRole('button', { name: /deactivate/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();
    await expect(page.getByText(/deactivated|inactive/i)).toBeVisible();
  });

  test('admin can view the audit log', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto('/user-management');
    await page.getByRole('tab', { name: /audit log|activity/i }).click();
    await expect(page.getByText(/action|timestamp|performed by/i)).toBeVisible();
  });

  test('non-admin cannot access user management', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/user-management');
    await expect(page.getByText(/permission|access denied|not authorized/i)).toBeVisible();
  });
});
