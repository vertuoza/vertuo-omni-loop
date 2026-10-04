// One run of `pnpm releases:sync`, on a throwaway checkout and an in-memory table: what it prints,
// what it writes, and when it exits non-zero. The last test runs the script itself, with no
// credentials, so it stops before any call: no test reaches Supabase.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, it, expect } from 'vitest';
import { z } from 'zod';
import { readEnv } from '../env';
import { settled } from '../stages/settled';
import type { ReleaseRow } from './row';
import { missingVariables, releasesSync, syncReleases } from './sync-run';
import type { ReleasesTable } from './sync-table';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

const SHIPPED = '.omni-loop/delivery/shipped';
const spec = (prd: number, title: string) => `---\nprd: ${prd}\ntitle: ${title}\nblocked-by: none\nspec: file\n---\n`;
const note = (prd: number, title: string, description: string, version?: string) =>
  `---\nprd: ${prd}\ntitle: ${title}\n${version ? `version: ${version}\n` : ''}---\n${description}\n`;

/** A checkout on main holding `files`, committed at `date`. */
function checkout(files: Record<string, string>, date = '2026-09-28T11:15:00+02:00') {
  const root = mkdtempSync(join(tmpdir(), 'omni-releases-run-'));
  roots.push(root);
  for (const [path, text] of Object.entries({ '.omni-loop/config.yml': 'kit: 1\n', ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...args], {
    cwd: root, stdio: 'ignore', env: { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date },
  });
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('commit', '-q', '-m', 'fixture');
  return root;
}

/** A table over `rows` that keeps what it is told to write, or refuses to. */
function memoryTable(rows: ReleaseRow[], refuse: Partial<Record<keyof ReleasesTable, string>> = {}) {
  const written: string[] = [];
  const table: ReleasesTable = {
    rows: () => settled(() => { if (refuse.rows) throw new Error(refuse.rows); return rows; }),
    insert: (list) => settled(() => { if (refuse.insert) throw new Error(refuse.insert); written.push(...list.map((r) => `insert ${r.prd} ${r.release}`)); }),
    refresh: (text) => settled(() => { if (refuse.refresh) throw new Error(refuse.refresh); written.push(`refresh ${text.prd}`); }),
  };
  return { table, written };
}

/** Collects what a run prints, each stream on its own. */
function streams() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, print: { out: (line: string) => out.push(line), err: (line: string) => err.push(line) } };
}

const FILES = {
  [`${SHIPPED}/0003-kit/spec.md`]: spec(3, 'Omni Loop kit'),
  [`${SHIPPED}/0003-kit/release.md`]: note(3, 'Install the delivery loop in any repository', 'The kit packages the loop.', '0.0.1'),
  [`${SHIPPED}/0262-release-notes/spec.md`]: spec(262, 'Release notes'),
  [`${SHIPPED}/0262-release-notes/release.md`]: note(262, 'Know what shipped, week by week', 'A public page lists every release.'),
  [`${SHIPPED}/0270-next/spec.md`]: spec(270, 'The next PRD, without a note'),
};

