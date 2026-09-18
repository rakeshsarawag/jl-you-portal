# Automation Tests — JL You Portal

Tests are written with **Playwright** (end-to-end) and **Vitest** (unit/integration).  
Keep test files separate from source. Never import test utilities into production code.

## Structure

```
tests/
├── e2e/                  # Playwright end-to-end tests (app feature coverage)
│   ├── auth/
│   ├── recruitment/
│   ├── onboarding/
│   ├── dashboard/
│   ├── directory/
│   ├── performance/
│   ├── training/
│   ├── it-services/
│   ├── invoice/
│   ├── payroll/
│   ├── projects/
│   ├── assets/
│   ├── okr/
│   ├── knowledge/
│   ├── user-management/
│   └── shared/           # Helpers, fixtures, page objects
├── unit/                 # Vitest unit tests for hooks and utilities
│   ├── hooks/
│   └── utils/
└── README.md
```

## Run Tests

```bash
# Install deps
pnpm install

# E2E — all tests
pnpm exec playwright test

# E2E — specific app
pnpm exec playwright test tests/e2e/recruitment/

# E2E — headed (watch browser)
pnpm exec playwright test --headed

# Unit tests
pnpm exec vitest run

# Unit — watch mode
pnpm exec vitest
```

## Writing Tests

- Each app has its own folder under `tests/e2e/<app>/`
- Each file covers one feature area (e.g. `candidate-crud.spec.ts`)
- Use Page Object pattern — keep selectors in `shared/pages/`
- Test personas: create one fixture user per role (admin, hr, manager, employee, finance, it, marketing)
- Every test must clean up its own data (use `afterEach` / API teardown)

## Coverage Requirement

Every feature listed in `docs/PRODUCT_FEATURES.md` must have at least one test.  
Run `pnpm test:coverage` to generate the coverage report.
