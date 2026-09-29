Error Context: test-results/workflow-workflow-dashboar-ce9ed-view-all-workflow-instances-chromium/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:122:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-ce9ed-view-all-workflow-instances-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-ce9ed-view-all-workflow-instances-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-ce9ed-view-all-workflow-instances-chromium-retry1/error-context.md

  327) [chromium] › tests/e2e/workflow/workflow-dashboard.spec.ts:142:3 › Workflow Dashboard › 6. HR can access workflow management 

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:143:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-9457b--access-workflow-management-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-9457b--access-workflow-management-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-9457b--access-workflow-management-chromium/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:143:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-9457b--access-workflow-management-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-9457b--access-workflow-management-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-9457b--access-workflow-management-chromium-retry1/error-context.md

  328) [chromium] › tests/e2e/workflow/workflow-dashboard.spec.ts:161:3 › Workflow Dashboard › 7. Employee sees only their own workflows 

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:162:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-6eb5f-es-only-their-own-workflows-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-6eb5f-es-only-their-own-workflows-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-6eb5f-es-only-their-own-workflows-chromium/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:162:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-6eb5f-es-only-their-own-workflows-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-6eb5f-es-only-their-own-workflows-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-6eb5f-es-only-their-own-workflows-chromium-retry1/error-context.md

  329) [chromium] › tests/e2e/workflow/workflow-dashboard.spec.ts:181:3 › Workflow Dashboard › 8. Clicking a workflow instance showsdetail/state 

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:182:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-38725-instance-shows-detail-state-chromium/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-38725-instance-shows-detail-state-chromium/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-38725-instance-shows-detail-state-chromium/error-context.md

    Retry #1 ───────────────────────────────────────────────────────────────────────────────────────

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"


       at shared/fixtures.ts:19

      17 | export async function loginAs(page: Page, role: Role) {
      18 |   const user = TEST_USERS[role];
    > 19 |   await page.goto(`${BASE_URL}/login`);
         |              ^
      20 |   await page.fill('[name=email]', user.email);
      21 |   await page.fill('[name=password]', user.password);
      22 |   await page.click('[type=submit]');
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:19:14)
        at loginAs (/Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/shared/fixtures.ts:29:25)
        at /Users/rakeshsarawag/Documents/JL Figma GitHub/JL You Portal from SAP/tests/e2e/workflow/workflow-dashboard.spec.ts:182:11

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-38725-instance-shows-detail-state-chromium-retry1/test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results/workflow-workflow-dashboar-38725-instance-shows-detail-state-chromium-retry1/video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results/workflow-workflow-dashboar-38725-instance-shows-detail-state-chromium-retry1/error-context.md

  330) [chromium] › tests/e2e/workflow/workflow-dashboard.spec.ts:213:3 › Workflow Dashboard › 9. Approve/reject actions present forapprovers 

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:8443/login
    Call log:
      - navigating to "http://localhost:8443/login", waiting until "load"