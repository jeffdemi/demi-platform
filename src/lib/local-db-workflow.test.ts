import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

let root: string;
const name = '20260101000000_fixture.sql';
const sql = 'create table example(id integer);\n';
function run(command: string, ...extra: string[]) {
  return spawnSync(process.execPath, [resolve(root, 'scripts/local-db.mjs'), command, ...extra], {
    encoding: 'utf8', env: { ...process.env, DOCKER_HOST: '', PATH: `${root}/bin:${process.env.PATH}` },
  });
}
function write(path: string, content: string) { writeFileSync(resolve(root, path), content); }
function reset() { expect(run('reset').status).toBe(0); }
beforeEach(() => {
  root = mkdtempSync(resolve(tmpdir(), 'demi-local-db-'));
  for (const dir of ['scripts', 'supabase/migrations', 'supabase/tests', 'bin']) mkdirSync(resolve(root, dir), { recursive: true });
  copyFileSync(resolve('scripts/local-db.mjs'), resolve(root, 'scripts/local-db.mjs'));
  write(`supabase/migrations/${name}`, sql);
  write('supabase/local-replay-exceptions.json', '{}');
  // Simulate successful local commands; never start Docker or reach a database.
  write('bin/docker', "#!/bin/sh\nprintf '%s\\n' 'unix:///tmp/test.sock'\n");
  write('bin/npx', '#!/bin/sh\nexit 0\n');
  chmodSync(resolve(root, 'bin/docker'), 0o755);
  chmodSync(resolve(root, 'bin/npx'), 0o755);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('local database workflow safeguards', () => {
  it('includes new canonical migrations and requires reset before testing them', () => {
    reset();
    expect(run('test').status).toBe(0);
    write('supabase/migrations/20260102000000_new.sql', 'select 1;');
    expect(run('test').stderr).toContain('Run npm run db:reset');
    reset();
    expect(readFileSync(resolve(root, '.supabase-local/supabase/migrations/20260102000000_new.sql'), 'utf8')).toBe('select 1;');
    expect(run('test').status).toBe(0);
  });
  it('rejects edits to generated migration files', () => {
    reset();
    write(`.supabase-local/supabase/migrations/${name}`, 'select 2;');
    expect(run('test').stderr).toContain('Generated migration drift');
  });
  it('rejects extra generated history', () => {
    reset();
    write('.supabase-local/supabase/migrations/20260102000000_extra.sql', 'select 2;');
    expect(run('reset').stderr).toContain('Unexpected local migration');
  });
  it('preserves the reviewed prefix and detects canonical exception drift', () => {
    const original = sql + 'do $$ begin raise exception \'production fixture missing\'; end $$;';
    write(`supabase/migrations/${name}`, original);
    write('supabase/local-replay-exceptions.json', JSON.stringify({ [name]: {
      sha256: createHash('sha256').update(original).digest('hex'), keepCharacters: sql.length, reason: 'Test fixture',
    } }));
    reset();
    expect(readFileSync(resolve(root, `.supabase-local/supabase/migrations/${name}`), 'utf8')).toContain(sql);
    expect(readFileSync(resolve(root, `supabase/migrations/${name}`), 'utf8')).toBe(original);
    write(`supabase/migrations/${name}`, original + '\n');
    expect(run('prepare').stderr).toContain('Historical migration changed');
  });
  it('rejects linked project metadata and caller-supplied flags', () => {
    expect(run('test', '--linked').stderr).toContain('extra flags and remote targets are refused');
    mkdirSync(resolve(root, '.supabase-local/supabase/.temp'), { recursive: true });
    write('.supabase-local/supabase/.temp/project-ref', 'never-connect');
    expect(run('start').stderr).toContain('linked to a hosted project');
  });
  it('rejects remote Docker contexts before invoking Supabase', () => {
    write('bin/docker', "#!/bin/sh\nprintf '%s\\n' 'ssh://remote-host'\n");
    expect(run('start').stderr).toContain('local Unix-socket context');
  });
  it('invalidates reset evidence when replay fails', () => {
    reset();
    write('bin/npx', '#!/bin/sh\nexit 1\n');
    expect(run('reset').status).toBe(1);
    expect(run('test').stderr).toContain('no successful reset exists');
  });
  it('rejects duplicate canonical versions', () => {
    write('supabase/migrations/20260101000000_duplicate.sql', 'select 2;');
    expect(run('prepare').stderr).toContain('duplicate migration version');
  });
});
