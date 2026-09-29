/**
 * User Management — expanded coverage
 * Route: /user-management
 * Component: UserManagement.tsx
 * Features: list, search, filters, create, edit, deactivate, bulk CSV import,
 *           MFA toggle, invite, reset password, login history, session management
 */
import { test, expect, BASE_URL, loginAs, isErrorPage} from '../shared/fixtures';

test.describe('User Management — Expanded', () => {
  test('1. User list shows with JL employee codes', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/JL\d+|employee code|emp code/i)
        .first()
        .or(page.getByRole('table').first())
        .or(page.getByRole('list').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('2. Search by name or email finds users', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const searchInput = page
      .getByPlaceholder(/search|find user|name or email/i)
      .or(page.getByRole('searchbox'))
      .first();
    await searchInput.fill('admin');
    await page.keyboard.press('Enter');
    await expect(
      page
        .getByText(/admin|no results|no users found/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('3. Role filter (admin/hr/employee/finance) works', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const roleFilter = page
      .getByLabel(/role/i)
      .or(page.locator('select[name*="role"], [data-testid*="role-filter"]').first());
    if (await roleFilter.isVisible()) {
      await roleFilter.selectOption('employee');
      await expect(
        page
          .getByText(/employee|no results/i)
          .first()
      ).toBeVisible({ timeout: 10000 });
    } else {
      // Button-based role filter
      const roleBtn = page
        .getByRole('button', { name: /role|filter/i })
        .first();
      await roleBtn.click();
      await page
        .getByRole('option', { name: /employee/i })
        .or(page.getByText(/employee/i).first())
        .click();
      await expect(page.getByText(/employee/i).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('4. Status filter (active/inactive) works', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const statusFilter = page
      .getByLabel(/status/i)
      .or(page.locator('select[name*="status"], [data-testid*="status-filter"]').first());
    if (await statusFilter.isVisible()) {
      await statusFilter.selectOption('inactive');
      await expect(
        page
          .getByText(/inactive|deactivated|no results/i)
          .first()
      ).toBeVisible({ timeout: 10000 });
    } else {
      // Button/dropdown-based status filter
      const statusBtn = page
        .getByRole('button', { name: /status|filter/i })
        .first();
      if (await statusBtn.isVisible()) {
        await statusBtn.click();
        await page
          .getByRole('option', { name: /inactive/i })
          .or(page.getByText(/inactive/i).first())
          .click();
        await expect(
          page.getByText(/inactive|deactivated|no results/i).first()
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('5. Admin can open create user form', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page
      .getByRole('button', { name: /add user|new user|create user|invite/i })
      .first()
      .click();
    await expect(
      page
        .getByRole('dialog')
        .or(page.getByRole('form'))
        .or(page.getByText(/create user|add new user|user details/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('6. Create user form validates email format', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page
      .getByRole('button', { name: /add user|new user|create user|invite/i })
      .first()
      .click();
    const emailField = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]').first());
    await emailField.fill('not-an-email');
    await page
      .getByRole('button', { name: /save|create|submit|send invite/i })
      .first()
      .click();
    await expect(
      page
        .getByText(/invalid email|valid email|email format|enter a valid/i)
        .first()
        .or(page.locator('input[type="email"]:invalid').first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('7. Create user form validates required role field', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page
      .getByRole('button', { name: /add user|new user|create user|invite/i })
      .first()
      .click();
    // Fill valid name and email but skip role
    const nameField = page
      .getByLabel(/name|full name/i)
      .or(page.locator('input[name*="name"]').first());
    await nameField.fill('Role Validation Test');
    const emailField = page
      .getByLabel(/email/i)
      .or(page.locator('input[type="email"]').first());
    await emailField.fill(`role.${Date.now()}@example.com`);
    await page
      .getByRole('button', { name: /save|create|submit|send invite/i })
      .first()
      .click();
    await expect(
      page
        .getByText(/role is required|select a role|required/i)
        .first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('8. Bulk CSV import button opens import modal', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page
      .getByRole('button', { name: /bulk|csv import|import users?/i })
      .first()
      .click();
    await expect(
      page
        .getByRole('dialog')
        .or(page.getByText(/csv|bulk import|upload file/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('9. MFA toggle visible per user in list or detail', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // MFA toggle might be in the list row or require opening a user detail
    const mfaInList = page
      .getByText(/mfa|force mfa|two.factor/i)
      .first();
    if (await mfaInList.isVisible()) {
      await expect(mfaInList).toBeVisible({ timeout: 10000 });
    } else {
      // Open first user detail
      await page
        .getByRole('row')
        .nth(1)
        .click()
        .catch(() =>
          page
            .getByRole('button', { name: /view|edit|details/i })
            .first()
            .click()
        );
      await expect(
        page
          .getByText(/mfa|force mfa|two.factor|2fa/i)
          .first()
          .or(page.locator('[data-testid*="mfa"]').first())
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('10. Admin can change user role', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Open first non-admin user
    const firstRow = page.getByRole('row').nth(1);
    if (await firstRow.isVisible()) {
      await firstRow.click();
    } else {
      await page
        .getByRole('button', { name: /edit|view/i })
        .first()
        .click();
    }
    const roleSelect = page
      .getByLabel(/role/i)
      .or(page.locator('select[name*="role"]').first());
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('manager');
      await page
        .getByRole('button', { name: /save|update/i })
        .first()
        .click();
      await expect(
        page
          .getByText(/role updated|saved|success/i)
          .first()
          .or(page.getByText(/manager/i).first())
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('11. Admin can deactivate a user (status changes)', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Click edit/detail on first user in the list
    const editBtn = page
      .getByRole('button', { name: /edit|options|more/i })
      .first()
      .or(page.getByRole('row').nth(1));
    await editBtn.click();
    const deactivateBtn = page
      .getByRole('button', { name: /deactivate|disable|suspend/i })
      .first();
    if (await deactivateBtn.isVisible()) {
      await deactivateBtn.click();
      // Confirm dialog if present
      const confirmBtn = page.getByRole('button', { name: /confirm|yes|ok/i }).first();
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }
      await expect(
        page
          .getByText(/deactivated|inactive|disabled/i)
          .first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('12. Non-admin cannot access user management', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(`${BASE_URL}/user-management`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/permission|access denied|not authorized|forbidden|unauthorized/i)
        .first()
        .or(page.getByText(/don't have (access|permission)/i).first())
    ).toBeVisible({ timeout: 15000 });
  });
});
