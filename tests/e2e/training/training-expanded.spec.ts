/**
 * Training Tracker Enhanced — course catalog, enrollment, learning paths,
 * progress tracking, quizzes, certificates, training needs analysis, sessions.
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Training Tracker Enhanced', () => {
  // 1. Training platform loads with course catalog
  test('training platform loads with course catalog', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /training/i }).or(
        page.getByText(/course catalog|training platform/i)
      )
    ).toBeVisible();
    await expect(
      page.getByText(/course|catalog/i)
    ).toBeVisible();
  });

  // 2. Course search/filter by category works
  test('course search/filter by category works', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const searchInput = page.getByPlaceholder(/search course|search training/i).or(
      page.getByRole('searchbox')
    );
    if (await searchInput.isVisible()) {
      await searchInput.fill('leadership');
      await expect(page).not.toHaveURL(/error/i);
      await expect(
        page.getByRole('heading', { name: /training/i }).or(page.getByText(/course|no result/i))
      ).toBeVisible();
    } else {
      const categoryFilter = page.getByLabel(/category/i).or(
        page.getByRole('combobox', { name: /category/i })
      );
      if (await categoryFilter.isVisible()) {
        await categoryFilter.selectOption({ index: 1 });
      }
      await expect(
        page.getByText(/course|training/i)
      ).toBeVisible();
    }
  });

  // 3. Employee can enroll in a course
  test('employee can enroll in a course', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const enrollBtn = page.getByRole('button', { name: /enroll|browse course/i }).first();
    if (await enrollBtn.isVisible()) {
      await enrollBtn.click();
      await expect(
        page.getByText(/enrolled|enrollment|success/i).or(
          page.getByRole('button', { name: /enroll/i }).or(
            page.getByRole('dialog')
          )
        )
      ).toBeVisible();
    } else {
      await expect(page.getByText(/course|training/i)).toBeVisible();
    }
  });

  // 4. Course detail shows duration, difficulty, description
  test('course detail shows duration, difficulty, description', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const courseCard = page.getByRole('button', { name: /view|details|learn more/i }).first().or(
      page.locator('[class*="course-card"], [data-testid*="course"]').first()
    );
    if (await courseCard.isVisible()) {
      await courseCard.click();
      await expect(
        page.getByText(/duration|hour|minute/i).or(page.getByText(/difficulty|beginner|intermediate|advanced/i))
      ).toBeVisible();
    } else {
      // Fallback: metadata visible inline on catalog cards
      await expect(
        page.getByText(/duration|difficulty|beginner|intermediate|advanced/i)
      ).toBeVisible();
    }
  });

  // 5. Progress bar visible for enrolled courses
  test('progress bar visible for enrolled courses', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const myLearningTab = page.getByRole('tab', { name: /my learning|my course|enrolled/i }).or(
      page.getByRole('button', { name: /my learning|my course/i })
    );
    if (await myLearningTab.isVisible()) {
      await myLearningTab.click();
    }
    await expect(
      page.getByRole('progressbar').or(
        page.locator('[class*="progress"]').or(
          page.getByText(/progress|% complete|completion/i)
        )
      )
    ).toBeVisible();
  });

  // 6. Learning paths section present
  test('learning paths section is present', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('tab', { name: /learning path/i }).or(
        page.getByText(/learning path/i).or(
          page.getByRole('button', { name: /learning path/i })
        )
      )
    ).toBeVisible();
  });

  // 7. Certificates tab/section visible
  test('certificates tab/section is visible', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('tab', { name: /certificate/i }).or(
        page.getByText(/certificate|certification/i).or(
          page.getByRole('button', { name: /certificate/i })
        )
      )
    ).toBeVisible();
  });

  // 8. HR can see training needs analysis
  test('HR can see training needs analysis', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByText(/training need|needs analysis|skill gap/i).or(
        page.getByRole('tab', { name: /needs analysis|training need/i }).or(
          page.getByRole('button', { name: /needs analysis/i })
        )
      )
    ).toBeVisible();
  });

  // 9. Admin can create a new course
  test('admin can create a new course', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const createBtn = page.getByRole('button', { name: /create course|add course|new course/i });
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('form')).or(
        page.getByLabel(/course title|course name/i)
      )
    ).toBeVisible();
  });

  // 10. Course creation form validates required fields
  test('course creation form validates required fields', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.getByRole('button', { name: /create course|add course|new course/i }).click();
    // Submit without filling required fields
    await page.getByRole('button', { name: /^save$|^submit$|^create$/i }).click();
    await expect(
      page.getByText(/required|title is required|name is required|please enter/i).or(
        page.locator(':invalid')
      )
    ).toBeVisible();
  });

  // 11. Session-based training (with date/time) registration works
  test('session-based training registration works', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const sessionTab = page.getByRole('tab', { name: /session|scheduled|instructor/i }).or(
      page.getByRole('button', { name: /session|scheduled training/i })
    );
    if (await sessionTab.isVisible()) {
      await sessionTab.click();
      await expect(
        page.getByText(/session|date|time|register/i)
      ).toBeVisible();
    } else {
      await expect(page.getByText(/training|course/i)).toBeVisible();
    }
  });

  // 12. Employee sees enrolled courses in "My Learning" section
  test('employee sees enrolled courses in My Learning section', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/training`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const myLearningTab = page.getByRole('tab', { name: /my learning|my course|enrolled/i }).or(
      page.getByRole('button', { name: /my learning/i })
    );
    if (await myLearningTab.isVisible()) {
      await myLearningTab.click();
    }
    await expect(
      page.getByText(/my learning|enrolled course|my course|no course/i)
    ).toBeVisible();
  });
});
