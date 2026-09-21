/**
 * Start the Docker Postgres container, wait until it is healthy (green),
 * then create tables and seed demo data if the database is empty.
 * pgAdmin / local PostgreSQL is not required.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const waitOnly = process.argv.includes('--wait-only');
const DOCKER_URL =
  'postgresql://ricewatch:ricewatch_secret@localhost:5435/ricewatch?schema=public';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bin(command) {
  if (process.platform !== 'win32') return command;
  if (command === 'npm') return 'npm.cmd';
  if (command === 'npx') return 'npx.cmd';
  return command;
}

function run(command, args, options = {}) {
  return spawnSync(bin(command), args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    windowsHide: true,
    shell: false,
  });
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function ensureEnvFiles() {
  const pairs = [
    [join(root, '.env.example'), join(root, '.env')],
    [join(root, 'server', '.env.example'), join(root, 'server', '.env')],
  ];

  for (const [from, to] of pairs) {
    if (!existsSync(to) && existsSync(from)) {
      copyFileSync(from, to);
      console.log(`Created ${to.replace(`${root}\\`, '').replace(`${root}/`, '')} from example`);
    }
  }

  const serverEnvPath = join(root, 'server', '.env');
  if (!existsSync(serverEnvPath)) {
    fail('Missing server/.env. Copy server/.env.example to server/.env and try again.');
  }

  const envText = readFileSync(serverEnvPath, 'utf8');
  if (/localhost:5432\b/.test(envText)) {
    console.warn(
      'server/.env still points at local PostgreSQL (port 5432). RiceWatch uses the Docker database on port 5435.'
    );
    console.warn(`Set DATABASE_URL to:\n  ${DOCKER_URL}\n`);
  }
}

function dockerMissing(result) {
  return result.error?.code === 'ENOENT';
}

function dockerEngineDown(result) {
  const text = `${result.stdout || ''}\n${result.stderr || ''}`.toLowerCase();
  return (
    result.status !== 0 &&
    (text.includes('cannot find the file') ||
      text.includes('dockerdesktoplinuxengine') ||
      text.includes('error during connect') ||
      text.includes('the docker daemon') ||
      text.includes('pipe/dockerdesktop') ||
      text.includes('npipe:////./pipe'))
  );
}

async function waitForDockerDesktop() {
  const deadline = Date.now() + 90_000;
  let last = null;

  while (Date.now() < deadline) {
    last = run('docker', ['info']);
    if (dockerMissing(last)) {
      fail(
        'Docker is not installed. Install Docker Desktop, open it, wait until it is green (Running), then retry.'
      );
    }
    if (last.status === 0) return;
    if (!dockerEngineDown(last)) break;
    process.stdout.write('Waiting for Docker Desktop to be green (Running)...\n');
    await sleep(3000);
  }

  fail(
    [
      'Docker Desktop is not running yet.',
      'Open Docker Desktop from the Start menu and wait until the whale icon is green / status is Running.',
      'You do not need pgAdmin. Then run this command again.',
    ].join('\n')
  );
}

function composeUp() {
  console.log('Starting Docker Postgres (ricewatch-db)...');
  const result = run('docker', ['compose', 'up', '-d'], { stdio: 'inherit' });
  if (result.status !== 0) {
    fail(
      'Could not start the Postgres container. Open Docker Desktop, wait until it is green, then retry: npm run db:up'
    );
  }
}

function containerHealth() {
  const result = run('docker', [
    'inspect',
    '-f',
    '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}',
    'ricewatch-db',
  ]);
  return (result.stdout || '').trim();
}

function postgresReady() {
  const result = run('docker', [
    'exec',
    'ricewatch-db',
    'pg_isready',
    '-U',
    'ricewatch',
    '-d',
    'ricewatch',
  ]);
  return result.status === 0;
}

async function waitUntilHealthy() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const health = containerHealth();
    if (health === 'healthy' && postgresReady()) {
      console.log('Docker Postgres is healthy (green) on localhost:5435');
      return;
    }
    if (health === 'unhealthy') {
      fail('The ricewatch-db container is unhealthy. Try: docker compose down && npm run db:up');
    }
    process.stdout.write(`Waiting for database container (${health || 'starting'})...\n`);
    await sleep(2500);
  }
  fail('Timed out waiting for Docker Postgres to become healthy. Check Docker Desktop for ricewatch-db.');
}

function npmInServer(script) {
  const result = run('npm', ['run', script, '--prefix', 'server'], { stdio: 'inherit' });
  if (result.status !== 0) {
    fail(`Database step failed: npm run ${script} --prefix server`);
  }
}

function userCount() {
  const result = run('docker', [
    'exec',
    'ricewatch-db',
    'psql',
    '-U',
    'ricewatch',
    '-d',
    'ricewatch',
    '-tAc',
    'SELECT count(*) FROM "User"',
  ]);
  if (result.status !== 0) return 0;
  return Number((result.stdout || '0').trim()) || 0;
}

async function main() {
  ensureEnvFiles();
  await waitForDockerDesktop();
  composeUp();
  await waitUntilHealthy();

  if (waitOnly) return;

  npmInServer('db:generate');
  npmInServer('db:push');

  if (userCount() === 0) {
    console.log('Empty database — loading demo accounts (no pgAdmin needed)...');
    npmInServer('db:seed');
  } else {
    console.log('Database already has data — skipping seed.');
  }

  console.log('\nDatabase is ready. You can run: npm run dev\n');
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
