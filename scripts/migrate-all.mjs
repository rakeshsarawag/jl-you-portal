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
 * The canonical order is defined once in migration-manifest.mjs.
 */

import { runFile, API_BASE, HEADERS } from './_db.mjs';
import { ACTIVE_MIGRATION_FILES } from './migration-manifest.mjs';

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

async function run() {
  console.log('Running full DB migration suite…\n');

  let ok = true;
  for (const [index, file] of ACTIVE_MIGRATION_FILES.entries()) {
    const applied = await runFile(file);
    if (!applied && index === 0) {
      // The first request is also the network/endpoint availability probe.
      console.log('\n─────────────────────────────────────────────────────────────');
      console.log('  SQL execution is unavailable from this environment.');
      console.log('  Generating a combined SQL file for manual execution…');
      console.log('─────────────────────────────────────────────────────────────\n');
      await import('./generate-sql.mjs');
      process.exit(1);
    }
    ok = applied && ok;
  }

  if (!ok) {
    // Blocked or failed on first attempt — fall back to SQL file generation
    console.log('\nOne or more canonical migrations failed; continuing with setup checks.');
  }

  // Dedicated endpoints for tables that require postgres-driver DDL
  ok = await endpoint('permission_audit_log table',  `${API_BASE}/permissions/migrate`) && ok;
  ok = await endpoint('role_permissions setup check', `${API_BASE}/permissions/setup`)  && ok;

  console.log(ok ? '\nAll migrations applied successfully.' : '\nSome steps failed — check output above.');
  process.exit(ok ? 0 : 1);
}

run();
