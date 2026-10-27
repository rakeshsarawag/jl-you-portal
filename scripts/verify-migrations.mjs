import { readdirSync, readFileSync } from 'fs';
import { basename, join } from 'path';
import { ACTIVE_MIGRATION_FILES } from './migration-manifest.mjs';
import { MIGRATIONS } from './_db.mjs';

const failures = [];
const activeSqlFiles = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql') && file !== 'run-all.sql')
  .sort();

if (JSON.stringify(activeSqlFiles) !== JSON.stringify([...ACTIVE_MIGRATION_FILES].sort())) {
  failures.push(
    `Active migration files do not match the manifest.\n` +
    `  manifest: ${[...ACTIVE_MIGRATION_FILES].sort().join(', ')}\n` +
    `  directory: ${activeSqlFiles.join(', ')}`,
  );
}

for (const file of ACTIVE_MIGRATION_FILES) {
  const sql = readFileSync(join(MIGRATIONS, file), 'utf8');

  if (/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/i.test(sql)) {
    failures.push(`${file}: contains CREATE TABLE without IF NOT EXISTS`);
  }

  const unsafeIndexes = [...sql.matchAll(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)([^\s(]+)/gi)]
    .map((match) => match[1])
    .filter((name) => {
      const plainName = name.replaceAll('"', '');
      return !sql.includes(`to_regclass('public.${plainName}')`) &&
        !new RegExp(`indexname\\s*=\\s*'${plainName}'`, 'i').test(sql);
    });
  if (unsafeIndexes.length) {
    failures.push(`${file}: unguarded indexes: ${unsafeIndexes.join(', ')}`);
  }

  const policyNames = [...sql.matchAll(/CREATE\s+POLICY\s+(?:"([^"]+)"|([a-zA-Z0-9_]+))/gi)]
    .map((match) => match[1] ?? match[2]);
  for (const policy of new Set(policyNames)) {
    if (policy.includes('%') && sql.includes('EXCEPTION WHEN duplicate_object')) continue;
    const escaped = policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hasDrop = new RegExp(`DROP\\s+POLICY\\s+IF\\s+EXISTS\\s+(?:\"${escaped}\"|${escaped})`, 'i').test(sql);
    const guardedByLookup = new RegExp(`policyname\\s*=\\s*'${escaped}'`, 'i').test(sql);
    if (!hasDrop && !guardedByLookup) {
      failures.push(`${file}: policy "${policy}" is not dropped or duplicate-guarded`);
    }
  }
}

const forbiddenActiveNames = /^\d{2}_(?!schema|seed_data|platform_services|security_and_access|business_extensions).*\.sql$/;
for (const file of readdirSync(MIGRATIONS)) {
  if (forbiddenActiveNames.test(basename(file))) {
    failures.push(`${file}: legacy migration remains in the active directory`);
  }
}

if (failures.length) {
  console.error('Migration verification failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Migration verification passed (${ACTIVE_MIGRATION_FILES.length} canonical files).`);