describe('syncReleases — one run', () => {
  it('inserts each newly shipped PRD and refreshes a changed text, printing each PRD it wrote', async () => {
    const root = checkout(FILES);
    const stored = { prd: parsePrd(3), release: 1, released_at: '2026-09-27T10:00:00+00:00', title: 'An older title', description: 'The kit packages the loop.' };
    const { table, written } = memoryTable([stored]);
    const { out, err, print } = streams();

    expect(await syncReleases({ root, table, ...print })).toBe(0);

    expect(written).toEqual(['insert 262 2', 'insert 270 3', 'refresh 3']);
    expect(out).toEqual([
      'inserted PRD 262 as 0.0.2, on main since 2026-09-28T11:15:00+02:00: Know what shipped, week by week',
      'inserted PRD 270 as 0.0.3, on main since 2026-09-28T11:15:00+02:00: The next PRD, without a note',
      'updated PRD 3 (0.0.1): Install the delivery loop in any repository',
      'releases: 2 inserted, 1 updated, 0 unchanged',
    ]);
    expect(err).toEqual([]);
  });

  it('writes nothing and says so when the table already holds every release', async () => {
    const root = checkout({ [`${SHIPPED}/0270-next/spec.md`]: spec(270, 'The next PRD') });
    const { table, written } = memoryTable([{ prd: parsePrd(270), release: 2, released_at: '2026-09-28T09:15:00+00:00', title: 'The next PRD', description: '' }]);
    const { out, print } = streams();
    expect(await syncReleases({ root, table, ...print })).toBe(0);
    expect(written).toEqual([]);
    expect(out).toEqual(['releases: 0 inserted, 0 updated, 1 unchanged']);
  });

  it('writes nothing, and exits non-zero, when a note breaks the rules', async () => {
    const root = checkout({ ...FILES, [`${SHIPPED}/0262-release-notes/release.md`]: note(262, 'Know what shipped.', 'Fine.') });
    const { table, written } = memoryTable([]);
    const { err, print } = streams();
    expect(await syncReleases({ root, table, ...print })).toBe(1);
    expect(written).toEqual([]);
    expect(err).toEqual([
      `${SHIPPED}/0262-release-notes/release.md: title ends with a full stop`,
      'releases: nothing written — fix the lines above by pull request, then sync again',
    ]);
  });

  it('exits non-zero when Supabase refuses, saying why', async () => {
    const root = checkout(FILES);
    for (const refuse of [{ rows: 'Supabase refused to read the releases: JWT expired' }, { insert: 'Supabase refused to add 3 releases: permission denied' }]) {
      const { table } = memoryTable([], refuse);
      const { err, print } = streams();
      expect(await syncReleases({ root, table, ...print })).toBe(1);
      expect(err).toEqual([`releases: ${Object.values(refuse)[0]}`]);
    }
  });

  it('prints a shipped folder main does not hold yet, and carries on', async () => {
    const root = checkout(FILES);
    mkdirSync(join(root, `${SHIPPED}/0300-local`), { recursive: true });
    writeFileSync(join(root, `${SHIPPED}/0300-local/spec.md`), spec(300, 'Local'));
    const { table, written } = memoryTable([]);
    const { out, print } = streams();
    expect(await syncReleases({ root, table, ...print })).toBe(0);
    expect(written).toEqual(['insert 3 1', 'insert 262 2', 'insert 270 3']);
    expect(out[0]).toBe(`${SHIPPED}/0300-local: not on main yet — its spec.md is in no commit of this checkout`);
  });
});

describe('the credentials', () => {
  it('are SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: each one unset or empty is named', () => {
    const service = (source: Record<string, string>) => readEnv(source).serviceRole;
    expect(missingVariables(service({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_SERVICE_ROLE_KEY: 'key' }))).toEqual([]);
    expect(() => service({ SUPABASE_URL: 'http://127.0.0.1:54321' })).toThrow(/SUPABASE_SERVICE_ROLE_KEY is not set while SUPABASE_URL is/);
    const publicPair = { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon' };
    expect(missingVariables(service({ SUPABASE_SERVICE_ROLE_KEY: 'key', ...publicPair }))).toEqual(['SUPABASE_URL']);
    expect(missingVariables(service({ SUPABASE_URL: ' ', SUPABASE_SERVICE_ROLE_KEY: '' }))).toEqual(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('stop the run before it connects when one is missing', async () => {
    const { err, print } = streams();
    let connected = false;
    const code = await releasesSync({ service: readEnv({ SUPABASE_SERVICE_ROLE_KEY: 'key' }).serviceRole, root: '/nowhere', connect: () => { connected = true; return memoryTable([]).table; }, ...print });
    expect(code).toBe(1);
    expect(connected).toBe(false);
    expect(err).toEqual(['releases:sync needs SUPABASE_URL: set it (locally, `npx supabase status` prints it; in Actions, the releases workflow sets it)']);
  });
});

describe('pnpm releases:sync', () => {
  const repository = fileURLToPath(new URL('../../../../', import.meta.url));

  it('is the root script that runs the sync, with the settings the game scripts read', async () => {
    const { readFileSync } = await import('node:fs');
    const { scripts } = z.object({ scripts: z.record(z.string(), z.string()) }).parse(JSON.parse(readFileSync(join(repository, 'package.json'), 'utf8')));
    expect(scripts['releases:sync']).toBe('node --env-file-if-exists=apps/galaxy/.env.local apps/galaxy/scripts/releases-sync.ts');
  });

  it('loads on plain Node and names the missing credential, exiting non-zero', () => {
    const run = spawnSync(process.execPath, ['apps/galaxy/scripts/releases-sync.ts'], {
      cwd: repository, encoding: 'utf8', env: { PATH: process.env.PATH, NODE_ENV: 'test', SUPABASE_SERVICE_ROLE_KEY: 'key' },
    });
    expect(run.stderr).toContain('releases:sync needs SUPABASE_URL');
    expect(run.status).toBe(1);
  });
});
