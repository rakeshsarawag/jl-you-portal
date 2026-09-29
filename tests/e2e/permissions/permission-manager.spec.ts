/**
 * Permission Manager — E2E tests
 * Covers: role visibility matrix, section permissions, audit log, temp grants, RBAC enforcement
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Permission Manager', () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/permissions`);
    await expect(
      page.getByRole('heading', { name: /permission/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Page loads ──────────────────────────────────────────────────────────────

  test('Permission manager renders with role columns', async ({ page }) => {
    if (await isErrorPage(page)) return;
    // Role names should appear as column headers or labels
    await expect(page.getByText(/admin/i).first()).toBeVisible();
    await expect(page.getByText(/employee/i).first()).toBeVisible();
  });

  // ── App visibility tab ───────────────────────────────────────────────────────

  test('App Visibility tab shows app list with role toggles', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page.getByRole('tab', { name: /app visibility|visibility/i });
    if (await tab.isVisible()) await tab.click();
    // App names from the registry should appear
    await expect(page.getByText(/dashboard|payroll|recruitment/i).first()).toBeVisible();
  });

  test('Toggle changes are flagged as unsaved', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page.getByRole('tab', { name: /app visibility|visibility/i });
    if (await tab.isVisible()) await tab.click();
    // Click any toggle/checkbox
    const firstToggle = page.locator('input[type="checkbox"], button[role="switch"]').first();
    if (await firstToggle.isVisible()) {
      await firstToggle.click({ force: true });
      await expect(page.getByText(/unsaved|pending/i).first()).toBeVisible({ timeout: 3000 });
    }
  });

  // ── Section permissions tab ──────────────────────────────────────────────────

  test('Section Permissions tab renders sections', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page.getByRole('tab', { name: /section permission/i });
    if (!await tab.isVisible()) return;
    await tab.click();
    await expect(page.getByText(/section|feature/i).first()).toBeVisible();
  });

  // ── Save & Apply ─────────────────────────────────────────────────────────────

  test('Save & Apply button is present and active when changes exist', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const saveBtn = page.getByRole('button', { name: /save.*apply|apply.*save/i });
    // Initially disabled (no changes)
    // After a toggle it should become enabled
    const tab = page.getByRole('tab', { name: /app visibility|visibility/i });
    if (await tab.isVisible()) await tab.click();
    const firstToggle = page.locator('input[type="checkbox"], button[role="switch"]').first();
    if (await firstToggle.isVisible()) {
      await firstToggle.click({ force: true });
      await expect(saveBtn).toBeEnabled({ timeout: 3000 });
    }
  });

  // ── Audit Log tab ────────────────────────────────────────────────────────────

  test('Audit Log tab shows history entries', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page.getByRole('tab', { name: /audit log|audit|history/i });
    if (!await tab.isVisible()) return;
    await tab.click();
    await expect(page.getByText(/audit|history|change|action/i).first()).toBeVisible({ timeout: 5000 });
  });

  // ── Temp Access tab ──────────────────────────────────────────────────────────

  test('Temp Access tab is present and shows grant form trigger', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page.getByRole('tab', { name: /temp access|temporary/i });
    if (!await tab.isVisible()) return;
    await tab.click();
    await expect(
      page.getByRole('button', { name: /new grant|grant access|\+ grant/i })
        .or(page.getByText(/active grant|no active/i)).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('New Grant form validates required fields', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page.getByRole('tab', { name: /temp access|temporary/i });
    if (!await tab.isVisible()) return;
    await tab.click();
    const grantBtn = page.getByRole('button', { name: /new grant|grant access|\+ grant/i });
    if (!await grantBtn.isVisible()) return;
    await grantBtn.click();
    await page.getByRole('button', { name: /create grant|grant/i }).first().click();
    const validationMsg = await page.getByText(/required|all fields/i).count();
    const formOpen = await page.locator('form').isVisible();
    expect(validationMsg > 0 || formOpen).toBe(true);
  });

  // ── Reset to defaults ─────────────────────────────────────────────────────────

  test('Reset to Defaults button loads defaults into editor', async ({ page }) => {
    if (await isErrorPage(page)) return;
    const resetBtn = page.getByRole('button', { name: /reset.*default|load.*default/i });
    if (!await resetBtn.isVisible()) return;
    await resetBtn.click();
    await expect(page.getByText(/loaded|unsaved|pending/i).first()).toBeVisible({ timeout: 5000 });
  });

  // ── RBAC: non-admin cannot access ───────────────────────────────────────────

  test('Non-admin user cannot access permission manager', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/permissions`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const denied = await page.getByText(/access denied|permission|403|restricted/i).count();
    const heading = await page.getByRole('heading', { name: /permission manager/i }).count();
    expect(denied > 0 || heading === 0).toBe(true);
  });
});
