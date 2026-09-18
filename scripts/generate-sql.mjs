/**
 * Generates a single consolidated SQL file from all migration files.
 *
 * Use this when the HTTP migration scripts are blocked (e.g. Cloudflare blocks
 * POST requests from the server environment). The output file can be pasted
 * directly into the Supabase Dashboard SQL editor:
 *
 *   https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new
 *
 * Usage:
 *   node scripts/generate-sql.mjs          — writes supabase/migrations/run-all.sql
 *   npm run generate:sql                    — same
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { readSql, MIGRATIONS, REPO_ROOT } from './_db.mjs';

const MIGRATION_FILES = [
  '01_schema.sql',
  '02_seed.sql',
  '02_recruitment_extensions.sql',
  '03_onboarding_source.sql',
  '04_value_helps_extensions.sql',
];

const OUT_FILE = join(MIGRATIONS, 'run-all.sql');

const BANNER = `-- ============================================================
-- Jeshan Labs HR Portal — Full Migration Suite
-- Generated: ${new Date().toISOString()}
--
-- HOW TO RUN:
--   1. Open the Supabase SQL editor:
--      https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new
--   2. Paste the entire contents of this file
--   3. Click "Run"
--
-- All statements are idempotent (IF NOT EXISTS / ON CONFLICT DO UPDATE)
-- so this is safe to run multiple times.
-- ============================================================

`;

function run() {
  const parts = [BANNER];

  for (const file of MIGRATION_FILES) {
    const sql = readSql(file);
    parts.push(`-- ────────────────────────────────────────────────────────────
-- File: ${file}
-- ────────────────────────────────────────────────────────────\n\n`);
    parts.push(sql.trim());
    parts.push('\n\n');
  }

  const combined = parts.join('');
  writeFileSync(OUT_FILE, combined, 'utf8');

  const sizeKB = Math.round(combined.length / 1024);
  console.log(`\nGenerated: supabase/migrations/run-all.sql (${sizeKB} KB)\n`);
  console.log('Next steps:');
  console.log('  1. Open: https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new');
  console.log('  2. Paste the contents of supabase/migrations/run-all.sql');
  console.log('  3. Click "Run"\n');
}

run();
