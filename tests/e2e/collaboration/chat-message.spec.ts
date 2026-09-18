/**
 * Collaboration Hub — messaging, channel creation, and direct messages
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Collaboration Hub', () => {
  test('employee can view the collaboration hub', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/collaboration-hub');
    await expect(page.getByRole('heading', { name: /collaboration|chat/i })).toBeVisible();
  });

  test('employee can send a message in a channel', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/collaboration-hub');
    await page.getByRole('listitem', { name: /general|#general/i }).first().click();
    await page.getByRole('textbox', { name: /message|type/i }).fill('Hello from E2E test');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Hello from E2E test')).toBeVisible();
  });

  test('employee can create a new channel', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/collaboration-hub');
    await page.getByRole('button', { name: /new channel|create channel|\+/i }).click();
    await page.getByLabel(/channel name/i).fill('e2e-test-channel');
    await page.getByRole('button', { name: /create|save/i }).click();
    await expect(page.getByText('e2e-test-channel')).toBeVisible();
  });

  test('employee can send a direct message', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/collaboration-hub');
    await page.getByRole('button', { name: /new dm|direct message|\+/i }).click();
    await page.getByLabel(/search|to/i).fill('manager@jlyou.com');
    await page.getByRole('option').first().click();
    await page.getByRole('textbox', { name: /message/i }).fill('DM from E2E test');
    await page.keyboard.press('Enter');
    await expect(page.getByText('DM from E2E test')).toBeVisible();
  });
});
