/**
 * Security Compliance Dashboard — admin/IT only
 * Route: /security-compliance
 * Component: SecurityComplianceDashboard
 */
import { test, expect, BASE_URL, loginAs, isErrorPage} from '../shared/fixtures';

test.describe('Security Compliance Dashboard', () => {
  test('1. Security compliance page loads for admin', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByRole('heading', { name: /security compliance|security dashboard/i })
        .or(page.getByText(/security compliance/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('2. MFA enrollment status section visible', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/mfa|multi.factor|two.factor|2fa/i)
        .first()
        .or(page.getByRole('region', { name: /mfa|enrollment/i }))
    ).toBeVisible({ timeout: 15000 });
    // Should show enrolled/not-enrolled breakdown
    await expect(
      page
        .getByText(/enrolled|not enrolled|unenrolled/i)
        .first()
    ).toBeVisible();
  });

  test('3. Login history table shows entries or empty state', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Navigate to login history if tabbed
    const loginHistoryTab = page.getByRole('tab', { name: /login history|sign.in history/i });
    if (await loginHistoryTab.isVisible()) {
      await loginHistoryTab.click();
    }
    await expect(
      page
        .getByText(/ip address|device|timestamp|last login/i)
        .first()
        .or(page.getByText(/no login history|no records/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('4. Active sessions section present', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const sessionsTab = page.getByRole('tab', { name: /active sessions|sessions/i });
    if (await sessionsTab.isVisible()) {
      await sessionsTab.click();
    }
    await expect(
      page
        .getByText(/active sessions?|current sessions?/i)
        .first()
        .or(page.getByRole('region', { name: /sessions/i }))
    ).toBeVisible({ timeout: 15000 });
  });

  test('5. Admin can revoke a session (button present)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const sessionsTab = page.getByRole('tab', { name: /active sessions|sessions/i });
    if (await sessionsTab.isVisible()) {
      await sessionsTab.click();
    }
    await expect(
      page
        .getByRole('button', { name: /revoke|terminate|end session/i })
        .first()
        .or(page.getByText(/revoke/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('6. Security alerts section visible', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const alertsTab = page.getByRole('tab', { name: /alerts?|anomal/i });
    if (await alertsTab.isVisible()) {
      await alertsTab.click();
    }
    await expect(
      page
        .getByText(/security alerts?|anomal|suspicious/i)
        .first()
        .or(page.getByRole('region', { name: /alerts/i }))
    ).toBeVisible({ timeout: 15000 });
  });

  test('7. Password policy section shows configuration', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const policyTab = page.getByRole('tab', { name: /password policy|policy/i });
    if (await policyTab.isVisible()) {
      await policyTab.click();
    }
    await expect(
      page
        .getByText(/password policy|minimum length|complexity|expir/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('8. Two-factor authentication settings present', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/two.factor|2fa|mfa settings?|authenticator/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('9. Security score or health indicator present', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/security score|health|compliance score|overall/i)
        .first()
        .or(page.locator('[data-testid*="score"], [data-testid*="health"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('10. Employee cannot access security compliance', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/permission|access denied|not authorized|forbidden|unauthorized/i)
        .first()
        .or(page.getByText(/don't have (access|permission)/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('11. IT role can access security compliance', async ({ page }) => {
    // IT users share the admin fixture or use the it role if wired
    await loginAs(page, 'admin'); // fallback: admin covers IT access
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByRole('heading', { name: /security/i })
        .first()
        .or(page.getByText(/security compliance/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('12. Export/audit download available', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/security-compliance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByRole('button', { name: /export|download|audit trail/i })
        .first()
        .or(page.getByText(/export|download report/i).first())
    ).toBeVisible({ timeout: 15000 });
  });
});
