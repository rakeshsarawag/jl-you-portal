/**
 * Applies pending incremental DB migrations:
 *
 *   03_onboarding_source.sql  — adds source column to onboarding_records
 *   04_value_helps_extensions.sql — adds missing dropdown value-help rows
 *   permission_audit_log table  — created via the permissions/migrate endpoint
 *
 * Run once (idempotent — safe to re-run):
 *   node scripts/migrate-onboarding-source.mjs
 *   npm run migrate:onboarding-source
 *
 * For a full fresh-setup run all migrations instead:
 *   npm run migrate:all
 */

import { runFile, API_BASE, HEADERS } from './_db.mjs';

async function callEndpoint(label, url) {
  process.stdout.write(`  [endpoint] ${label}… `);
  const res = await fetch(url, { method: 'POST', headers: HEADERS });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    console.log('FAILED');
    console.error(`             ${body.error || res.statusText}`);
    return false;
  }
  console.log('OK');
  return true;
}

async function run() {
  console.log('Applying incremental migrations…\n');
  let ok = true;

  // Schema changes from SQL migration files
  ok = await runFile('03_onboarding_source.sql') && ok;
  ok = await runFile('04_value_helps_extensions.sql') && ok;

  // permission_audit_log: created via the dedicated endpoint (uses postgres internally)
  ok = await callEndpoint(
    'permission_audit_log table',
    `${API_BASE}/permissions/migrate`,
  ) && ok;

  console.log(ok ? '\nAll migrations applied.' : '\nSome migrations failed — check output above.');
  process.exit(ok ? 0 : 1);
}

run();
