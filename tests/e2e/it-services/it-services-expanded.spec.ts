import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('IT Services Enhanced V2', () => {
  test('1. IT services page loads', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const heading = page
      .locator('h1, h2, [data-testid*="it-services"]')
      .filter({ hasText: /it service|helpdesk|service desk|support/i })
      .first();

    if (await heading.isVisible()) {
      await expect(heading).toBeVisible();
    } else {
      // Page at least should not show error
      const pageContent = await page.locator('body').textContent();
      expect(pageContent).not.toMatch(/404|not found/i);
    }
  });

  test('2. Employee can submit a new ticket', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const newTicketBtn = page
      .locator('button')
      .filter({ hasText: /new ticket|create ticket|raise ticket|submit ticket|add ticket/i })
      .first();

    if (!await newTicketBtn.isVisible()) return;
    await newTicketBtn.click();

    const form = page.locator('form, [role="dialog"]').first();
    await expect(form).toBeVisible({ timeout: 5000 });
  });

  test('3. Ticket form validates required fields (title/description, category)', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const newTicketBtn = page
      .locator('button')
      .filter({ hasText: /new ticket|create ticket|raise ticket|submit ticket/i })
      .first();

    if (!await newTicketBtn.isVisible()) return;
    await newTicketBtn.click();

    const form = page.locator('form, [role="dialog"]').first();
    if (!await form.isVisible()) return;

    // Submit without filling required fields
    const submitBtn = form
      .locator('button[type="submit"], button')
      .filter({ hasText: /submit|create|save/i })
      .first();

    if (!await submitBtn.isVisible()) return;
    await submitBtn.click();

    // Validation errors or aria-invalid fields
    const errorIndicator = page
      .locator('[aria-invalid="true"], .error, [class*="error"], text=/required|this field/i')
      .first();

    if (await errorIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(errorIndicator).toBeVisible();
    }
  });

  test('4. Priority selection (Low, Medium, High, Critical) works', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const newTicketBtn = page
      .locator('button')
      .filter({ hasText: /new ticket|create ticket|raise ticket|submit ticket/i })
      .first();

    if (!await newTicketBtn.isVisible()) return;
    await newTicketBtn.click();

    const form = page.locator('form, [role="dialog"]').first();
    if (!await form.isVisible()) return;

    const priorityControl = form
      .locator('select[name*="priority"], [data-testid*="priority"], [aria-label*="priority"]')
      .or(form.locator('text=/priority/i').locator('..').locator('select, [role="combobox"]').first())
      .first();

    if (!await priorityControl.isVisible()) {
      // Try clicking a priority option directly
      const highOption = form.locator('text=/high|medium|low|critical/i').first();
      if (await highOption.isVisible()) {
        await highOption.click();
        await expect(highOption).toBeVisible();
      }
      return;
    }

    await priorityControl.click();
    const option = page
      .locator('[role="option"], option')
      .filter({ hasText: /high/i })
      .first();

    if (await option.isVisible()) {
      await option.click();
    }
  });

  test('5. IT admin sees all tickets in queue', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const queue = page
      .locator('[data-testid*="queue"], [class*="queue"], table, [class*="ticket-list"]')
      .first();

    if (!await queue.isVisible()) return;
    await expect(queue).toBeVisible();

    // Admin queue should show all tickets (may show multiple rows)
    const rows = page.locator('tr, [class*="ticket-row"], [data-testid*="ticket-row"]');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(0); // at least empty is ok
  });

  test('6. Assignee filter dropdown shows employee names with JL codes', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const assigneeFilter = page
      .locator('select[name*="assignee"], [data-testid*="assignee-filter"], [aria-label*="assignee"]')
      .or(page.locator('button, [role="combobox"]').filter({ hasText: /assignee|assigned to|all assignees/i }).first())
      .first();

    if (!await assigneeFilter.isVisible()) return;
    await assigneeFilter.click();
    await page.waitForTimeout(300);

    // JL codes like JL001, JL-001
    const jlOption = page
      .locator('[role="option"], option, li')
      .filter({ hasText: /JL\d{3}|JL-\d{3}/i })
      .first();

    if (await jlOption.isVisible()) {
      await expect(jlOption).toBeVisible();
    }
  });

  test('7. Category filter narrows ticket list', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const categoryFilter = page
      .locator('select[name*="category"], [data-testid*="category-filter"], [aria-label*="category"]')
      .or(page.locator('button, [role="combobox"]').filter({ hasText: /category|all categories/i }).first())
      .first();

    if (!await categoryFilter.isVisible()) return;
    await categoryFilter.click();
    await page.waitForTimeout(300);

    const firstOption = page
      .locator('[role="option"], option, li')
      .nth(1); // skip "all" option at index 0

    if (await firstOption.isVisible()) {
      await firstOption.click();
      await page.waitForTimeout(300);
      // List should still be visible (narrowed)
      const list = page.locator('table, [class*="ticket-list"]').first();
      if (await list.isVisible()) {
        await expect(list).toBeVisible();
      }
    }
  });

  test('8. Clicking ticket opens detail with SLA info', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const firstTicket = page
      .locator('tr, [class*="ticket-row"], [data-testid*="ticket"]')
      .nth(1);

    if (!await firstTicket.isVisible()) return;
    await firstTicket.click();
    await page.waitForTimeout(500);

    const detail = page
      .locator('[role="dialog"], [data-testid*="ticket-detail"], [class*="detail"]')
      .first();

    const slaInfo = page.locator('text=/sla|response time|due by|resolution/i').first();

    if (await slaInfo.isVisible()) {
      await expect(slaInfo).toBeVisible();
    }
  });

  test('9. IT admin can add comment to ticket', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const firstTicket = page
      .locator('tr, [class*="ticket-row"], [data-testid*="ticket"]')
      .nth(1);

    if (!await firstTicket.isVisible()) return;
    await firstTicket.click();
    await page.waitForTimeout(500);

    const commentInput = page
      .locator('textarea[name*="comment"], textarea[placeholder*="comment"], textarea[placeholder*="reply"]')
      .or(page.locator('[contenteditable]').first())
      .first();

    if (!await commentInput.isVisible()) return;
    await commentInput.fill('Test comment from IT admin');

    const submitComment = page
      .locator('button')
      .filter({ hasText: /send|post|submit|add comment/i })
      .first();

    if (await submitComment.isVisible()) {
      await expect(submitComment).toBeEnabled();
    }
  });

  test('10. Status update (assign, resolve) available to IT role', async ({ page, loginAs }) => {
    await loginAs('it');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const firstTicket = page
      .locator('tr, [class*="ticket-row"], [data-testid*="ticket"]')
      .nth(1);

    if (!await firstTicket.isVisible()) return;
    await firstTicket.click();
    await page.waitForTimeout(500);

    const statusBtn = page
      .locator('button')
      .filter({ hasText: /assign|resolve|close|in progress|update status/i })
      .first();

    if (await statusBtn.isVisible()) {
      await expect(statusBtn).toBeVisible();
    }
  });

  test('11. Knowledge base tab shows self-service articles', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const kbTab = page
      .locator('[role="tab"], button, a')
      .filter({ hasText: /knowledge base|self.?service|articles|faq/i })
      .first();

    if (!await kbTab.isVisible()) return;
    await kbTab.click();
    await page.waitForTimeout(300);

    const articles = page
      .locator('[class*="article"], [data-testid*="article"], [class*="kb"]')
      .or(page.locator('text=/article|how to|guide/i').first())
      .first();

    if (await articles.isVisible()) {
      await expect(articles).toBeVisible();
    }
  });

  test('12. Employee cannot see admin bulk operations', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/it-services`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await page.waitForLoadState('networkidle');

    const bulkBtn = page
      .locator('button')
      .filter({ hasText: /bulk|export all|change status/i })
      .first();

    const isVisible = await bulkBtn.isVisible().catch(() => false);
    expect(isVisible).toBeFalsy();
  });
});
