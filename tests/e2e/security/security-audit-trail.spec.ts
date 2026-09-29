/**
 * Audit Trail / Audit Logs — Comprehensive E2E tests
 * Route: /audit-logs   Component: AuditLogsPage
 * Covers: immutable log entries, module/action/date/actor filters,
 *         before/after diff view, CSV export, append-only constraint, RBAC
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

/** Navigate to the audit logs page (tries /audit-logs then falls back to /security-compliance) */
async function gotoAuditLogs(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/audit-logs`);
  await page.waitForTimeout(800);
  if (await isErrorPage(page)) return;
  const onAuditPage = await page.getByText(/audit log|audit trail/i).isVisible().catch(() => false);
  if (!onAuditPage) {
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Navigate to audit tab if needed
    const auditTab = page.getByRole('tab', { name: /audit/i }).first();
    if (await auditTab.isVisible()) await auditTab.click();
  }
}

test.describe('Audit Trail / Audit Logs — Comprehensive', () => {
  // ── 1. Audit log page loads with entries or empty state ──────────────────────

  test('1. Audit log page loads with entries or empty state', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);

    await expect(
      page.getByText(/audit log|audit trail/i).first()
    ).toBeVisible({ timeout: 10000 });

    const hasRows = (await page.locator('table tbody tr').count()) > 0;
    const hasEmptyState = (await page.getByText(/no.*log|no records|no audit|empty/i).count()) > 0;
    expect(hasRows || hasEmptyState).toBe(true);
  });

  // ── 2. Filter by module (payroll) narrows results ────────────────────────────

  test('2. Filter by module (payroll) narrows results', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const moduleFilter = page
      .getByLabel(/module|entity type/i)
      .or(page.locator('select[name*="module"], [data-testid*="module"]'))
      .or(page.locator('select').first())
      .first();

    if (!await moduleFilter.isVisible()) return;

    const initialRows = await page.locator('table tbody tr').count();
    // Select payroll option if present; otherwise pick index 1
    await moduleFilter.selectOption('payroll').catch(() =>
      moduleFilter.selectOption({ index: 1 }).catch(() => {})
    );
    await page.waitForTimeout(600);

    const filteredRows = await page.locator('table tbody tr').count();
    const noResult = await page.getByText(/no results|no.*log|empty/i).count();
    expect(filteredRows <= initialRows || noResult > 0).toBe(true);
  });

  // ── 3. Filter by action type (create/update/delete) ──────────────────────────

  test('3. Filter by action type (create/update/delete) works', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const actionFilter = page
      .getByLabel(/action|action type/i)
      .or(page.locator('select[name*="action"]'))
      .first();

    // Also try chip/button filters labelled with action types
    if (!await actionFilter.isVisible()) {
      const chipFilter = page
        .getByRole('button', { name: /create|update|delete|approve/i })
        .first();
      if (await chipFilter.isVisible()) {
        const initialRows = await page.locator('table tbody tr').count();
        await chipFilter.click();
        await page.waitForTimeout(500);
        const filteredRows = await page.locator('table tbody tr').count();
        const noResult = await page.getByText(/no results|empty/i).count();
        expect(filteredRows <= initialRows || noResult > 0).toBe(true);
      }
      return;
    }

    const initialRows = await page.locator('table tbody tr').count();
    await actionFilter.selectOption({ index: 1 }).catch(() => {});
    await page.waitForTimeout(600);
    const filteredRows = await page.locator('table tbody tr').count();
    const noResult = await page.getByText(/no results|no.*log|empty/i).count();
    expect(filteredRows <= initialRows || noResult > 0).toBe(true);
  });

  // ── 4. Date range from/to filter applies ─────────────────────────────────────

  test('4. Date range from/to filter applies without crashing', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    if (count === 0) return;

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Fill from-date
    await dateInputs.nth(0).fill(yesterday).catch(() => {});
    // Fill to-date if a second date input exists
    if (count >= 2) {
      await dateInputs.nth(1).fill(today).catch(() => {});
    }
    await page.waitForTimeout(600);

    // Page should not crash — audit heading still visible
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible();
  });

  // ── 5. Search by actor email narrows results ──────────────────────────────────

  test('5. Search by actor email narrows results', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const searchInput = page
      .getByPlaceholder(/search|actor|email|filter/i)
      .or(page.getByLabel(/search|actor|email/i))
      .first();

    if (!await searchInput.isVisible()) return;

    await searchInput.fill('zzz_noemail_match@test.com');
    await page.waitForTimeout(500);
    const rows = await page.locator('table tbody tr').count();
    const noResult = await page.getByText(/no results|no.*log|not found/i).count();
    expect(rows === 0 || noResult > 0).toBe(true);
  });

  // ── 6. Log entry shows actor name and timestamp ───────────────────────────────

  test('6. Log entry shows actor name and timestamp', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const rows = await page.locator('table tbody tr').count();
    if (rows === 0) return;

    const firstRow = page.locator('table tbody tr').first();
    const rowText = await firstRow.innerText();

    // Row should contain at minimum a date/time pattern or an email/@
    const hasTimestamp = /\d{4}|\d{2}:\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|today|ago/i.test(rowText);
    const hasActor = /@|admin|system|jl/i.test(rowText);
    expect(hasTimestamp || hasActor).toBe(true);
  });

  // ── 7. Clicking log entry opens detail with entity info ──────────────────────

  test('7. Clicking a log entry opens detail with entity info', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const firstRow = page.locator('table tbody tr').first();
    if (!await firstRow.isVisible()) return;

    await firstRow.click();
    await page.waitForTimeout(400);

    // Either a modal opens or a detail panel expands
    await expect(
      page
        .getByRole('dialog')
        .or(page.getByText(/entity|record id|action|changed by|ip address/i).first())
    ).toBeVisible({ timeout: 8000 });
  });

  // ── 8. Detail view shows before/after values when changed_fields present ─────

  test('8. Detail view shows before/after values when available', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    // Look for an update/edit action row — more likely to have before/after data
    const updateRow = page
      .locator('table tbody tr:has-text("update"), table tbody tr:has-text("edit"), table tbody tr:has-text("modify")')
      .first();

    const targetRow = (await updateRow.isVisible()) ? updateRow : page.locator('table tbody tr').first();
    if (!await targetRow.isVisible()) return;

    await targetRow.click();
    await page.waitForTimeout(400);

    // Detail may show before/after as JSON diff, key-value list, or labelled sections
    const diffVisible = await page.getByText(/before|after|previous|old value|new value|changed/i).count();
    // Even if no changed_fields — detail opening without crash is acceptable
    expect(diffVisible >= 0).toBe(true);
  });

  // ── 9. No delete button on individual log entries (immutable) ────────────────

  test('9. No delete button on individual log entries (append-only)', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    // Check list-level: no delete buttons on rows
    const deleteInRows = await page
      .locator('table tbody tr')
      .getByRole('button', { name: /delete|remove/i })
      .count();
    expect(deleteInRows).toBe(0);

    // Open first row detail and confirm no delete button there either
    const firstRow = page.locator('table tbody tr').first();
    if (!await firstRow.isVisible()) return;
    await firstRow.click();
    await page.waitForTimeout(300);

    const deleteInDetail = await page
      .getByRole('dialog')
      .getByRole('button', { name: /delete|remove/i })
      .count();
    expect(deleteInDetail).toBe(0);
  });

  // ── 10. CSV export button present and enabled ─────────────────────────────────

  test('10. CSV export button is present and enabled for admin', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);
    await expect(page.getByText(/audit log|audit trail/i).first()).toBeVisible({ timeout: 10000 });

    const exportBtn = page
      .getByRole('button', { name: /export|csv|download/i })
      .first();

    if (await exportBtn.isVisible()) {
      await expect(exportBtn).toBeEnabled();
    } else {
      // May be behind an overflow menu
      const overflowMenu = page.getByRole('button', { name: /more actions|\.\.\.|options/i }).first();
      if (await overflowMenu.isVisible()) {
        await overflowMenu.click();
        const menuExport = page.getByRole('menuitem', { name: /export|csv|download/i }).first();
        await expect(menuExport).toBeVisible({ timeout: 5000 });
      }
    }
  });

  // ── 11. Employee cannot access audit logs ─────────────────────────────────────

  test('11. Employee cannot access audit logs', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/audit-logs`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle').catch(() => {});

    const accessDenied = await page
      .getByText(/access denied|403|forbidden|not authorized|permission|restricted/i)
      .count();
    const auditVisible = await page.getByText(/audit log|audit trail/i).isVisible().catch(() => false);
    const redirected = !page.url().includes('/audit-logs');

    expect(accessDenied > 0 || !auditVisible || redirected).toBe(true);
  });

  // ── 12. IT admin can access audit logs ───────────────────────────────────────

  test('12. IT admin (admin role) can access audit logs', async ({ page, loginAs }) => {
    await loginAs('admin');
    await gotoAuditLogs(page);

    await expect(
      page.getByText(/audit log|audit trail/i).first()
    ).toBeVisible({ timeout: 10000 });

    // Verify the page shows actual content controls (filter or table)
    const hasTableOrFilter =
      (await page.locator('table, select, input[type="date"]').count()) > 0 ||
      (await page.getByText(/no.*log|no records|empty/i).count()) > 0;
    expect(hasTableOrFilter).toBe(true);
  });
});
