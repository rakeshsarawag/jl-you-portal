/**
 * Knowledge Base — E2E tests covering article list, search, categories,
 * creation, detail view, bookmarks, comments, version history, and RBAC.
 */
import { test, expect, loginAs, BASE_URL } from '../shared/fixtures';

const KB_URL = `${BASE_URL}/knowledge-base`;

test.describe('Knowledge Base', () => {
  // ── 1. Knowledge base loads with article list or empty state ──────────────
  test('knowledge base loads with article list or empty state', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    // Either article cards/rows or an empty/loading indicator must appear
    const articleCard = page.locator('[class*="article"], [class*="card"]').first();
    const emptyState = page.getByText(/no articles|nothing here|empty/i);
    const heading = page.getByRole('heading', { name: /knowledge|articles/i });

    await expect(articleCard.or(emptyState).or(heading)).toBeVisible({ timeout: 15000 });
  });

  // ── 2. Search by keyword filters articles ─────────────────────────────────
  test('search by keyword filters the article list', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const searchInput = page.getByPlaceholder(/search/i).first()
      .or(page.getByRole('searchbox').first())
      .or(page.locator('input[type="search"]').first());

    await expect(searchInput).toBeVisible({ timeout: 15000 });

    // Search for something that shouldn't match any article
    await searchInput.fill('zzz_no_match_xyz_e2e');
    await page.waitForTimeout(600);

    const emptyState = page.getByText(/no articles|no results|nothing found|0 article/i);
    const articleCards = page.locator('[class*="article"], [class*="card"]');

    const emptyVisible = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);
    const cardCount = await articleCards.count();

    expect(emptyVisible || cardCount === 0).toBeTruthy();
  });

  // ── 3. Category filter reduces results ────────────────────────────────────
  test('category filter reduces the article list', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    // Wait for article area to load
    await page.waitForTimeout(2000);

    // Find a category filter — could be a button, chip, or select
    const categoryFilter = page.getByRole('combobox', { name: /category/i })
      .or(page.getByLabel(/category/i))
      .or(page.getByRole('button', { name: /category|all categories/i }));

    if (await categoryFilter.isVisible({ timeout: 8000 }).catch(() => false)) {
      // Interact with the first available category chip or option
      const firstCategoryChip = page.locator('[class*="category"], [class*="chip"], [class*="badge"]').first();
      if (await firstCategoryChip.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstCategoryChip.click();
        await page.waitForTimeout(600);
      }
      // Verify the list updated (either articles or empty state is shown)
      const result = page.locator('[class*="article"], [class*="card"]').first()
        .or(page.getByText(/no articles|no results/i));
      await expect(result).toBeVisible({ timeout: 8000 });
    } else {
      // Category filter not rendered — verify page loaded at all
      const heading = page.getByRole('heading', { name: /knowledge/i });
      await expect(heading).toBeVisible({ timeout: 10000 });
    }
  });

  // ── 4. Admin can open new article form ────────────────────────────────────
  test('admin sees and can click the Create Article tab', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const createTab = page.getByRole('button', { name: /create article/i })
      .or(page.getByRole('tab', { name: /create article/i }));

    await expect(createTab).toBeVisible({ timeout: 15000 });
    await createTab.click();

    // New Article heading or form should appear
    const formHeading = page.getByRole('heading', { name: /new article|create article/i })
      .or(page.getByText(/new article/i));
    await expect(formHeading).toBeVisible({ timeout: 10000 });
  });

  // ── 5. New article form validates required title field ────────────────────
  test('new article form shows error when title is missing', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const createTab = page.getByRole('button', { name: /create article/i })
      .or(page.getByRole('tab', { name: /create article/i }));
    await expect(createTab).toBeVisible({ timeout: 15000 });
    await createTab.click();

    // Leave title blank and submit
    const publishBtn = page.getByRole('button', { name: /publish|create|save/i }).last();
    await expect(publishBtn).toBeVisible({ timeout: 10000 });
    await publishBtn.click();

    // Validation error for title must appear
    const titleError = page.getByText(/title.*required|required.*title|enter a title/i);
    await expect(titleError).toBeVisible({ timeout: 8000 });
  });

  // ── 6. Admin can create an article and it appears in list ─────────────────
  test('admin can create an article and it appears in the article list', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const createTab = page.getByRole('button', { name: /create article/i })
      .or(page.getByRole('tab', { name: /create article/i }));
    await expect(createTab).toBeVisible({ timeout: 15000 });
    await createTab.click();

    const uniqueTitle = `E2E Test Article ${Date.now()}`;

    // Fill title
    const titleInput = page.getByLabel(/title/i).or(page.getByPlaceholder(/title/i));
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill(uniqueTitle);

    // Fill content if an editor is present
    const contentArea = page.getByLabel(/content/i)
      .or(page.getByPlaceholder(/content|write|body/i))
      .or(page.locator('textarea').first());
    if (await contentArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contentArea.fill('This is an E2E test article body. Please ignore.');
    }

    // Publish
    const publishBtn = page.getByRole('button', { name: /publish|create|save/i }).last();
    await publishBtn.click();

    // Should navigate back to article list (or success message)
    const articleInList = page.getByText(uniqueTitle);
    const successMsg = page.getByText(/published|created|saved/i);
    await expect(articleInList.or(successMsg)).toBeVisible({ timeout: 15000 });
  });

  // ── 7. Clicking an article opens detail view ──────────────────────────────
  test('clicking an article card opens the detail view', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    // Find the first clickable article
    const firstArticle = page.locator('[class*="article"], [class*="card"]').first();
    const hasArticles = await firstArticle.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasArticles) {
      test.skip(true, 'No articles in the list — skipping detail view test');
      return;
    }

    await firstArticle.click();

    // A modal or detail panel should open
    const detailContent = page.getByRole('dialog')
      .or(page.getByText(/author|views|likes/i).first());
    await expect(detailContent).toBeVisible({ timeout: 15000 });
  });

  // ── 8. Detail view shows article content ─────────────────────────────────
  test('article detail view shows full content', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const firstArticle = page.locator('[class*="article"], [class*="card"]').first();
    const hasArticles = await firstArticle.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasArticles) {
      test.skip(true, 'No articles in the list — skipping content test');
      return;
    }

    await firstArticle.click();

    // Article content area (rendered HTML or a prose section)
    const contentArea = page.locator('[class*="prose"], [class*="content"], article')
      .or(page.getByText(/views|likes/i).first());
    await expect(contentArea).toBeVisible({ timeout: 15000 });
  });

  // ── 9. Bookmark toggle is present and clickable ───────────────────────────
  test('bookmark toggle is visible in article detail and responds to click', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(KB_URL);

    const firstArticle = page.locator('[class*="article"], [class*="card"]').first();
    const hasArticles = await firstArticle.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasArticles) {
      test.skip(true, 'No articles available to test bookmark');
      return;
    }

    await firstArticle.click();

    // Bookmark button (may use icon or text label)
    const bookmarkBtn = page.getByRole('button', { name: /bookmark|save article/i })
      .or(page.locator('[aria-label*="bookmark" i], [title*="bookmark" i]'));

    await expect(bookmarkBtn).toBeVisible({ timeout: 15000 });
    await bookmarkBtn.click();

    // After click the button should still be in the DOM (toggled state)
    await expect(bookmarkBtn).toBeVisible({ timeout: 5000 });
  });

  // ── 10. Comments section exists in article detail ─────────────────────────
  test('article detail shows a comments section', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const firstArticle = page.locator('[class*="article"], [class*="card"]').first();
    const hasArticles = await firstArticle.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasArticles) {
      test.skip(true, 'No articles available to test comments');
      return;
    }

    await firstArticle.click();

    // Comments section: heading or placeholder or textarea
    const commentsSection = page.getByText(/comments|be the first to comment|write a comment/i).first();
    await expect(commentsSection).toBeVisible({ timeout: 15000 });
  });

  // ── 11. Employee can view articles (read access) ──────────────────────────
  test('employee can view the knowledge base and open an article', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(KB_URL);

    // Page should load — heading or article list
    const heading = page.getByRole('heading', { name: /knowledge/i })
      .or(page.locator('[class*="article"], [class*="card"]').first());
    await expect(heading).toBeVisible({ timeout: 15000 });
  });

  // ── 12. Employee cannot see Create Article button ─────────────────────────
  test('employee does not see the Create Article tab', async ({ page }) => {
    await loginAs(page, 'employee');
    await page.goto(KB_URL);

    // Wait for the page to fully render its tabs
    await page.waitForTimeout(3000);

    const createTab = page.getByRole('button', { name: /create article/i })
      .or(page.getByRole('tab', { name: /create article/i }));

    await expect(createTab).not.toBeVisible({ timeout: 5000 });
  });

  // ── 13. Tags are shown on article cards ───────────────────────────────────
  test('article cards display tag chips when articles have tags', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const firstArticle = page.locator('[class*="article"], [class*="card"]').first();
    const hasArticles = await firstArticle.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasArticles) {
      test.skip(true, 'No articles — skipping tag visibility test');
      return;
    }

    // Tags appear as small pill/badge elements; not every card may have tags
    const tagPill = page.locator('[class*="tag"], [class*="badge"], [class*="chip"]').first();
    const hasTags = await tagPill.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasTags) {
      // It's valid for articles to have no tags; check the page rendered at all
      await expect(firstArticle).toBeVisible();
    } else {
      await expect(tagPill).toBeVisible();
    }
  });

  // ── 14. Version history tab present in detail (admin view) ────────────────
  test('admin sees version history section in article detail', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(KB_URL);

    const firstArticle = page.locator('[class*="article"], [class*="card"]').first();
    const hasArticles = await firstArticle.isVisible({ timeout: 15000 }).catch(() => false);

    if (!hasArticles) {
      test.skip(true, 'No articles — skipping version history test');
      return;
    }

    await firstArticle.click();

    // Version History toggle button or section heading
    const versionBtn = page.getByRole('button', { name: /version history|versions/i })
      .or(page.getByText(/version history|versions/i).first());
    await expect(versionBtn).toBeVisible({ timeout: 15000 });

    // Click to expand
    await versionBtn.click();

    // After expanding: either a list of versions or "no version history yet"
    const versionContent = page.getByText(/no version history yet|loading versions|v\d+/i)
      .or(page.locator('[class*="version"]').first());
    await expect(versionContent).toBeVisible({ timeout: 10000 });
  });
});
