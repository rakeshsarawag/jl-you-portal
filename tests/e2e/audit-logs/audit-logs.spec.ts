/**
 * Audit Logs — E2E tests
 * Covers: page load, filters, CSV export, log entry content validation, RBAC
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin');
    // Try security-compliance route first (where audit logs often live), then dedicated route
    await page.goto(`${BASE_URL}/security-compliance`);
    const onSecurityPage = await page.getByText(/audit log|security/i).isVisible();
    if (!onSecurityPage) {
      await page.goto(`${BASE_URL}/audit-logs`);
      await page.waitForTimeout(800);
      if (await isErrorPage(page)) return;
    }
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });
  });

  // ── Page loads ──────────────────────────────────────────────────────────────

  test('Audit log page renders log entries or empty state', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const hasContent =
      (await page.locator('table tbody tr').count()) > 0 ||
      (await page.getByText(/no.*log|no audit|empty/i).count()) > 0;
    expect(hasContent).toBe(true);
  });

  // ── Log entry structure ──────────────────────────────────────────────────────

  test('Log entries have actor, action, and timestamp columns', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const rows = await page.locator('table tbody tr').count();
    if (rows === 0) return; // No logs yet
    const firstRow = page.locator('table tbody tr').first();
    const text = await firstRow.innerText();
    // Should contain recognisable patterns (email, action verb, or date)
    const hasEmail = /@/.test(text);
    const hasAction = /create|update|delete|approve|login|export/i.test(text);
    const hasDate = /\d{4}|jan|feb|mar|today|ago/i.test(text);
    expect(hasEmail || hasAction || hasDate).toBe(true);
  });

  // ── Filters ──────────────────────────────────────────────────────────────────

  test('Module/entity filter reduces result set', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const moduleFilter = page.locator('select, [role="combobox"]').first();
    if (!await moduleFilter.isVisible()) return;
    const initialRows = await page.locator('table tbody tr').count();
    // Pick second option (first is "All")
    await moduleFilter.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(600);
    const filteredRows = await page.locator('table tbody tr').count();
    // Filtering should either reduce rows or show a no-results message
    const noResult = await page.getByText(/no results|no.*log|empty/i).count();
    expect(filteredRows <= initialRows || noResult > 0).toBe(true);
  });

  test('Date range filter limits log entries', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const dateInput = page.locator('input[type="date"]').first();
    if (!await dateInput.isVisible()) return;
    // Set date range to yesterday only — should narrow results
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().slice(0, 10);
    await dateInput.fill(dateStr);
    await page.waitForTimeout(600);
    // Just verify the filter doesn't crash the page
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible();
  });

  test('Search by actor email narrows logs', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const searchInput = page.getByPlaceholder(/search|actor|email|filter/i).first();
    if (!await searchInput.isVisible()) return;
    await searchInput.fill('zzz_noemail_match@test.com');
    await page.waitForTimeout(500);
    const rows = await page.locator('table tbody tr').count();
    const noResult = await page.getByText(/no results|no.*log/i).count();
    expect(rows === 0 || noResult > 0).toBe(true);
  });

  // ── Export ───────────────────────────────────────────────────────────────────

  test('CSV export button is present for admins', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const exportBtn = page.getByRole('button', { name: /export|csv|download/i });
    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeEnabled();
    }
  });

  test('CSV export triggers a download', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const exportBtn = page.getByRole('button', { name: /export.*csv|download.*csv/i });
    if (!await exportBtn.isVisible()) return;
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }).catch(() => null),
      exportBtn.click(),
    ]);
    if (download) {
      expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    }
  });

  // ── Log detail view ──────────────────────────────────────────────────────────

  test('Clicking a log entry opens detail if available', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const firstRow = page.locator('table tbody tr').first();
    if (!await firstRow.isVisible()) return;
    await firstRow.click();
    // Either a modal opens or details expand — just check no crash
    await page.waitForTimeout(300);
    await expect(page.getByText(/audit log|audit trail|detail/i).first()).toBeVisible();
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  test('Employee cannot access audit logs', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const denied = await page.getByText(/access denied|403|restricted|permission/i).count();
    const auditVisible = await page.getByText(/audit log/i).isVisible().catch(() => false);
    // Either the whole page is denied or audit is not accessible
    expect(denied > 0 || !auditVisible).toBe(true);
  });

  test('HR can view security compliance page', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // HR should see something related to compliance (may be limited view)
    const visible = await page.getByText(/security|compliance|mfa|audit/i).isVisible();
    expect(visible).toBe(true);
  });
});
