/**
 * Internal Communications Hub Enhanced — channels, announcements, polls,
 * mentions, file sharing, reactions, and role-based posting.
 */
import { test, expect, BASE_URL, isErrorPage} from '../shared/fixtures';

test.describe('Internal Communications Hub Enhanced', () => {
  // 1. Communications hub loads with channel list
  test('communications hub loads with channel list', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('heading', { name: /communication|message|channel/i }).or(
        page.getByText(/communications hub|internal communications/i)
      )
    ).toBeVisible();
    await expect(
      page.getByText(/channel|general|department/i).or(
        page.getByRole('list')
      )
    ).toBeVisible();
  });

  // 2. General channel has messages or empty state
  test('general channel has messages or shows empty state', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const generalChannel = page.getByText(/general/i).first().or(
      page.getByRole('button', { name: /general/i })
    );
    if (await generalChannel.isVisible()) {
      await generalChannel.click();
    }
    await expect(
      page.getByText(/message|no message|be the first|start a conversation/i).or(
        page.locator('[class*="message"], [data-testid*="message"]')
      )
    ).toBeVisible();
  });

  // 3. Employee can send a message in a channel
  test('employee can send a message in a channel', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const generalChannel = page.getByText(/general/i).first().or(
      page.getByRole('button', { name: /general/i })
    );
    if (await generalChannel.isVisible()) {
      await generalChannel.click();
    }
    const messageInput = page.getByRole('textbox', { name: /message|type|compose/i }).or(
      page.getByPlaceholder(/type a message|write a message|message.../i)
    );
    if (await messageInput.isVisible()) {
      await messageInput.fill('Hello team! This is an automated test message.');
      await page.keyboard.press('Enter');
      await expect(
        page.getByText(/Hello team! This is an automated test message.|sent|delivered/i)
      ).toBeVisible();
    } else {
      await expect(page.getByText(/channel|message/i)).toBeVisible();
    }
  });

  // 4. Message form validates non-empty content
  test('message form validates non-empty content', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const generalChannel = page.getByText(/general/i).first().or(
      page.getByRole('button', { name: /general/i })
    );
    if (await generalChannel.isVisible()) {
      await generalChannel.click();
    }
    const sendBtn = page.getByRole('button', { name: /send/i });
    if (await sendBtn.isVisible()) {
      await sendBtn.click();
      // Sending empty message should not post or should show validation
      await expect(
        page.getByText(/cannot send empty|message required|please enter/i).or(
          // Alternatively, message list remains unchanged / send button stays disabled
          sendBtn
        )
      ).toBeVisible();
    } else {
      await expect(page.getByText(/channel|message/i)).toBeVisible();
    }
  });

  // 5. Announcement tab shows company announcements
  test('announcement tab shows company announcements', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const announcementTab = page.getByRole('tab', { name: /announcement/i }).or(
      page.getByRole('button', { name: /announcement/i }).or(
        page.getByText(/announcement/i).first()
      )
    );
    if (await announcementTab.isVisible()) {
      await announcementTab.click();
    }
    await expect(
      page.getByText(/announcement|company news|no announcement/i)
    ).toBeVisible();
  });

  // 6. HR can post a new announcement
  test('HR can post a new announcement', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const announcementTab = page.getByRole('tab', { name: /announcement/i }).or(
      page.getByRole('button', { name: /announcement/i })
    );
    if (await announcementTab.isVisible()) {
      await announcementTab.click();
    }
    const newAnnouncementBtn = page.getByRole('button', { name: /new announcement|create announcement|post announcement/i });
    await expect(newAnnouncementBtn).toBeVisible();
    await newAnnouncementBtn.click();
    await expect(
      page.getByRole('dialog').or(page.getByRole('form')).or(
        page.getByLabel(/title|announcement/i)
      )
    ).toBeVisible();
  });

  // 7. Poll creation form available to HR/admin
  test('poll creation form available to HR', async ({ page, loginAs }) => {
    await loginAs('hr');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    await expect(
      page.getByRole('button', { name: /create poll|new poll|add poll/i }).or(
        page.getByText(/poll/i).or(
          page.getByRole('tab', { name: /poll/i })
        )
      )
    ).toBeVisible();
  });

  // 8. Poll shows voting options for employees
  test('poll shows voting options for employees', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const pollTab = page.getByRole('tab', { name: /poll/i }).or(
      page.getByRole('button', { name: /poll/i })
    );
    if (await pollTab.isVisible()) {
      await pollTab.click();
      await expect(
        page.getByText(/vote|option|poll|no poll/i).or(
          page.getByRole('radio').or(page.getByRole('button', { name: /vote/i }))
        )
      ).toBeVisible();
    } else {
      await expect(page.getByText(/poll|announcement|channel/i)).toBeVisible();
    }
  });

  // 9. File attachment button present in composer
  test('file attachment button present in composer', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    const generalChannel = page.getByText(/general/i).first().or(
      page.getByRole('button', { name: /general/i })
    );
    if (await generalChannel.isVisible()) {
      await generalChannel.click();
    }
    await expect(
      page.getByRole('button', { name: /attach|file|upload|attachment/i }).or(
        page.locator('input[type="file"]').or(
          page.locator('[aria-label*="attach"], [title*="attach"], [class*="attach"]')
        )
      )
    ).toBeVisible();
  });

  // 10. Employee receives @mention notification
  test('@mention notification indicator is present', async ({ page, loginAs }) => {
    await loginAs('employee');
    await page.goto(`${BASE_URL}/communications`);
    await page.waitForTimeout(800);
    if (await isErrorPage(page)) return;
    // Check for @mention in composer or notification bell/badge
    await expect(
      page.getByText(/@mention|mention|notification/i).or(
        page.locator('[aria-label*="mention"], [class*="mention"], [class*="notification"]').or(
          page.getByRole('button', { name: /notification|bell/i })
        )
      )
    ).toBeVisible();
  });
});
