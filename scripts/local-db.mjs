import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const workdir = resolve(root, '.supabase-local');
const command = process.argv[2];
if (process.argv.length !== 3 || !['prepare', 'start', 'reset', 'test', 'stop', 'history'].includes(command)) {
  throw new Error('Use local-db.mjs prepare|start|reset|test|stop|history; extra flags and remote targets are refused.');
}
if (process.env.DOCKER_HOST && !process.env.DOCKER_HOST.startsWith('unix://')) {
  throw new Error('A local Unix Docker socket is required; remote Docker hosts are refused.');
}
if (existsSync(resolve(workdir, 'supabase/.temp/project-ref'))) {
  throw new Error('The disposable projection is linked to a hosted project. Refusing all operations.');
}
const exceptions = JSON.parse(readFileSync(resolve(root, 'supabase/local-replay-exceptions.json'), 'utf8'));
const migrationDir = resolve(root, 'supabase/migrations');
const migrations = readdirSync(migrationDir).filter(n => n.endsWith('.sql')).sort();
const digest = value => createHash('sha256').update(value).digest('hex');
const expected = {};
const sourceHashes = {};
const versions = new Set();
for (const name of migrations) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(name) || versions.has(name.slice(0, 14))) {
    throw new Error(`Invalid or duplicate migration version: ${name}`);
  }
  versions.add(name.slice(0, 14));
  let sql = readFileSync(resolve(migrationDir, name), 'utf8');
  sourceHashes[name] = digest(sql);
  const exception = exceptions[name];
  if (exception) {
    if (sourceHashes[name] !== exception.sha256) throw new Error(`Historical migration changed: ${name}`);
    if (!Number.isInteger(exception.keepCharacters) || exception.keepCharacters < 0 || exception.keepCharacters >= sql.length) {
      throw new Error(`Invalid projection boundary: ${name}`);
    }
    sql = sql.slice(0, exception.keepCharacters) + '\n-- Local projection only: production-specific data correction omitted.\n';
  }
  expected[name] = sql;
}
if (Object.keys(exceptions).some(name => !migrations.includes(name))) throw new Error('An exception refers to a missing canonical migration.');
const signature = digest(JSON.stringify({ sourceHashes, exceptions }));
const resetRecord = resolve(workdir, 'last-successful-reset.json');
const projectedDir = resolve(workdir, 'supabase/migrations');
if (command === 'prepare' || command === 'start' || command === 'reset') {
  mkdirSync(projectedDir, { recursive: true });
  mkdirSync(resolve(workdir, 'supabase/tests'), { recursive: true });
  writeFileSync(resolve(workdir, 'supabase/config.toml'), `project_id = "demi-platform-reliability-local"
[db]
major_version = 17
[db.seed]
enabled = false
`);
  if (readdirSync(projectedDir).some(n => !migrations.includes(n))) throw new Error('Unexpected local migration: the projection is not a source of migration history.');
  for (const name of migrations) {
    if (exceptions[name]) console.log(`Local replay exception: ${name} (${exceptions[name].reason})`);
    writeFileSync(resolve(projectedDir, name), expected[name]);
  }
}
if (command === 'test' || command === 'history') {
  if (!existsSync(resetRecord) || JSON.parse(readFileSync(resetRecord, 'utf8')).signature !== signature) {
    throw new Error('Canonical migrations or projection rules changed, or no successful reset exists. Run npm run db:reset first.');
  }
  if (JSON.stringify(readdirSync(projectedDir).sort()) !== JSON.stringify(migrations) ||
      migrations.some(name => readFileSync(resolve(projectedDir, name), 'utf8') !== expected[name])) {
    throw new Error('Generated migration drift detected. Run npm run db:reset; never edit or deploy the projection.');
  }
}
// Refresh tests even when rerunning against an already started local stack.
mkdirSync(resolve(workdir, 'supabase/tests'), { recursive: true });
for (const name of readdirSync(resolve(root, 'supabase/tests')).filter(n => n.endsWith('.sql'))) {
  writeFileSync(resolve(workdir, 'supabase/tests', name), readFileSync(resolve(root, 'supabase/tests', name)));
}
if (command !== 'prepare') {
  const args = {
    start: ['start'], reset: ['db', 'reset', '--local', '--no-seed'],
    test: ['test', 'db', '--local'], stop: ['stop'], history: ['migration', 'list', '--local'],
  }[command];
  if (!process.env.DOCKER_HOST) {
    const context = spawnSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' });
    if (context.status !== 0 || !context.stdout.trim().startsWith('unix://')) {
      throw new Error('An operational Docker CLI with a local Unix-socket context is required.');
    }
  }
  // Invalidate before reset so an interrupted/failed replay cannot authorize tests.
  if (command === 'reset') writeFileSync(resetRecord, JSON.stringify({ signature: null }));
  const result = spawnSync('npx', ['--yes', 'supabase@2.117.0', '--workdir', workdir, ...args], { stdio: 'inherit', cwd: root });
  if (result.error) throw result.error;
  if (command === 'reset' && result.status === 0) writeFileSync(resetRecord, JSON.stringify({ signature }));
  process.exit(result.status ?? 1);
}
