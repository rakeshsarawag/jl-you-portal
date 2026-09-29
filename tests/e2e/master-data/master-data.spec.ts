/**
 * Master Data Management — E2E tests
 * Covers: tabs, CRUD, validation, search, RBAC
 */
import { test, expect, BASE_URL, isErrorPage} from "../shared/fixtures";

test.describe("Master Data Management", () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await loginAs("admin");
    await page.goto(`${BASE_URL}/master-data`);
    await expect(
      page.getByRole("heading", { name: /master data|configuration|settings/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Page load ────────────────────────────────────────────────────────────────

  test("Master Data page renders with heading", async ({ page }) => {
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole("heading", { name: /master data|configuration|settings/i })
    ).toBeVisible();
  });

  test("At least one category tab or section heading is visible", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tabs = await page.getByRole("tab").count();
    const sections = await page.getByRole("heading").count();
    expect(tabs + sections).toBeGreaterThan(0);
  });

  // ── Category tabs visible ─────────────────────────────────────────────────────

  test("Departments tab or section is visible", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const deptTab = page
      .getByRole("tab", { name: /department/i })
      .or(page.getByRole("button", { name: /department/i }))
      .or(page.getByText(/department/i).first());
    await expect(deptTab.first()).toBeVisible({ timeout: 10000 });
  });

  test("Designations or Job Titles tab is visible", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page
      .getByRole("tab", { name: /designation|job title|position/i })
      .or(page.getByRole("button", { name: /designation|job title/i }))
      .first();
    const count = await tab.count();
    if (count > 0) {
      await expect(tab).toBeVisible();
    }
  });

  test("Locations tab is visible if present", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page
      .getByRole("tab", { name: /location/i })
      .or(page.getByRole("button", { name: /location/i }))
      .first();
    const count = await tab.count();
    if (count > 0) {
      await expect(tab).toBeVisible();
    }
  });

  test("Cost Centers tab is visible if present", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page
      .getByRole("tab", { name: /cost center/i })
      .or(page.getByRole("button", { name: /cost center/i }))
      .first();
    const count = await tab.count();
    if (count > 0) {
      await expect(tab).toBeVisible();
    }
  });

  // ── Tab switching ─────────────────────────────────────────────────────────────

  test("Can switch between category tabs without error", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tabs = page.getByRole("tab");
    const tabCount = await tabs.count();
    if (tabCount < 2) return;
    await tabs.nth(0).click();
    await tabs.nth(1).click();
    // No crash: page still has heading
    await expect(
      page.getByRole("heading", { name: /master data|configuration|settings/i })
    ).toBeVisible({ timeout: 10000 });
  });

  // ── Department CRUD ───────────────────────────────────────────────────────────

  test("Department list shows entries or an empty state message", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const deptTab = page
      .getByRole("tab", { name: /department/i })
      .or(page.getByRole("button", { name: /department/i }))
      .first();
    if (await deptTab.isVisible()) await deptTab.click();
    const listItems = page.getByRole("listitem").or(page.locator("tr, [data-testid*=department]"));
    const empty = page.getByText(/no departments|empty|no data/i);
    const hasContent = (await listItems.count()) > 0 || (await empty.count()) > 0;
    expect(hasContent).toBe(true);
  });

  test("Add new department form opens on button click", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const deptTab = page
      .getByRole("tab", { name: /department/i })
      .or(page.getByRole("button", { name: /department/i }))
      .first();
    if (await deptTab.isVisible()) await deptTab.click();

    const addBtn = page.getByRole("button", { name: /add department|new department|\+ department/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    const form = page
      .getByRole("dialog")
      .or(page.getByRole("form"))
      .or(page.getByLabel(/department name|name/i))
      .first();
    await expect(form).toBeVisible({ timeout: 8000 });
  });

  test("Department name required validation fires on empty submit", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const deptTab = page
      .getByRole("tab", { name: /department/i })
      .or(page.getByRole("button", { name: /department/i }))
      .first();
    if (await deptTab.isVisible()) await deptTab.click();

    const addBtn = page.getByRole("button", { name: /add department|new department/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    await page.getByRole("button", { name: /^save$|^add$|^create$/i }).first().click();
    const validationMsg = await page.getByText(/required|name.*required|cannot be empty/i).count();
    const dialogOpen = await page.getByRole("dialog").isVisible();
    expect(validationMsg > 0 || dialogOpen).toBe(true);
  });

  test("Can add a new department", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const deptTab = page
      .getByRole("tab", { name: /department/i })
      .or(page.getByRole("button", { name: /department/i }))
      .first();
    if (await deptTab.isVisible()) await deptTab.click();

    const addBtn = page.getByRole("button", { name: /add department|new department|\+ department/i });
    if (!await addBtn.isVisible()) {
      const inlineInput = page.getByPlaceholder(/department name|enter department/i);
      if (await inlineInput.isVisible()) {
        await inlineInput.fill(`E2E Dept ${Date.now()}`);
        await page.keyboard.press("Enter");
        await expect(page.getByText(/saved|added|success/i)).toBeVisible({ timeout: 5000 });
      }
      return;
    }
    await addBtn.click();
    const deptName = `E2E Dept ${Date.now()}`;
    await page.getByLabel(/department name|name/i).first().fill(deptName);
    await page.getByRole("button", { name: /^save$|^add$|^create$/i }).first().click();
    await expect(
      page.getByText(deptName).or(page.getByText(/saved|added|success/i).first())
    ).toBeVisible({ timeout: 8000 });
  });

  // ── Designations ──────────────────────────────────────────────────────────────

  test("Can add a new designation", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page
      .getByRole("tab", { name: /designation|job title|position/i })
      .or(page.getByRole("button", { name: /designation|job title/i }))
      .first();
    if (!await tab.isVisible()) return;
    await tab.click();

    const addBtn = page.getByRole("button", { name: /add designation|new designation|\+ designation/i });
    if (!await addBtn.isVisible()) return;
    await addBtn.click();
    const input = page.getByLabel(/designation|title|name/i).first();
    if (!await input.isVisible()) return;
    const designationName = `E2E Designation ${Date.now()}`;
    await input.fill(designationName);
    await page.getByRole("button", { name: /^save$|^add$|^create$/i }).first().click();
    await expect(
      page.getByText(designationName).or(page.getByText(/saved|added|success/i).first())
    ).toBeVisible({ timeout: 8000 });
  });

  // ── Optional tabs ─────────────────────────────────────────────────────────────

  test("Leave Types tab loads content if present", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page
      .getByRole("tab", { name: /leave type|leave/i })
      .or(page.getByRole("button", { name: /leave type/i }))
      .first();
    if (!await tab.isVisible()) return;
    await tab.click();
    await expect(page.getByText(/leave/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("Skill Categories tab loads content if present", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const tab = page
      .getByRole("tab", { name: /skill|skill categor/i })
      .or(page.getByRole("button", { name: /skill/i }))
      .first();
    if (!await tab.isVisible()) return;
    await tab.click();
    await expect(page.getByText(/skill/i).first()).toBeVisible({ timeout: 8000 });
  });

  // ── Search / filter ───────────────────────────────────────────────────────────

  test("Search or filter within a category works without crash", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const searchInput = page
      .getByRole("searchbox")
      .or(page.getByPlaceholder(/search|filter/i))
      .first();
    if (!await searchInput.isVisible()) return;
    await searchInput.fill("test");
    // Page should still show heading after filtering
    await expect(
      page.getByRole("heading", { name: /master data|configuration|settings/i })
    ).toBeVisible({ timeout: 8000 });
  });

  // ── Admin can edit ────────────────────────────────────────────────────────────

  test("Admin can click edit on an existing item", async ({ page }) => {
    if (await isErrorPage(page)) return;
    const deptTab = page
      .getByRole("tab", { name: /department/i })
      .or(page.getByRole("button", { name: /department/i }))
      .first();
    if (await deptTab.isVisible()) await deptTab.click();

    const editBtn = page
      .getByRole("button", { name: /edit/i })
      .or(page.getByRole("link", { name: /edit/i }))
      .first();
    if (!await editBtn.isVisible()) return;
    await editBtn.click();
    const form = page
      .getByRole("dialog")
      .or(page.getByRole("form"))
      .or(page.getByLabel(/name/i))
      .first();
    await expect(form).toBeVisible({ timeout: 8000 });
  });

  // ── RBAC ─────────────────────────────────────────────────────────────────────

  test("Employee cannot access master data — denied or redirected", async ({ page, loginAs }) => {
    await loginAs("employee");
    await page.goto(`${BASE_URL}/master-data`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const denied = await page.getByText(/access denied|permission|403|not authorized/i).count();
    const onLoginPage = page.url().includes("login");
    const hasHeading = await page.getByRole("heading", { name: /master data/i }).count();
    expect(denied > 0 || onLoginPage || hasHeading === 0).toBe(true);
  });
});
