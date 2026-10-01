// @ts-nocheck
// `pnpm game:dossiers` run as a process: Supabase is the fake PostgREST behind a local server and gh
// is the fake GitHub on PATH, so nothing here reaches GitHub or Supabase.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDossiers } from './fake-supabase.ts';
import { ghScript } from './fake-github.ts';

const script = join(dirname(fileURLToPath(import.meta.url)), '../cli/dossiers.ts');
const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const BARE = 'c0000000-0000-4000-8000-000000000003';
const COMMIT = 'c1000000000000000000000000000000000000c1';
const SPEC = '---\nprd: 7\ntitle: Rockets\n---\n# Rockets\n';

let server, tmp, world;
beforeEach(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'omni-dossiers-'));
  writeFileSync(join(tmp, 'fake-gh.mjs'), ghScript());
  writeFileSync(join(tmp, 'gh'), `#!/bin/sh\nexec "${process.execPath}" "${join(tmp, 'fake-gh.mjs')}" "$@"\n`);
  chmodSync(join(tmp, 'gh'), 0o755);
  writeFileSync(join(tmp, 'gh.log'), '');
  world = {
    'vertuoza/vertuo-core': { commit: COMMIT, files: { 'README.md': '# core\n' } },
    'vertuoza/vertuo-omni-plan': {
      commit: COMMIT,
      files: {
        '.omni-loop/config.yml': 'kit: 1\nask:\n  url: https://ask.example.com\ndossier:\n  enabled: true\n',
        '.omni-loop/delivery/shipped/0007-rockets/spec.md': SPEC,
      },
    },
  };
  server = await serveDossiers({
    workspaces: [
      { id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-plan' },
      { id: BARE, slug: 'bare', name: 'Bare', github_org: null, plan_repo: null },
    ],
    sectors: [{ workspace_id: VERTUOZA, name: 'core', repos: ['vertuo-core'] }],
    teams: [{ workspace_id: VERTUOZA, name: 'beaver', home: 'core', label: 'BEAVER', color: '#d08a4a', motto: '', mascot: 'beaver', sort: 10, retired_at: null }],
    players: [],
  });
});
afterEach(async () => {
  await server.close();
  rmSync(tmp, { recursive: true, force: true });
});

async function dossiers(args, env = {}) {
  writeFileSync(join(tmp, 'world.json'), JSON.stringify(world));
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [script, ...args], {
      cwd: tmp,
      env: {
        PATH: `${tmp}:${dirname(process.execPath)}:${process.env.PATH}`,
        SUPABASE_URL: server.url,
        SUPABASE_SERVICE_ROLE_KEY: 'k',
        FAKE_GH_LOG: join(tmp, 'gh.log'),
        FAKE_GH_WORLD: join(tmp, 'world.json'),
        ...env,
      },
    });
    return { code: 0, stdout, stderr };
  } catch (err) {
    return { code: err.code, stdout: err.stdout, stderr: err.stderr };
  }
}
const ghCalls = () => readFileSync(join(tmp, 'gh.log'), 'utf8').split('\n').filter(Boolean);

describe('pnpm game:dossiers', () => {
  it('names its workspace like every game script: none named stops it before any read', async () => {
    const run = await dossiers([]);
    expect(run.code).toBe(2);
    expect(run.stderr).toMatch(/no workspace named: pass --workspace <slug>, or set OMNI_LOOP_WORKSPACE\nusage: game:dossiers --workspace <slug>/);
    expect(server.calls).toEqual([]);
    expect(ghCalls()).toEqual([]);
  });

  it('stops on a workspace it cannot read, or one that names no GitHub organisation', async () => {
    expect((await dossiers(['--workspace', 'ghost'])).stderr).toMatch(/no workspace "ghost"/);
    const bare = await dossiers([], { OMNI_LOOP_WORKSPACE: 'bare' });
    expect(bare.code).toBe(1);
    expect(bare.stderr).toMatch(/workspace "bare" has no github_org/);
    expect(ghCalls()).toEqual([]);
  });

  it('reads every sector repository and the plan repository, creates the dossiers, and adds nothing the second time', async () => {
    const first = await dossiers([], { OMNI_LOOP_WORKSPACE: 'vertuoza' });
    expect(first.code, first.stderr).toBe(0);
    expect(first.stdout).toContain('  - skipped vertuoza/vertuo-core: no .omni-loop/config.yml on main');
    expect(first.stdout).toContain('vertuoza/vertuo-omni-plan @ c1000000 (main): 1 PRD folder · 1 dossier created · 1 file fetched · added: #7 spec v1');
    expect(first.stdout.trim().split('\n').at(-1)).toBe('dossiers: 1 of 2 repositories read · 1 created · 1 version added');
    expect(server.tables.dossiers).toEqual([expect.objectContaining({ workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-plan', prd: 7, title: 'Rockets' })]);
    expect(server.tables.dossier_versions).toEqual([expect.objectContaining({ kind: 'spec', content: SPEC, source: 'github', commit_sha: COMMIT })]);

    const blobs = () => ghCalls().filter((c) => c.includes('/git/blobs/')).length;
    expect(blobs()).toBe(1);
    const second = await dossiers([], { OMNI_LOOP_WORKSPACE: 'vertuoza' });
    expect(second.code, second.stderr).toBe(0);
    expect(second.stdout.trim().split('\n').at(-1)).toBe('dossiers: 1 of 2 repositories read · 0 created · 0 versions added');
    expect(blobs()).toBe(1);
    expect(server.tables.dossier_versions).toHaveLength(1);
  });
});
