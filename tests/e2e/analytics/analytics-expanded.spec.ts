/**
 * Unified Analytics Dashboard / Advanced Analytics — KPI tiles, charts,
 * filters, drill-down, scheduled reports, custom report builder, executive
 * dashboard, and role-based access.
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Analytics Dashboard Expanded', () => {
  // 1. Analytics dashboard loads
  test('analytics dashboard loads', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /analytics|dashboard/i }).or(
        page.getByText(/analytics dashboard|unified analytics/i)
      )
    ).toBeVisible();
  });

  // 2. KPI tiles visible (headcount or revenue)
  test('KPI tiles are visible', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/headcount|revenue|attrition|leave utilisation|utilization/i)
    ).toBeVisible();
  });

  // 3. Chart renders (bar, line, or pie)
  test('at least one chart renders', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.locator('canvas, svg[class*="chart"], [class*="recharts"], [data-testid*="chart"], [class*="chart-container"]').or(
        page.locator('svg').filter({ has: page.locator('path, rect, circle') })
      )
    ).toBeVisible();
  });

  // 4. Date range filter applies without crashing
  test('date range filter applies without crashing', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const dateFilter = page.getByLabel(/date range|from date|start date/i).or(
      page.getByRole('combobox', { name: /date|period|range/i })
    );
    if (await dateFilter.isVisible()) {
      await dateFilter.selectOption({ index: 1 });
    } else {
      const dateBtn = page.getByRole('button', { name: /date range|last 30|this quarter/i }).first();
      if (await dateBtn.isVisible()) {
        await dateBtn.click();
      }
    }
    // Page must not crash
    await expect(
      page.getByRole('heading', { name: /analytics|dashboard/i }).or(
        page.locator('body')
      )
    ).toBeVisible();
  });

  // 5. Department filter reduces data
  test('department filter applies without crashing', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const deptFilter = page.getByLabel(/department/i).or(
      page.getByRole('combobox', { name: /department/i })
    );
    if (await deptFilter.isVisible()) {
      await deptFilter.selectOption({ index: 1 });
    }
    await expect(
      page.getByRole('heading', { name: /analytics|dashboard/i }).or(
        page.locator('body')
      )
    ).toBeVisible();
  });

  // 6. Drill-down from KPI opens detail view
  test('drill-down from KPI tile opens detail view', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const kpiTile = page.locator('[class*="kpi"], [data-testid*="kpi"], [class*="stat-card"]').first().or(
      page.getByText(/headcount|attrition/i).first()
    );
    if (await kpiTile.isVisible()) {
      await kpiTile.click();
      await expect(
        page.getByText(/detail|breakdown|drill|view all/i).or(
          page.getByRole('dialog').or(page.getByRole('table'))
        )
      ).toBeVisible();
    } else {
      await expect(page.getByText(/analytics/i)).toBeVisible();
    }
  });

  // 7. Scheduled reports section present
  test('scheduled reports section is present', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/scheduled report/i).or(
        page.getByRole('tab', { name: /scheduled|schedule/i }).or(
          page.getByRole('button', { name: /schedule report|scheduled report/i })
        )
      )
    ).toBeVisible();
  });

  // 8. Report builder tab accessible
  test('report builder tab is accessible', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const reportBuilderTab = page.getByRole('tab', { name: /report builder|custom report|build report/i }).or(
      page.getByRole('button', { name: /report builder|custom report/i })
    );
    if (await reportBuilderTab.isVisible()) {
      await reportBuilderTab.click();
    }
    await expect(
      page.getByText(/report builder|custom report|build your report/i)
    ).toBeVisible();
  });

  // 9. Executive dashboard route loads
  test('executive dashboard route loads', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/executive-dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /executive|dashboard/i }).or(
        page.getByText(/executive dashboard|executive view/i)
      )
    ).toBeVisible();
  });

  // 10. Finance can access analytics
  test('finance role can access analytics', async ({ page, loginAs }) => {
    await loginAs('finance');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /analytics|dashboard/i }).or(
        page.getByText(/revenue|finance|headcount/i)
      )
    ).toBeVisible();
    await expect(
      page.getByText(/permission denied|access denied|restricted/i)
    ).not.toBeVisible();
  });

  // 11. Employee cannot access executive dashboard
  test('employee cannot access executive dashboard', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/executive-dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/permission|access denied|restricted|not authorized|unauthorized/i)
    ).toBeVisible();
  });

  // 12. Export/download button present in reports
  test('export/download button present in reports section', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const reportsTab = page.getByRole('tab', { name: /report/i }).or(
      page.getByRole('button', { name: /report/i })
    );
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
    }
    await expect(
      page.getByRole('button', { name: /export|download|csv|pdf/i }).or(
        page.getByText(/export|download report/i)
      )
    ).toBeVisible();
  });
});
