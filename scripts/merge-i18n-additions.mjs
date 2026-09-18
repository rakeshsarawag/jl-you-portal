/**
 * Merges all JSON addition files from src/i18n/additions/ into the four locale files.
 * Run after all i18n agents have completed: node scripts/merge-i18n-additions.mjs
 */
import { readdir, readFile, writeFile, unlink } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const additionsDir = path.join(__dirname, '../src/i18n/additions');
const localesDir = path.join(__dirname, '../src/i18n/locales');
const LOCALES = ['en', 'de', 'hi', 'es'];

async function main() {
  let files;
  try {
    files = (await readdir(additionsDir)).filter(f => f.endsWith('.json'));
  } catch {
    console.log('No additions directory found — nothing to merge.');
    return;
  }

  if (files.length === 0) {
    console.log('No addition files found.');
    return;
  }

  console.log(`Found ${files.length} addition file(s): ${files.join(', ')}`);

  // Accumulate all keys per locale
  const merged = { en: {}, de: {}, hi: {}, es: {} };

  for (const file of files) {
    const raw = await readFile(path.join(additionsDir, file), 'utf8');
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      console.error(`  ✗ Failed to parse ${file}: ${e.message}`);
      continue;
    }
    let keyCount = 0;
    for (const locale of LOCALES) {
      if (data[locale]) {
        Object.assign(merged[locale], data[locale]);
        keyCount += Object.keys(data[locale]).length;
      }
    }
    console.log(`  ✓ ${file}: ${keyCount / LOCALES.length} keys`);
  }

  // Append new keys to each locale file
  for (const locale of LOCALES) {
    const additions = merged[locale];
    const newKeys = Object.keys(additions);
    if (newKeys.length === 0) continue;

    const localeFile = path.join(localesDir, `${locale}.ts`);
    let content = await readFile(localeFile, 'utf8');

    // Check which keys are already present and skip them
    const toAdd = newKeys.filter(k => !content.includes(`"${k}"`));
    if (toAdd.length === 0) {
      console.log(`  ${locale}.ts — all keys already present, skipping`);
      continue;
    }

    const lines = toAdd
      .map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(additions[k])},`)
      .join('\n');

    // Insert before the closing `} as const;`
    content = content.replace(/\n\} as const;/, `\n${lines}\n} as const;`);
    await writeFile(localeFile, content, 'utf8');
    console.log(`  ✓ ${locale}.ts — added ${toAdd.length} key(s)`);
  }

  // Delete the addition files
  for (const file of files) {
    await unlink(path.join(additionsDir, file));
  }
  console.log('\nDone. Addition files removed.');
}

main().catch(e => { console.error(e); process.exit(1); });
