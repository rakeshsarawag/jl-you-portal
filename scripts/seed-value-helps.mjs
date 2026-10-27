/**
 * Refreshes value-help dropdown entries from the canonical seed migration.
 *
 * Run once (idempotent — safe to re-run):
 *   node scripts/seed-value-helps.mjs
 *   npm run seed:value-helps
 *
 * `02_seed_data.sql` is idempotent and is the single source of truth.
 */

import { runFile } from './_db.mjs';

async function run() {
  console.log('Refreshing canonical seed and value-help data…\n');
  const ok = await runFile('02_seed_data.sql');
  console.log(ok ? '\nDone.' : '\nFailed — check output above.');
  process.exit(ok ? 0 : 1);
}

run();
