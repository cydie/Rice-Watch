/**
 * Export the live Docker Postgres database into docker/postgres/init/
 * so the next fresh `docker compose up --build` (new laptop / down -v)
 * restores farmers, reports, and accounts with the project.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'docker', 'postgres', 'init');
const outFile = join(outDir, '01-ricewatch-data.sql');
const container = 'ricewatch-db';

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function run(args, options = {}) {
  return spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    windowsHide: true,
  });
}

mkdirSync(outDir, { recursive: true });

const health = run([
  'inspect',
  '-f',
  '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
  container,
]);
if (health.status !== 0 || !(health.stdout || '').includes('healthy')) {
  fail(
    [
      `Container ${container} is not healthy.`,
      'Start it first: docker compose up -d postgres',
      'Or: npm run db:up',
    ].join('\n')
  );
}

console.log('Dumping RiceWatch database...');
const dump = run([
  'exec',
  container,
  'pg_dump',
  '-U',
  'ricewatch',
  '-d',
  'ricewatch',
  '--no-owner',
  '--no-acl',
  '--clean',
  '--if-exists',
  '-F',
  'p',
]);
if (dump.status !== 0) {
  fail(`pg_dump failed:\n${dump.stderr || dump.stdout || 'unknown error'}`);
}

let sql = dump.stdout || '';
sql = sql.replace(/^\\restrict .*$/gm, '').replace(/^\\unrestrict .*$/gm, '');
if (!sql.includes('PostgreSQL database dump')) {
  fail('pg_dump output did not look like a SQL dump.');
}

writeFileSync(outFile, sql, 'utf8');
console.log(`Wrote ${outFile}`);
console.log(
  [
    '',
    'Commit this file and push to GitHub.',
    'On another laptop:',
    '  docker compose down -v',
    '  docker compose up --build',
    '(down -v is required once so Postgres reloads the snapshot into a fresh volume.)',
    '',
  ].join('\n')
);

if (!existsSync(outFile)) fail('Snapshot file was not created.');
