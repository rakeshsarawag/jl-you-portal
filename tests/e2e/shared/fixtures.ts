import { Page } from '@playwright/test';

export const TEST_USERS = {
  admin: { email: 'admin@jlyou.com', password: 'test1234', role: 'admin' },
  hr: { email: 'hr@jlyou.com', password: 'test1234', role: 'hr' },
  employee: { email: 'emp@jlyou.com', password: 'test1234', role: 'employee' },
  finance: { email: 'finance@jlyou.com', password: 'test1234', role: 'finance' },
  manager: { email: 'manager@jlyou.com', password: 'test1234', role: 'manager' },
};

export async function loginAs(page: Page, role: keyof typeof TEST_USERS) {
  const user = TEST_USERS[role];
  await page.goto('/login');
  await page.fill('[name=email]', user.email);
  await page.fill('[name=password]', user.password);
  await page.click('[type=submit]');
  await page.waitForURL(/dashboard|home|\//);
}
