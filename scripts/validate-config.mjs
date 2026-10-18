// Validates the game config. Exit code 1 on errors (warnings only print).
//
//   node scripts/validate-config.mjs [config-dir]   (default: site/config)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CONFIG_FILES, parseConfigFiles, validateConfig } from '../site/src/config.js';

export async function validateDir(dir) {
  const sources = {};
  const errors = [];
  for (const [part, file] of Object.entries(CONFIG_FILES)) {
    try { sources[part] = await readFile(`${dir}/${file}`, 'utf8'); } catch (e) { errors.push(`${file}: kunde inte läsas (${e.code})`); }
  }
  if (errors.length) return { errors, warnings: [] };
  const parsed = parseConfigFiles(sources);
  if (parsed.errors.length) return { errors: parsed.errors, warnings: [] };
  const { errors: e, warnings } = validateConfig(parsed.raw);
  return { errors: e, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] || fileURLToPath(new URL('../site/config', import.meta.url));
  const { errors, warnings } = await validateDir(dir);
  for (const w of warnings) console.warn(`varning: ${w}`);
  for (const e of errors) console.error(`fel: ${e}`);
  if (errors.length) {
    console.error(`\n${errors.length} fel i ${dir}`);
    process.exit(1);
  }
  console.log(`Konfigurationen i ${dir} är giltig (${warnings.length} varningar).`);
}
