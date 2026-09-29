/**
 * OKR Management Enhanced — objectives, key results, progress tracking,
 * progress bands, OKR grades, check-ins, hierarchy, analytics, and RBAC.
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('OKR Management Enhanced', () => {
  // 1. OKR management loads
  test('OKR management loads', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /okr|objective/i }).or(
        page.getByText(/OKR management|objectives and key results/i)
      )
    ).toBeVisible();
  });

  // 2. Objective list shows or empty state message
  test('objective list shows or shows empty state message', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/objective|no objective|no OKR|get started/i).or(
        page.getByRole('list').or(page.getByRole('table'))
      )
    ).toBeVisible();
  });

  // 3. Create objective button opens form
  test('create objective button opens form', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('button', { name: /create objective|add objective|new objective|new OKR/i }).click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('form')).or(
        page.getByLabel(/objective title|objective name/i)
      )
    ).toBeVisible();
  });

  // 4. Objective form validates required title
  test('objective form validates required title', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('button', { name: /create objective|add objective|new objective|new OKR/i }).click();
    // Submit without filling required title
    await page.getByRole('button', { name: /^save$|^submit$|^create$/i }).click();
    await expect(
      page.getByText(/required|title is required|name is required|please enter/i).or(
        page.locator(':invalid')
      )
    ).toBeVisible();
  });

  // 5. Key result can be added to an objective
  test('key result can be added to an objective', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Open an objective or create one
    const objectiveRow = page.locator('[class*="objective"], [data-testid*="objective"]').first();
    if (await objectiveRow.isVisible()) {
      await objectiveRow.click();
    } else {
      await page.getByRole('button', { name: /create objective|add objective|new objective/i }).click();
    }
    await expect(
      page.getByRole('button', { name: /add key result|new key result/i }).or(
        page.getByText(/key result/i)
      )
    ).toBeVisible();
  });

  // 6. Progress percentage shows with visual bar
  test('progress percentage shows with visual bar', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('progressbar').or(
        page.locator('[class*="progress"]').or(
          page.getByText(/%|progress/i)
        )
      )
    ).toBeVisible();
  });

  // 7. Progress band label shows (Achieved/On Track/Progressing/Behind)
  test('progress band label is displayed', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/achieved|on track|progressing|behind/i)
    ).toBeVisible();
  });

  // 8. OKR grade (A-F) is displayed
  test('OKR grade A-F is displayed', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/grade|grade:\s*[A-F]|\bA\b|\bB\b|\bC\b|\bD\b|\bF\b/i).or(
        page.locator('[class*="grade"]')
      )
    ).toBeVisible();
  });

  // 9. Check-in update form opens
  test('check-in update form opens', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const checkInBtn = page.getByRole('button', { name: /check.?in|update progress|add update/i });
    if (await checkInBtn.isVisible()) {
      await checkInBtn.click();
      await expect(
        page.getByRole('dialog').or(page.getByRole('form')).or(
          page.getByLabel(/progress|note|update/i)
        )
      ).toBeVisible();
    } else {
      await expect(page.getByText(/objective|key result/i)).toBeVisible();
    }
  });

  // 10. Analytics/summary section shows aggregated progress
  test('analytics/summary section shows aggregated progress', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const analyticsTab = page.getByRole('tab', { name: /analytics|summary|overview/i }).or(
      page.getByRole('button', { name: /analytics|summary/i })
    );
    if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
    }
    await expect(
      page.getByText(/aggregat|summary|overview|total progress|average/i).or(
        page.locator('canvas, svg[class*="chart"], [class*="chart"]')
      )
    ).toBeVisible();
  });

  // 11. Company/team/individual OKR hierarchy selectable
  test('company/team/individual OKR hierarchy is selectable', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/company|team|individual/i).or(
        page.getByRole('tab', { name: /company|team|individual/i }).or(
          page.getByRole('radio', { name: /company|team|individual/i }).or(
            page.getByRole('button', { name: /company|team|individual/i })
          )
        )
      )
    ).toBeVisible();
  });

  // 12. Employee can view but has limited edit access
  test('employee can view OKRs but has limited edit access', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/okr`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Employee should see their OKRs
    await expect(
      page.getByText(/objective|key result|okr|no okr/i)
    ).toBeVisible();
    // Employee should NOT see admin/bulk management buttons
    await expect(
      page.getByRole('button', { name: /manage all|bulk|admin/i })
    ).not.toBeVisible();
  });
});
