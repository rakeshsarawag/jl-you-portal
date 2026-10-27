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

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { readSql, MIGRATIONS } from './_db.mjs';
import { ACTIVE_MIGRATIONS } from './migration-manifest.mjs';

const OUT_FILE = join(MIGRATIONS, 'run-all.sql');

const BANNER = `-- ============================================================
-- Jeshan Labs HR Portal — Full Migration Suite
-- Generated from scripts/migration-manifest.mjs
--
-- HOW TO RUN:
--   1. Open the Supabase SQL editor:
--      https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new
--   2. Paste the entire contents of this file
--   3. Click "Run"
--
-- Statements are written for repeat execution using existence checks,
-- replacement guards, and conflict-safe data operations.
-- ============================================================

`;

function buildCombinedSql() {
  const parts = [BANNER];

  for (const { file, description } of ACTIVE_MIGRATIONS) {
    const sql = readSql(file);
    parts.push(`-- ────────────────────────────────────────────────────────────
-- File: ${file}
-- Purpose: ${description}
-- ────────────────────────────────────────────────────────────\n\n`);
    parts.push(sql.trim());
    parts.push('\n\n');
  }

  return `${parts.join('').trimEnd()}\n`;
}

function run() {
  const combined = buildCombinedSql();
  if (process.argv.includes('--check')) {
    const existing = readFileSync(OUT_FILE, 'utf8');
    if (existing !== combined) {
      console.error('supabase/migrations/run-all.sql is stale. Run: pnpm generate:sql');
      process.exit(1);
    }
    console.log('run-all.sql is current.');
    return;
  }

  writeFileSync(OUT_FILE, combined, 'utf8');

  const sizeKB = Math.round(combined.length / 1024);
  console.log(`\nGenerated: supabase/migrations/run-all.sql (${sizeKB} KB)\n`);
  console.log('Next steps:');
  console.log('  1. Open: https://supabase.com/dashboard/project/icmexriwtsjwpswexyrb/sql/new');
  console.log('  2. Paste the contents of supabase/migrations/run-all.sql');
  console.log('  3. Click "Run"\n');
}

run();
