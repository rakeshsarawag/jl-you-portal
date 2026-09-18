/**
 * Shared helpers for migration/seed scripts.
 * Reads local SQL files and executes them via the edge function's /admin/run-sql endpoint.
 *
 * NOTE: POST requests to Supabase may be blocked in server-side environments
 * by Cloudflare (HTTP 520 "Origin is disallowed"). When this happens, runSql()
 * returns false and callers should fall back to generate-sql.mjs output.
 */

import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const PROJECT_ID  = 'icmexriwtsjwpswexyrb';
export const ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljbWV4cml3dHNqd3Bzd2V4eXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Nzg1NjQsImV4cCI6MjA4OTA1NDU2NH0.yP4FVH0bXXIvJxIXVxkhT-CM9NAw457eVxTK5Uny_c4';
export const API_BASE    = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-1fe2c468`;
export const HEADERS     = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${ANON_KEY}`,
  apikey: ANON_KEY,
};

// Resolve paths relative to repo root (scripts/ is one level down)
const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT  = resolve(__dirname, '..');
export const MIGRATIONS = join(REPO_ROOT, 'supabase', 'migrations');

/** Read a migration SQL file from supabase/migrations/ */
export function readSql(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

/**
 * Execute SQL via the edge function's /admin/run-sql endpoint.
 * Returns false (without throwing) if the request is network-blocked (HTTP 520).
 * The caller should check the return value and fall back to generate-sql.mjs when false.
 */
export async function runSql(label, sql) {
  process.stdout.write(`  [SQL] ${label}… `);
  let res;
  try {
    res = await fetch(`${API_BASE}/admin/run-sql`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ sql }),
    });
  } catch (e) {
    console.log('FAILED (network error)');
    console.error(`        ${e.message}`);
    return false;
  }

  // HTTP 520 = Cloudflare blocking POST from this server environment
  if (res.status === 520) {
    console.log('BLOCKED');
    console.error('        Cloudflare is blocking POST requests from this environment.');
    console.error('        Run: npm run generate:sql  then paste the output into the Supabase SQL editor.');
    return false;
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    console.log('FAILED');
    console.error(`        ${body.error || res.statusText}`);
    return false;
  }
  console.log('OK');
  return true;
}

/** Execute a named migration SQL file */
export async function runFile(filename) {
  return runSql(filename, readSql(filename));
}

/** Bulk-upsert value-help rows via the master-data API */
export async function seedValueHelps(rows) {
  const CHUNK = 100;
  let total = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    let res;
    try {
      res = await fetch(`${API_BASE}/master-data/value-helps/seed`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ rows: chunk }),
      });
    } catch (e) {
      console.error(`  [VH] Network error:`, e.message);
      return false;
    }
    if (res.status === 520) {
      console.error('  [VH] Blocked by Cloudflare — run: npm run generate:sql');
      return false;
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.error) {
      console.error(`  [VH] Chunk ${i}–${i + CHUNK} failed:`, body.error || res.statusText);
      return false;
    }
    total += body.count ?? chunk.length;
    process.stdout.write(`\r  [VH] Seeded ${total} / ${rows.length} value-help rows…`);
  }
  console.log(`\r  [VH] Seeded ${total} value-help rows OK                   `);
  return true;
}
