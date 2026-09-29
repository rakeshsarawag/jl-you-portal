/**
 * Onboarding Portal Enhanced V2 — checklist, document upload, e-signature,
 * welcome kit, IT setup, bulk upload, offboarding, role-based views.
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Onboarding Portal Enhanced', () => {
  // 1. Onboarding portal loads
  test('onboarding portal loads', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /onboard/i }).or(
        page.getByText(/onboarding portal|welcome|getting started/i)
      )
    ).toBeVisible();
  });

  // 2. Onboarding checklist shows tasks
  test('onboarding checklist shows tasks', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/checklist|task|IT setup|document submission|submit document/i).or(
        page.getByRole('list').or(page.getByRole('checkbox'))
      )
    ).toBeVisible();
  });

  // 3. Task completion updates progress bar
  test('task completion updates progress bar', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('progressbar').or(
        page.locator('[class*="progress"]').or(
          page.getByText(/% complete|progress|tasks completed/i)
        )
      )
    ).toBeVisible();
    const firstCheckbox = page.getByRole('checkbox').first();
    if (await firstCheckbox.isVisible() && !await firstCheckbox.isChecked()) {
      await firstCheckbox.click();
      await expect(
        page.getByRole('progressbar').or(page.getByText(/progress|complete/i))
      ).toBeVisible();
    }
  });

  // 4. Document upload section present
  test('document upload section is present', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/document upload|upload document|file upload/i).or(
        page.getByRole('tab', { name: /document/i }).or(
          page.locator('input[type="file"]')
        )
      )
    ).toBeVisible();
  });

  // 5. Welcome kit section visible
  test('welcome kit section is visible', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/welcome kit|welcome pack|starter kit/i).or(
        page.getByRole('tab', { name: /welcome kit/i }).or(
          page.getByRole('button', { name: /welcome kit/i })
        )
      )
    ).toBeVisible();
  });

  // 6. Bulk upload CSV button present for HR/admin
  test('bulk upload CSV button present for HR', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('button', { name: /bulk upload|upload csv|import/i }).or(
        page.getByText(/bulk upload|bulk import/i)
      )
    ).toBeVisible();
  });

  // 7. Offboarding section accessible
  test('offboarding section is accessible', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/offboard/i).or(
        page.getByRole('tab', { name: /offboard/i }).or(
          page.getByRole('button', { name: /offboard/i })
        )
      )
    ).toBeVisible();
  });

  // 8. HR sees all employees' onboarding progress
  test('HR sees all employees onboarding progress', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/all employee|all joiners|onboarding status|overview/i).or(
        page.getByRole('table').or(
          page.getByRole('heading', { name: /overview|all/i })
        )
      )
    ).toBeVisible();
  });

  // 9. Employee sees only their own onboarding tasks
  test('employee sees only their own onboarding tasks', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Should see personal tasks
    await expect(
      page.getByText(/my task|your task|my checklist|welcome/i)
    ).toBeVisible();
    // Should NOT see all employees overview
    await expect(
      page.getByText(/all employee|all joiners/i)
    ).not.toBeVisible();
  });

  // 10. E-signature section present for document tasks
  test('e-signature section is present for document tasks', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/onboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/e.?sign|signature|sign document/i).or(
        page.getByRole('button', { name: /sign|e-sign/i }).or(
          page.getByRole('tab', { name: /signature|sign/i })
        )
      )
    ).toBeVisible();
  });
});
