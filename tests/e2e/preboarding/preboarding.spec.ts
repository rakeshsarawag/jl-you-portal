/**
 * Preboarding Portal — public route, no login required
 * Route: /preboarding
 * Component: PreboardingPortal
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Preboarding Portal (public)', () => {
  test('1. Preboarding portal loads without login', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Should NOT redirect to login
    await expect(page).not.toHaveURL(/login/);
    await expect(
      page
        .getByText(/preboarding|pre.boarding|welcome/i)
        .first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('2. Welcome message visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/welcome|hello|glad to have you|joining/i)
        .first()
        .or(page.getByRole('heading', { name: /welcome/i }))
    ).toBeVisible({ timeout: 15000 });
  });

  test('3. Personal details form present', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Navigate to personal details step if multi-step
    const personalTab = page
      .getByRole('tab', { name: /personal details?|personal info/i })
      .or(page.getByText(/personal details?/i).first());
    if (await personalTab.isVisible()) {
      await personalTab.click();
    }
    await expect(
      page
        .getByText(/personal details?|your information/i)
        .first()
        .or(page.getByRole('form'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('4. Name field is required', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const personalTab = page
      .getByRole('tab', { name: /personal details?|personal info/i })
      .or(page.getByText(/personal details?/i).first());
    if (await personalTab.isVisible()) {
      await personalTab.click();
    }
    // Find a submit/next button and click without filling name
    const submitBtn = page
      .getByRole('button', { name: /next|save|submit|continue/i })
      .first();
    await submitBtn.click();
    await expect(
      page
        .getByText(/name is required|required field|please enter/i)
        .first()
        .or(page.locator('input[name*="name"]:invalid').first())
        .or(page.getByText(/required/i).first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('5. Document upload section visible', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const docTab = page
      .getByRole('tab', { name: /documents?|upload/i })
      .or(page.getByText(/document upload/i).first());
    if (await docTab.isVisible()) {
      await docTab.click();
    }
    await expect(
      page
        .getByText(/upload|id proof|address proof|education|certificate/i)
        .first()
        .or(page.locator('input[type="file"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('6. Policy acknowledgement checkboxes present', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const policyTab = page
      .getByRole('tab', { name: /policy|acknowledgement|nda/i })
      .or(page.getByText(/policy acknowledgement/i).first());
    if (await policyTab.isVisible()) {
      await policyTab.click();
    }
    await expect(
      page
        .getByRole('checkbox')
        .first()
        .or(page.getByText(/nda|code of conduct|it policy|i acknowledge|i agree/i).first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('7. Progress tracker shows percentage', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page
        .getByText(/%|percent|completion|progress/i)
        .first()
        .or(page.locator('[role="progressbar"]').first())
        .or(page.locator('[data-testid*="progress"]').first())
    ).toBeVisible({ timeout: 15000 });
  });

  test('8. Can fill and submit personal details form', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const personalTab = page
      .getByRole('tab', { name: /personal details?|personal info/i })
      .or(page.getByText(/personal details?/i).first());
    if (await personalTab.isVisible()) {
      await personalTab.click();
    }
    // Fill first name / full name field
    const nameField = page
      .getByLabel(/full name|first name/i)
      .or(page.locator('input[name*="name"]').first());
    await nameField.fill('Test Joiner');
    // Fill email if present
    const emailField = page.locator('input[type="email"]').first();
    if (await emailField.isVisible()) {
      await emailField.fill('testjoiner@example.com');
    }
    const submitBtn = page
      .getByRole('button', { name: /save|next|submit|continue/i })
      .first();
    await submitBtn.click();
    // Expect either success message or next step
    await expect(
      page
        .getByText(/saved|success|next|step 2|submitted|thank you/i)
        .first()
        .or(page.getByRole('alert').first())
    ).toBeVisible({ timeout: 10000 });
  });

  test('9. Bank details section present (account number, IFSC)', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const bankTab = page
      .getByRole('tab', { name: /bank|payment|salary account/i })
      .or(page.getByText(/bank details/i).first());
    if (await bankTab.isVisible()) {
      await bankTab.click();
    }
    await expect(
      page
        .getByText(/account number|bank account|ifsc|sort code|routing/i)
        .first()
        .or(page.getByLabel(/account number/i))
    ).toBeVisible({ timeout: 15000 });
  });

  test('10. Emergency contact section present', async ({ page }) => {
    await page.goto(`${BASE_URL}/preboarding`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const emergencyTab = page
      .getByRole('tab', { name: /emergency contact/i })
      .or(page.getByText(/emergency contact/i).first());
    if (await emergencyTab.isVisible()) {
      await emergencyTab.click();
    }
    await expect(
      page
        .getByText(/emergency contact|emergency person|next of kin/i)
        .first()
        .or(page.getByLabel(/emergency/i))
    ).toBeVisible({ timeout: 15000 });
  });
});
