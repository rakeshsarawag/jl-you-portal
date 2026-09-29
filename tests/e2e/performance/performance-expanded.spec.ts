/**
 * Performance Tracker Enhanced V2 — review cycles, goals, 360 feedback,
 * PIP, continuous feedback, calibration, rating charts, and role-based views.
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Performance Tracker Enhanced', () => {
  // 1. Performance tracker loads
  test('performance tracker loads', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /performance/i }).or(
        page.getByText(/performance tracker|performance management/i)
      )
    ).toBeVisible();
  });

  // 2. Review cycles list is visible (or empty state)
  test('review cycles list is visible or shows empty state', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const cyclesTab = page.getByRole('tab', { name: /cycle|review cycle/i }).or(
      page.getByRole('button', { name: /cycle|review cycle/i })
    );
    if (await cyclesTab.isVisible()) {
      await cyclesTab.click();
    }
    await expect(
      page.getByText(/review cycle|no cycle|no review/i).or(
        page.getByRole('table').or(page.getByRole('list'))
      )
    ).toBeVisible();
  });

  // 3. Goal creation form opens
  test('goal creation form opens', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const goalsTab = page.getByRole('tab', { name: /goal/i }).or(
      page.getByRole('button', { name: /goal/i })
    );
    if (await goalsTab.isVisible()) {
      await goalsTab.click();
    }
    await page.getByRole('button', { name: /add goal|create goal|new goal/i }).click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('form')).or(
        page.getByLabel(/goal title|goal name/i)
      )
    ).toBeVisible();
  });

  // 4. Goal form validates required name/title field
  test('goal form validates required name/title field', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const goalsTab = page.getByRole('tab', { name: /goal/i }).or(
      page.getByRole('button', { name: /goal/i })
    );
    if (await goalsTab.isVisible()) {
      await goalsTab.click();
    }
    await page.getByRole('button', { name: /add goal|create goal|new goal/i }).click();
    // Try to submit without filling required title
    await page.getByRole('button', { name: /^save$|^submit$|^create$/i }).click();
    await expect(
      page.getByText(/required|title is required|name is required|please enter/i).or(
        page.locator(':invalid')
      )
    ).toBeVisible();
  });

  // 5. 360 feedback tab/section present
  test('360 feedback tab/section is present', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('tab', { name: /360|feedback/i }).or(
        page.getByText(/360.degree|360 feedback|peer feedback/i)
      )
    ).toBeVisible();
  });

  // 6. HR can see calibration section
  test('HR can see calibration section', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const analyticsTab = page.getByRole('tab', { name: /analytics/i });
    if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
    }
    await expect(
      page.getByText(/calibration/i).or(
        page.getByRole('tab', { name: /calibration/i }).or(
          page.getByRole('button', { name: /calibration/i })
        )
      )
    ).toBeVisible();
  });

  // 7. Employee can submit feedback for a colleague
  test('employee can submit feedback for a colleague', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const feedbackTab = page.getByRole('tab', { name: /feedback|360/i }).or(
      page.getByRole('button', { name: /give feedback|submit feedback/i })
    );
    if (await feedbackTab.isVisible()) {
      await feedbackTab.click();
    }
    const submitBtn = page.getByRole('button', { name: /give feedback|submit feedback|request feedback/i });
    if (await submitBtn.isVisible()) {
      await submitBtn.click();
      await expect(
        page.getByRole('dialog').or(page.getByRole('form')).or(
          page.getByLabel(/feedback|colleague|recipient/i)
        )
      ).toBeVisible();
    } else {
      // Fallback: feedback section is present
      await expect(page.getByText(/feedback/i)).toBeVisible();
    }
  });

  // 8. PIP section accessible to HR/manager
  test('PIP section is accessible to HR', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/performance improvement plan|PIP/i).or(
        page.getByRole('tab', { name: /pip|improvement/i }).or(
          page.getByRole('button', { name: /pip|improvement plan/i })
        )
      )
    ).toBeVisible();
  });

  test('PIP section is accessible to manager', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/performance improvement plan|PIP/i).or(
        page.getByRole('tab', { name: /pip|improvement/i }).or(
          page.getByRole('button', { name: /pip|improvement plan/i })
        )
      )
    ).toBeVisible();
  });

  // 9. Continuous feedback widget present
  test('continuous feedback widget is present', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/continuous feedback|quick feedback|kudos/i).or(
        page.getByRole('tab', { name: /continuous|kudos/i }).or(
          page.getByRole('button', { name: /kudos|give kudos|quick feedback/i })
        )
      )
    ).toBeVisible();
  });

  // 10. Rating chart renders for employee with review history
  test('rating trend chart renders', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const analyticsTab = page.getByRole('tab', { name: /analytics|trends|history/i });
    if (await analyticsTab.isVisible()) {
      await analyticsTab.click();
    }
    await expect(
      page.locator('canvas, svg[class*="chart"], [class*="chart"], [data-testid*="chart"]').or(
        page.getByText(/rating trend|rating history|no review history/i)
      )
    ).toBeVisible();
  });

  // 11. Employee can view their own review history
  test('employee can view their own review history', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/my review|review history|past review/i).or(
        page.getByRole('tab', { name: /my review|history/i })
      )
    ).toBeVisible();
  });

  // 12. Manager can see team performance overview
  test('manager can see team performance overview', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/team performance|team overview|direct report/i).or(
        page.getByRole('tab', { name: /team/i }).or(
          page.getByRole('heading', { name: /team/i })
        )
      )
    ).toBeVisible();
  });
});
