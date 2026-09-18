/**
 * Training Tracker — course enrollment, progress updates, certificate issuance
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Training Tracker', () => {
  test('employee can view the course catalog', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/training');
    await expect(page.getByRole('heading', { name: /training/i })).toBeVisible();
    await expect(page.getByText(/course|catalog/i)).toBeVisible();
  });

  test('employee can enroll in a course', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/training');
    await page.getByRole('button', { name: /enroll|browse courses/i }).first().click();
    await page.getByRole('button', { name: /enroll/i }).first().click();
    await expect(page.getByText(/enrolled|enrollment confirmed/i)).toBeVisible();
  });

  test('employee can update course progress', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/training');
    await page.getByText(/my courses|enrolled/i).click();
    await page.getByRole('button', { name: /mark complete|update progress/i }).first().click();
    await expect(page.getByText(/progress updated|completed/i)).toBeVisible();
  });

  test('HR can issue a certificate after course completion', async ({ page }) => {
    await loginAs(page, 'hr');
    await page.goto('/training');
    await page.getByRole('tab', { name: /completions|certificates/i }).click();
    await page.getByRole('button', { name: /issue certificate/i }).first().click();
    await expect(page.getByText(/certificate issued/i)).toBeVisible();
  });

  test('employee cannot access HR training admin panel', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/training/admin');
    await expect(page.getByText(/permission|access denied|not authorized/i)).toBeVisible();
  });
});
