/**
 * Compatibility wrapper retained for existing developer commands.
 * Onboarding schema and value-help changes now live in the canonical schema
 * and seed migrations.
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

  ok = await runFile('01_schema.sql') && ok;
  ok = await runFile('02_seed_data.sql') && ok;

  // permission_audit_log: created via the dedicated endpoint (uses postgres internally)
  ok = await callEndpoint(
    'permission_audit_log table',
    `${API_BASE}/permissions/migrate`,
  ) && ok;

  console.log(ok ? '\nAll migrations applied.' : '\nSome migrations failed — check output above.');
  process.exit(ok ? 0 : 1);
}

run();
