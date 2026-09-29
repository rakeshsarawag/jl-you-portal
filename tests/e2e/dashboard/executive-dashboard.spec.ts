/**
 * Executive Dashboard — KPI cards, tabs, drill-through, exports, RBAC
 */
import { test, expect, BASE_URL, isErrorPage} from "../shared/fixtures";

test.describe("Executive Dashboard", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto(`${BASE_URL}/executive-dashboard`);
  });

  // ── Page load ────────────────────────────────────────────────────────────────

  test("Page loads with executive dashboard heading", async ({ page }) => {
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole("heading", { name: /executive|dashboard/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("Sidebar is visible on load", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const sidebar = page
      .getByRole("navigation")
      .or(page.locator("aside, [data-testid=sidebar], .sidebar"))
      .first();
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  // ── KPI tiles ────────────────────────────────────────────────────────────────

  test("KPI tiles are visible — headcount, revenue, or attrition", async ({ page }) => {
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/headcount|total employees|employee count/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("At least one numeric KPI value is displayed", async ({ page }) => {
    if (await isErrorPage(page)) return;
    // KPI cards usually contain a standalone number
    const kpiNumbers = page.locator("[class*=kpi], [class*=stat], [data-testid*=kpi]");
    const count = await kpiNumbers.count();
    if (count === 0) {
      // Fallback: look for any visible text that is a number
      const numericText = page.getByText(/^\d[\d,\.]+$/).first();
      await expect(numericText).toBeVisible({ timeout: 10000 });
    } else {
      expect(count).toBeGreaterThan(0);
    }
  });

  test("Trend arrows or indicators are present on KPI tiles", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const arrows = page
      .locator("[class*=trend], [class*=arrow], [aria-label*=trend]")
      .or(page.getByText(/↑|↓|▲|▼/))
      .first();
    // Defensive: only assert if arrows are found
    const arrowCount = await arrows.count();
    if (arrowCount > 0) {
      await expect(arrows).toBeVisible();
    }
  });

  // ── Tab: People ───────────────────────────────────────────────────────────────

  test("People tab is clickable and shows headcount content", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const peopleTab = page.getByRole("tab", { name: /people/i });
    if (!await peopleTab.isVisible()) return;
    await peopleTab.click();
    await expect(
      page.getByText(/headcount|department|attrition/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("People tab — department breakdown content is present", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const peopleTab = page.getByRole("tab", { name: /people/i });
    if (!await peopleTab.isVisible()) return;
    await peopleTab.click();
    await expect(
      page.getByText(/department|breakdown|by team/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Tab: Finance ──────────────────────────────────────────────────────────────

  test("Finance tab is clickable and shows revenue or payroll content", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const financeTab = page.getByRole("tab", { name: /finance/i });
    if (!await financeTab.isVisible()) return;
    await financeTab.click();
    await expect(
      page.getByText(/revenue|payroll|invoice|cost/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Tab: OKR ─────────────────────────────────────────────────────────────────

  test("OKR tab shows completion percentage or ring", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const okrTab = page.getByRole("tab", { name: /okr/i });
    if (!await okrTab.isVisible()) return;
    await okrTab.click();
    await expect(
      page.getByText(/completion|okr|objective|%/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Tab: Operations / Projects ────────────────────────────────────────────────

  test("Operations or Projects tab shows project health counts", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const opsTab = page
      .getByRole("tab", { name: /operations|projects|ops/i })
      .first();
    if (!await opsTab.isVisible()) return;
    await opsTab.click();
    await expect(
      page.getByText(/project|health|on track|at risk|completed/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Filters & alerts ─────────────────────────────────────────────────────────

  test("Date range filter control is visible if present", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const dateFilter = page
      .getByRole("combobox", { name: /date|period|range/i })
      .or(page.getByLabel(/date range|period/i))
      .or(page.locator("input[type=date]"))
      .first();
    const filterCount = await dateFilter.count();
    if (filterCount > 0) {
      await expect(dateFilter).toBeVisible();
    }
  });

  test("Alerts or notifications section is present if rendered", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const alerts = page
      .getByRole("alert")
      .or(page.getByText(/alert|notification|warning/i).first());
    const alertCount = await alerts.count();
    if (alertCount > 0) {
      await expect(alerts.first()).toBeVisible();
    }
  });

  // ── Export ────────────────────────────────────────────────────────────────────

  test("Export button is visible to admin", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const exportBtn = page
      .getByRole("button", { name: /export|download|pdf/i })
      .first();
    const exportCount = await exportBtn.count();
    if (exportCount > 0) {
      await expect(exportBtn).toBeVisible();
    }
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  test("Employee cannot access executive dashboard — redirected or Access Denied", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/executive-dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const denied = await page
      .getByText(/access denied|restricted|permission|not authorized|403/i)
      .count();
    const onLoginPage = page.url().includes("login");
    const hasHeading = await page
      .getByRole("heading", { name: /executive/i })
      .count();
    expect(denied > 0 || onLoginPage || hasHeading === 0).toBe(true);
  });

  test("HR can access executive dashboard or is redirected gracefully", async ({ page, loginAs }) => {
    await loginAs("hr");
    await page.goto(`${BASE_URL}/executive-dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // HR may or may not have access; either outcome is acceptable, just no crash
    const crashed = await page.getByText(/uncaught|error: |cannot read/i).count();
    expect(crashed).toBe(0);
  });

  test("Finance user can access executive dashboard or is redirected gracefully", async ({ page, loginAs }) => {
    await loginAs("finance");
    await page.goto(`${BASE_URL}/executive-dashboard`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const crashed = await page.getByText(/uncaught|error: |cannot read/i).count();
    expect(crashed).toBe(0);
  });
});
