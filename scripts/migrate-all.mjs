/**
 * Full database setup — applies ALL migration files in order.
 *
 * Use this for a fresh environment or to bring any instance fully up to date.
 * Every statement is idempotent (IF NOT EXISTS / ON CONFLICT DO UPDATE).
 *
 *   node scripts/migrate-all.mjs
 *   npm run migrate:all
 *
 * If POST requests are blocked (Cloudflare 520), this script automatically
 * generates supabase/migrations/run-all.sql. Paste that file into:
 *   https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new
 *
 * To skip the HTTP attempt and go straight to file generation:
 *   npm run generate:sql
 *
 * Migration files applied (in order):
 *   01_schema.sql                — full DB schema (tables, indexes, RLS)
 *   02_seed.sql                  — reference/master data (value-helps, holidays, etc.)
 *   02_recruitment_extensions.sql — extra columns for recruitment tables
 *   03_onboarding_source.sql     — adds source column to onboarding_records
 *   04_value_helps_extensions.sql — missing dropdown value-help rows
 *   + permission_audit_log table via dedicated endpoint
 *   + role_permissions table via dedicated endpoint (if missing)
 */

import { runFile, API_BASE, HEADERS } from './_db.mjs';

async function endpoint(label, url) {
  process.stdout.write(`  [endpoint] ${label}… `);
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: HEADERS });
  } catch (e) {
    console.log('FAILED (network error)');
    return false;
  }
  if (res.status === 520) { console.log('BLOCKED'); return false; }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    console.log('FAILED');
    console.error(`             ${body.error || res.statusText}`);
    return false;
  }
  console.log('OK');
  return true;
}

const MIGRATION_FILES = [
  '01_schema.sql',
  '02_seed.sql',
  '02_recruitment_extensions.sql',
  '03_onboarding_source.sql',
  '04_value_helps_extensions.sql',
];

async function run() {
  console.log('Running full DB migration suite…\n');

  // Probe: check if POST requests reach the edge function
  const probe = await runFile('03_onboarding_source.sql');
  if (!probe) {
    // Blocked or failed on first attempt — fall back to SQL file generation
    console.log('\n─────────────────────────────────────────────────────────────');
    console.log('  POST requests are blocked in this environment (Cloudflare 520).');
    console.log('  Generating a combined SQL file for manual execution…');
    console.log('─────────────────────────────────────────────────────────────\n');
    await import('./generate-sql.mjs');
    process.exit(1);
  }

  // POST is working — run remaining files
  let ok = probe;
  for (const file of MIGRATION_FILES.filter(f => f !== '03_onboarding_source.sql')) {
    ok = await runFile(file) && ok;
  }

  // Dedicated endpoints for tables that require postgres-driver DDL
  ok = await endpoint('permission_audit_log table',  `${API_BASE}/permissions/migrate`) && ok;
  ok = await endpoint('role_permissions setup check', `${API_BASE}/permissions/setup`)  && ok;

  console.log(ok ? '\nAll migrations applied successfully.' : '\nSome steps failed — check output above.');
  process.exit(ok ? 0 : 1);
}

run();
