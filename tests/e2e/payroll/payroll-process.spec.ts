/**
 * Payroll Management — process payroll, view payslips, RBAC enforcement
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../shared/fixtures';

test.describe('Payroll Management', () => {
  test('finance user can view the payroll dashboard', async ({ page }) => {
    await loginAs(page, 'finance');
    await page.goto('/payroll');
    await expect(page.getByRole('heading', { name: /payroll/i })).toBeVisible();
  });

  test('finance user can process a payroll run', async ({ page }) => {
    await loginAs(page, 'finance');
    await page.goto('/payroll');
    await page.getByRole('button', { name: /process payroll|run payroll/i }).click();
    await page.getByLabel(/period|month/i).selectOption({ index: 1 });
    await page.getByRole('button', { name: /confirm|proceed/i }).click();
    await expect(page.getByText(/payroll processed|run complete/i)).toBeVisible();
  });

  test('employee can view their own payslip', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/payroll');
    await expect(page.getByText(/my payslip|payslip|pay stub/i)).toBeVisible();
    await page.getByRole('link', { name: /view|download/i }).first().click();
    await expect(page.getByText(/net pay|gross|salary/i)).toBeVisible();
  });

  test('employee cannot process payroll', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/payroll');
    await expect(page.getByRole('button', { name: /process payroll|run payroll/i })).not.toBeVisible();
  });

  test('employee cannot view other employees payslips', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto('/payroll/all');
    await expect(page.getByText(/permission|access denied|not authorized/i)).toBeVisible();
  });
});
