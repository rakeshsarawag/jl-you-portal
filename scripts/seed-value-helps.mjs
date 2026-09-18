/**
 * Seeds all missing value-help dropdown entries from 04_value_helps_extensions.sql.
 *
 * Run once (idempotent — safe to re-run):
 *   node scripts/seed-value-helps.mjs
 *   npm run seed:value-helps
 *
 * This executes the SQL file directly via the edge function — the SQL file is
 * the single source of truth. No data is duplicated in this script.
 */

import { runFile } from './_db.mjs';

async function run() {
  console.log('Seeding value-help dropdown extensions…\n');
  const ok = await runFile('04_value_helps_extensions.sql');
  console.log(ok ? '\nDone.' : '\nFailed — check output above.');
  process.exit(ok ? 0 : 1);
}

run();
