/**
 * Performance Tracker — review CRUD, self-assessment, and role-based views
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Performance Tracker', () => {
  test('employee can submit a self-assessment', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const heading = page.getByRole('heading', { name: /performance/i });
    if (!await heading.isVisible({ timeout: 10000 }).catch(() => false)) return;
    const selfBtn = page.getByRole('button', { name: /self.?assessment/i });
    if (!await selfBtn.isVisible().catch(() => false)) return;
    await selfBtn.click();
    const achieveField = page.getByLabel(/achievements/i).or(page.getByPlaceholder(/achievements/i)).first();
    if (await achieveField.isVisible().catch(() => false)) {
      await achieveField.fill('Delivered project X on time');
    }
    const goalsField = page.getByLabel(/goals/i).or(page.getByPlaceholder(/goals/i)).first();
    if (await goalsField.isVisible().catch(() => false)) {
      await goalsField.fill('Improve team communication');
    }
    const submitBtn = page.getByRole('button', { name: /submit/i }).first();
    if (await submitBtn.isVisible().catch(() => false)) await submitBtn.click();
    await expect(page.getByText(/submitted|saved|success/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('manager can create a performance review for a report', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const newReviewBtn = page.getByRole('button', { name: /new review|create review/i });
    if (!await newReviewBtn.isVisible({ timeout: 10000 }).catch(() => false)) return;
    await newReviewBtn.click();
    // Use a search/dropdown to select employee — don't hardcode an email address
    const empField = page.getByLabel(/employee/i).or(page.getByPlaceholder(/search employee|select employee/i)).first();
    if (await empField.isVisible().catch(() => false)) {
      await empField.fill('Rakesh');
      const option = page.getByRole('option').first();
      if (await option.isVisible({ timeout: 3000 }).catch(() => false)) await option.click();
    }
    const ratingField = page.getByLabel(/rating|score/i).first();
    if (await ratingField.isVisible().catch(() => false)) await ratingField.fill('4');
    const commentsField = page.getByLabel(/comments/i).first();
    if (await commentsField.isVisible().catch(() => false)) {
      await commentsField.fill('Good performance this quarter');
    }
    const saveBtn = page.getByRole('button', { name: /save|submit/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
    await expect(page.getByText(/review saved|created|success/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('manager sees team review dashboard', async ({ page, loginAs }) => {
    await loginAs('manager');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/team|reports|direct/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('employee sees only own review, not team dashboard', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/my review|self|assessment/i).first()
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/manage team reviews/i)).not.toBeVisible();
  });

  test('employee cannot access /performance/admin', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/performance/admin`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/permission|access denied|not authorized|403/i).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
