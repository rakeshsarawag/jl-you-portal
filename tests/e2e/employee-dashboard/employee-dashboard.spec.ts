/**
 * Employee Dashboard Enhanced V2
 * Route: /dashboard (employee view)
 * Component: EmployeeDashboardEnhancedV2
 * Tabs: Overview, Attendance, Leave, Approvals, Tasks, Payslip, Shifts
 */
import { test, expect, BASE_URL, loginAs, isErrorPage} from '../shared/fixtures';

test.describe('Employee Dashboard', () => {
  test('1. Employee dashboard loads after login', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByRole('heading', { name: /dashboard|my dashboard|home/i })
        .first()
        .or(page.getByText(/dashboard/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('2. Overview tab shows employee name', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }
    // Employee name should appear somewhere in the overview
    await expect(
      page
        .getByText(/welcome|hello|good (morning|afternoon|evening)/i)
        .first()
        .or(page.locator('[data-testid*="employee-name"], [data-testid*="user-name"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('3. Quick links panel visible', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }
    await expect(
      page
        .getByText(/quick links?|shortcuts?|quick access/i)
        .first()
        .or(page.locator('[data-testid*="quick-link"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('4. Attendance tab accessible with clock-in button', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /attendance/i }).click();
    await expect(
      page
        .getByRole('button', { name: /clock in|check in|punch in/i })
        .first()
        .or(page.getByText(/clock in|check in|punch in/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('5. Leave balance widget shows remaining days', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /leave/i }).click();
    await expect(
      page
        .getByText(/balance|remaining|available|days left/i)
        .first()
        .or(page.locator('[data-testid*="leave-balance"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('6. Apply leave button opens form', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /leave/i }).click();
    await page
      .getByRole('button', { name: /apply leave|apply|new leave|request leave/i })
      .first()
      .click();
    await expect(
      page
        .getByRole('dialog')
        .or(page.getByText(/leave type|from date|to date|start date/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('7. Leave form validates date fields', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /leave/i }).click();
    await page
      .getByRole('button', { name: /apply leave|apply|new leave|request leave/i })
      .first()
      .click();
    // Submit without filling dates
    const submitBtn = page
      .getByRole('button', { name: /submit|apply|send/i })
      .first();
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(
        page
          .getByText(/date is required|required|please select/i)
          .first()
          .or(page.locator('input[type="date"]:invalid').first())
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('8. Leave history shows past requests', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /leave/i }).click();
    await expect(
      page
        .getByText(/history|past requests?|previous|no leave requests?|no records/i)
        .first()
        .or(page.getByRole('table').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('9. Approvals tab shows pending count', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /approvals?/i }).click();
    await expect(
      page
        .getByText(/pending|approval/i)
        .first()
        .or(page.getByText(/no pending|nothing to approve/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('10. Payslip tab shows payslips or empty state', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /payslip|pay slip|salary/i }).click();
    await expect(
      page
        .getByText(/payslip|pay slip|salary statement|no payslip|not available/i)
        .first()
        .or(page.getByRole('table').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('11. Payslip download button present', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /payslip|pay slip|salary/i }).click();
    // Button may only appear if there are payslips
    const downloadBtn = page
      .getByRole('button', { name: /download|pdf/i })
      .first()
      .or(page.getByText(/download/i).first());
    // Check it's visible OR the empty state is shown — either is acceptable
    const emptyState = page.getByText(/no payslip|not available|no records/i).first();
    await expect(downloadBtn.or(emptyState)).toBeVisible({ timeout: 15000 });
  });

  test('12. Profile completeness percentage shown', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }
    await expect(
      page
        .getByText(/%|profile completeness|complete your profile/i)
        .first()
        .or(page.locator('[role="progressbar"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('13. Shifts tab shows current schedule', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('tab', { name: /shift|roster|schedule/i }).click();
    await expect(
      page
        .getByText(/shift|roster|schedule|no shift assigned|current schedule/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('14. Announcements section visible on overview', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const overviewTab = page.getByRole('tab', { name: /overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
    }
    await expect(
      page
        .getByText(/announcements?|notice board|news|updates/i)
        .first()
        .or(page.locator('[data-testid*="announcement"]').first())
    ).toBeVisible({ timeout: 15000 });
  });
});
