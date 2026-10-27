#!/usr/bin/env node

console.error(`
seed-permissions.mjs has been retired.

Its hardcoded matrix could overwrite Permission Manager changes and drift from
src/constants/permissionSections.ts. Apply the Supabase migrations to create
role_permissions, then configure and save the canonical matrix in Permission
Manager instead.
`.trim());

process.exitCode = 1;
