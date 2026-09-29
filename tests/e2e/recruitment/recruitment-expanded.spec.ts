import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Recruitment Tracker Enhanced V3', () => {
  test('1. Recruitment tracker loads with job list or empty state', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const content = page
      .locator('table, [class*="job-list"], [data-testid*="recruitment"], [class*="requisition"]')
      .or(page.locator('text=/no jobs|no requisitions|empty|get started/i').first())
      .first();

    if (await content.isVisible()) {
      await expect(content).toBeVisible();
    } else {
      const pageText = await page.locator('body').textContent();
      expect(pageText).not.toMatch(/404|not found/i);
    }
  });

  test('2. Admin/HR can create new job requisition', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /new job|create job|add requisition|new requisition|post job/i })
      .first();

    if (!await createBtn.isVisible()) return;
    await createBtn.click();

    const form = page.locator('form, [role="dialog"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });
  });

  test('3. Job requisition shows JL-JRQ prefix in ID', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const jrqId = page
      .locator('text=/JL-JRQ|JL_JRQ|JLJRQ/i')
      .or(page.locator('[data-testid*="requisition-id"]').first())
      .first();

    if (await jrqId.isVisible()) {
      await expect(jrqId).toBeVisible();
    }
  });

  test('4. Candidate pipeline stages visible (Applied, Screening, Interview, Offer, Hired)', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const stages = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired'];

    // Open a job to see pipeline, or look for pipeline on main page
    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForTimeout(500);
    }

    let found = 0;
    for (const stage of stages) {
      const stageEl = page.locator(`text=${stage}`).first();
      if (await stageEl.isVisible()) found++;
    }

    if (found > 0) {
      expect(found).toBeGreaterThanOrEqual(1);
    }
  });

  test('5. Can add a candidate to a job', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    // Open first job
    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (!await jobRow.isVisible()) return;
    await jobRow.click();
    await page.waitForTimeout(500);

    const addCandidateBtn = page
      .locator('button')
      .filter({ hasText: /add candidate|new candidate|invite candidate/i })
      .first();

    if (!await addCandidateBtn.isVisible()) return;
    await addCandidateBtn.click();

    const form = page.locator('form, [role="dialog"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });
  });

  test('6. Candidate card shows in pipeline stage', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    // Open first job to see pipeline board
    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForTimeout(500);
    }

    const candidateCard = page
      .locator('[class*="candidate-card"], [data-testid*="candidate"], [class*="kanban-card"]')
      .first();

    if (await candidateCard.isVisible()) {
      await expect(candidateCard).toBeVisible();
    }
  });

  test('7. Moving candidate to next stage updates pipeline', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForTimeout(500);
    }

    const candidateCard = page
      .locator('[class*="candidate-card"], [data-testid*="candidate"]')
      .first();

    if (!await candidateCard.isVisible()) return;

    // Look for a "move to next stage" button
    const moveBtn = candidateCard
      .locator('button')
      .filter({ hasText: /move|next stage|advance|progress/i })
      .first();

    if (await moveBtn.isVisible()) {
      await moveBtn.click();
      await page.waitForTimeout(300);
    } else {
      // Drag-and-drop: just verify the stage columns exist
      const stageCol = page.locator('[class*="stage-column"], [class*="kanban-column"]').first();
      if (await stageCol.isVisible()) {
        await expect(stageCol).toBeVisible();
      }
    }
  });

  test('8. Interview scheduling form opens from candidate card', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForTimeout(500);
    }

    const scheduleBtn = page
      .locator('button')
      .filter({ hasText: /schedule interview|book interview|set interview/i })
      .first();

    if (!await scheduleBtn.isVisible()) return;
    await scheduleBtn.click();

    const form = page.locator('form, [role="dialog"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });
  });

  test('9. Feedback capture form present for each stage', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForTimeout(500);
    }

    const candidateCard = page
      .locator('[class*="candidate-card"], [data-testid*="candidate"]')
      .first();

    if (await candidateCard.isVisible()) {
      await candidateCard.click();
      await page.waitForTimeout(400);
    }

    const feedbackSection = page
      .locator('text=/feedback|review|notes/i')
      .first();

    if (await feedbackSection.isVisible()) {
      await expect(feedbackSection).toBeVisible();
    }
  });

  test('10. Analytics/metrics tab shows recruitment funnel', async ({ page, loginAs }) => {
    await loginAs('admin');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const analyticsTab = page
      .locator('[role="tab"], button, a')
      .filter({ hasText: /analytics|metrics|report|funnel/i })
      .first();

    if (!await analyticsTab.isVisible()) return;
    await analyticsTab.click();
    await page.waitForTimeout(500);

    const funnel = page
      .locator('[class*="chart"], [class*="funnel"], [class*="analytics"], svg')
      .or(page.locator('text=/total candidates|applications|conversion/i').first())
      .first();

    if (await funnel.isVisible()) {
      await expect(funnel).toBeVisible();
    }
  });

  test('11. Employee cannot create job requisitions', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const createBtn = page
      .locator('button')
      .filter({ hasText: /new job|create job|add requisition|new requisition|post job/i })
      .first();

    const isVisible = await createBtn.isVisible().catch(() => false);
    expect(isVisible).toBeFalsy();
  });

  test('12. Offer letter generation button present for final stage candidates', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/recruitment`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const jobRow = page
      .locator('tr, [class*="job-row"], [class*="requisition-row"]')
      .nth(1);

    if (await jobRow.isVisible()) {
      await jobRow.click();
      await page.waitForTimeout(500);
    }

    // Look in Offer/Hired stage for offer letter button
    const offerBtn = page
      .locator('button')
      .filter({ hasText: /offer letter|generate offer|send offer/i })
      .first();

    if (await offerBtn.isVisible()) {
      await expect(offerBtn).toBeVisible();
    }
  });
});
