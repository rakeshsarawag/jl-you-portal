# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: projects/project-management-expanded.spec.ts >> Project Management — Expanded >> 6. High-severity risk shows a red indicator
- Location: tests/e2e/projects/project-management-expanded.spec.ts:151:3

# Error details

```
Error: browserType.launch: Executable doesn't exist at /workspaces/default/sessions/5fdd8f7b-7029-49b0-b2ff-86716ad324c9/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell
╔════════════════════════════════════════════════════════════╗
║ Looks like Playwright was just installed or updated.       ║
║ Please run the following command to download new browsers: ║
║                                                            ║
║     pnpm exec playwright install                           ║
║                                                            ║
║ <3 Playwright Team                                         ║
╚════════════════════════════════════════════════════════════╝
```