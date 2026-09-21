/**
 * Start the Docker Postgres container, wait until it is healthy (green),
 * then create tables and seed demo data if the database is empty.
 * pgAdmin / local PostgreSQL is not required.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const serverDir = join(root, 'server');
const waitOnly = process.argv.includes('--wait-only');
const DOCKER_URL =
  'postgresql://ricewatch:ricewatch_secret@127.0.0.1:5435/ricewatch?schema=public';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function run(command, args, options = {}) {
  const isWin = process.platform === 'win32';
  const exe =
    isWin && command === 'npm'
      ? 'npm.cmd'
      : isWin && command === 'npx'
        ? 'npx.cmd'
        : command;

  return spawnSync(exe, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    windowsHide: true,
    shell: Boolean(options.shell),
    env: options.env ?? process.env,
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

  let text = readFileSync(serverEnvPath, 'utf8');
  let updated = text.replace(/@localhost:5435\b/g, '@127.0.0.1:5435');

  if (/@(localhost|127\.0\.0\.1):5432\b/.test(updated)) {
    console.warn('server/.env pointed at local PostgreSQL (port 5432). Switching to Docker on 127.0.0.1:5435.');
    if (/^DATABASE_URL=/m.test(updated)) {
      updated = updated.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${DOCKER_URL}"`);
    } else {
      updated = `DATABASE_URL="${DOCKER_URL}"\n${updated}`;
    }
  }

  if (!/^DATABASE_URL=/m.test(updated)) {
    updated = `DATABASE_URL="${DOCKER_URL}"\n${updated}`;
  }

  if (updated !== text) {
    writeFileSync(serverEnvPath, updated);
    console.log('Updated server/.env to use Docker Postgres at 127.0.0.1:5435');
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
      console.log('Docker Postgres is healthy (green) on 127.0.0.1:5435');
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

function serverEnv() {
  return {
    ...process.env,
    CI: '1',
    PATH: `${join(serverDir, 'node_modules', '.bin')}${delimiter}${process.env.PATH || ''}`,
  };
}

function runInServer(label, commandLine) {
  const prismaCmd = join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'prisma.cmd' : 'prisma');
  const tsxCmd = join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

  if (!existsSync(prismaCmd) || (label === 'db:seed' && !existsSync(tsxCmd))) {
    fail(
      [
        `Cannot run ${label} because server packages are missing.`,
        'From the project folder run:',
        '  cd server',
        '  npm install',
        '  cd ..',
        '  npm run db:ready',
      ].join('\n')
    );
  }

  console.log(`Running ${label}...`);

  const result =
    process.platform === 'win32'
      ? spawnSync('cmd.exe', ['/d', '/s', '/c', commandLine], {
          cwd: serverDir,
          stdio: 'inherit',
          windowsHide: true,
          env: serverEnv(),
        })
      : spawnSync('sh', ['-c', commandLine], {
          cwd: serverDir,
          stdio: 'inherit',
          env: serverEnv(),
        });

  if (result.error) {
    fail(`Database step failed (${label}): ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(
      [
        `Database step failed: ${label}`,
        `Exit code: ${result.status}`,
        'The lines above this message are the real Prisma/npm error.',
        'Typical fixes:',
        '- Open Docker Desktop and wait until ricewatch-db is healthy',
        '- In Rice-Watch\\server run: npm install',
        `- server\\.env DATABASE_URL must be:\n  DATABASE_URL="${DOCKER_URL}"`,
      ].join('\n')
    );
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

  runInServer('db:generate', 'prisma generate');
  runInServer('db:push', 'prisma db push --skip-generate');

  if (userCount() === 0) {
    console.log('Empty database — loading demo accounts (no pgAdmin needed)...');
    runInServer('db:seed', 'tsx prisma/seed.ts');
  } else {
    console.log('Database already has data — skipping seed.');
  }

  console.log('\nDatabase is ready. You can run: npm run dev\n');
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
