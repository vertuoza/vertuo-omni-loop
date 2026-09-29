// pnpm game:contributions (PRD 328): its run, with gh and the REST client injected — gh answers from a
// small world of repositories, as game/dossiers/fake-github.mjs does, and Supabase is the fake
// PostgREST; then the script itself, as a process, with the same fake gh on PATH and the fake
// PostgREST behind a local server. Nothing here reaches GitHub or Supabase.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runContributions, windowStart, WINDOW_DAYS } from './contributions.mjs';
import { supabaseRest } from '../sources/supabase.mjs';
import { fakeSupabase, serveFake } from '../test/fake-supabase.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const VERTUOZA = 'a0000000-0000-4000-8000-000000000001';
const ACME = 'b0000000-0000-4000-8000-000000000002';
const NOW = new Date('2026-09-28T16:00:00Z'); // the window opens 40 days before: 2026-08-19T16:00:00Z
const KEY = 'workspace_id,kind,repo,number';

/**
 * A fake `gh` for the three reads the command makes of each repository: its default branch, its pull
 * requests merged into a base, and its issues under a label. It answers from `world`, as GitHub would:
 * a pull request only under the base it merged into, an issue only under a label it carries, and the
 * search's date qualifier to the day, so an item a few hours before the window's first instant still
 * comes back. An unknown repository, or one marked unreadable, fails as gh does. Self-contained, so the
 * process test can write it out as the source of an executable `gh`.
 *
 * world: { 'owner/name': { branch?: 'main', merged?: [{ number, author, mergedAt, base? }],
 *          issues?: [{ number, author, createdAt, labels? }], unreadable?: true, unreadableIssues?: true } }
 */
function answerGh(world, args) {
  const notFound = (what) => Object.assign(new Error(`Command failed: gh ${what}\ngh: Not Found (HTTP 404)`), { stderr: 'gh: Not Found (HTTP 404)\n' });
  const unknown = () => new Error(`the fake gh does not know: ${args.join(' ')}`);
  const flag = (name) => {
    const at = args.indexOf(name);
    return at < 0 ? undefined : args[at + 1];
  };
  const onOrAfter = (qualifier, search, at) => {
    const day = new RegExp(`^${qualifier}:>=(\\d{4}-\\d{2}-\\d{2})$`).exec(search ?? '');
    if (!day) throw unknown();
    return String(at).slice(0, 10) >= day[1];
  };
  const [verb, sub] = args;
  if (verb === 'api') {
    const slug = /^repos\/([^/]+\/[^/?]+)$/.exec(sub ?? '')?.[1];
    if (!slug || args.slice(2).join(' ') !== '--jq .default_branch') throw unknown();
    const repo = world[slug];
    if (!repo || repo.unreadable) throw notFound(`api ${sub}`);
    return `${repo.branch ?? 'main'}\n`;
  }
  const slug = flag('-R');
  const repo = world[slug];
  if (verb === 'pr' && sub === 'list' && flag('--state') === 'merged' && flag('--json') === 'number,author,mergedAt' && flag('--base')) {
    if (!repo || repo.unreadable) throw notFound(`pr list -R ${slug}`);
    const base = flag('--base');
    const merged = (repo.merged ?? []).filter((pr) => (pr.base ?? repo.branch ?? 'main') === base && onOrAfter('merged', flag('--search'), pr.mergedAt));
    return JSON.stringify(merged.map(({ number, author, mergedAt }) => ({ number, author, mergedAt })));
  }
  if (verb === 'issue' && sub === 'list' && flag('--state') === 'all' && flag('--json') === 'number,author,createdAt' && flag('--label')) {
    if (!repo || repo.unreadable || repo.unreadableIssues) throw notFound(`issue list -R ${slug}`);
    const label = flag('--label');
    const issues = (repo.issues ?? []).filter((i) => (i.labels ?? ['omni:prd']).includes(label) && onOrAfter('created', flag('--search'), i.createdAt));
    return JSON.stringify(issues.map(({ number, author, createdAt }) => ({ number, author, createdAt })));
  }
  throw unknown();
}

function fakeGh(world) {
  const calls = [];
  const exec = async (args) => {
    calls.push(args.join(' '));
    return answerGh(world, args);
  };
  return { exec, calls };
}

const person = (login) => ({ id: `U_${login}`, is_bot: false, login, name: '' });

// Vertuoza's sectors hold three repositories: vertuo-core and vertuo-flow read, vertuo-api does not.
const world = () => ({
  'vertuoza/vertuo-core': {
    branch: 'main',
    merged: [
      { number: 41, author: person('Alice'), mergedAt: '2026-09-27T22:30:00Z' },
      { number: 40, author: person('bob'), mergedAt: '2026-09-01T08:00:00Z' },
      { number: 39, author: null, mergedAt: '2026-09-02T08:00:00Z' }, // a deleted account
      { number: 38, author: person('alice'), mergedAt: '2026-09-26T09:00:00Z', base: 'feat/rockets' }, // a sub-PR
      { number: 12, author: person('alice'), mergedAt: '2026-08-19T15:00:00Z' }, // an hour before the window
      { number: 5, author: person('alice'), mergedAt: '2026-08-01T08:00:00Z' },
    ],
    issues: [
      { number: 328, author: person('Pierre-D'), createdAt: '2026-09-28T07:00:00Z' },
      { number: 330, author: person('bob'), createdAt: '2026-09-28T08:00:00Z', labels: ['bug'] },
    ],
  },
  'vertuoza/vertuo-flow': {
    branch: 'develop',
    merged: [{ number: 7, author: { id: 'B_1', is_bot: true, login: 'app/dependabot', name: '' }, mergedAt: '2026-09-20T10:00:00Z' }],
    issues: [
      { number: 3, author: person('CAROL'), createdAt: '2026-09-05T12:00:00Z' },
      { number: 4, author: { id: '', is_bot: false, login: '', name: '' }, createdAt: '2026-09-06T12:00:00Z' }, // no login: a deleted account
    ],
  },
  'vertuoza/vertuo-api': { unreadable: true },
});

const tablesOf = () => ({
  sectors: [
    { workspace_id: VERTUOZA, name: 'core-belt', repos: ['vertuo-core', 'vertuo-api'] },
    { workspace_id: VERTUOZA, name: 'flow-rim', repos: ['vertuo-flow', 'vertuo-core'] }, // a repository two sectors name is read once
    { workspace_id: ACME, name: 'dust-belt', repos: ['acme-api'] },
  ],
  teams: [],
  players: [],
  contributions: [],
});

// What Vertuoza's world holds within the window, as rows: sorted by kind, repository and number.
const EXPECTED = [
  { workspace_id: VERTUOZA, kind: 'pr-merged', repo: 'vertuo-core', number: 40, login: 'bob', at: '2026-09-01T08:00:00Z' },
  { workspace_id: VERTUOZA, kind: 'pr-merged', repo: 'vertuo-core', number: 41, login: 'alice', at: '2026-09-27T22:30:00Z' },
  { workspace_id: VERTUOZA, kind: 'pr-merged', repo: 'vertuo-flow', number: 7, login: 'app/dependabot', at: '2026-09-20T10:00:00Z' },
  { workspace_id: VERTUOZA, kind: 'prd-opened', repo: 'vertuo-core', number: 328, login: 'pierre-d', at: '2026-09-28T07:00:00Z' },
  { workspace_id: VERTUOZA, kind: 'prd-opened', repo: 'vertuo-flow', number: 3, login: 'carol', at: '2026-09-05T12:00:00Z' },
];

const restOn = (fake) => supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch });
const posts = (fake) => fake.calls.filter((c) => c.method === 'POST');
const quiet = () => {
  const lines = [];
  return { log: (line) => lines.push(line), lines };
};
const run = (fake, gh, over = {}) => runContributions({ exec: gh.exec, rest: restOn(fake), workspaceId: VERTUOZA, org: 'vertuoza', now: NOW, log: quiet().log, ...over });

describe('the window', () => {
  it('opens 40 days before now', () => {
    expect(WINDOW_DAYS).toBe(40);
    expect(windowStart(NOW).toISOString()).toBe('2026-08-19T16:00:00.000Z');
  });
});

describe('runContributions', () => {
  it('reads each repository of the workspace\'s sectors under its GitHub organisation: its default branch, its pull requests merged into it and its omni:prd issues, since the window opened', async () => {
    const gh = fakeGh(world());
    await run(fakeSupabase(tablesOf()), gh);
    const reads = (repo, branch) => [
      `api repos/vertuoza/${repo} --jq .default_branch`,
      `pr list -R vertuoza/${repo} --base ${branch} --state merged --search merged:>=2026-08-19 --limit 1000 --json number,author,mergedAt`,
      `issue list -R vertuoza/${repo} --label omni:prd --state all --search created:>=2026-08-19 --limit 1000 --json number,author,createdAt`,
    ];
    expect(gh.calls).toEqual([
      ...reads('vertuo-core', 'main'),
      reads('vertuo-api', 'main')[0],
      ...reads('vertuo-flow', 'develop'),
    ]);
  });

  it('upserts one row per merged pull request and per PRD issue in one request, keyed by workspace, kind, repository and number, with the author\'s login in lower case', async () => {
    const fake = fakeSupabase(tablesOf());
    const report = await run(fake, fakeGh(world()));

    expect(report.rows).toEqual(EXPECTED);
    expect(posts(fake)).toHaveLength(1);
    const [write] = posts(fake);
    expect(write.table).toBe('contributions');
    expect(write.url.searchParams.get('on_conflict')).toBe(KEY);
    expect(write.headers.Prefer).toMatch(/resolution=merge-duplicates/);
    expect(write.body).toEqual(EXPECTED);
    expect(fake.tables.contributions).toEqual(EXPECTED);
  });

  it('never writes a sub-PR, an issue without the label, an item with no author, or one merged or opened before the window', async () => {
    const fake = fakeSupabase(tablesOf());
    await run(fake, fakeGh(world()));
    const keys = fake.tables.contributions.map((r) => `${r.repo}#${r.number}`);
    for (const left of ['vertuo-core#38', 'vertuo-core#330', 'vertuo-core#39', 'vertuo-flow#4', 'vertuo-core#12', 'vertuo-core#5']) {
      expect(keys).not.toContain(left);
    }
  });

  it('skips a repository it cannot read, logs it, and still writes the others', async () => {
    const fake = fakeSupabase(tablesOf());
    const { log, lines } = quiet();
    const report = await run(fake, fakeGh(world()), { log });
    expect(report.skipped).toEqual([{ repo: 'vertuo-api', why: 'gh: Not Found (HTTP 404)' }]);
    expect(lines).toEqual(['vertuoza/vertuo-api skipped: gh: Not Found (HTTP 404)']);
    expect(report.read).toEqual([
      { repo: 'vertuo-core', merged: 2, opened: 1 },
      { repo: 'vertuo-flow', merged: 1, opened: 1 },
    ]);
    expect(fake.tables.contributions).toEqual(EXPECTED);
  });

  it('keeps nothing of a repository whose second read fails', async () => {
    const fake = fakeSupabase(tablesOf());
    const broken = { ...world(), 'vertuoza/vertuo-flow': { ...world()['vertuoza/vertuo-flow'], unreadableIssues: true } };
    const report = await run(fake, fakeGh(broken));
    expect(report.skipped.map((s) => s.repo)).toEqual(['vertuo-api', 'vertuo-flow']);
    expect(fake.tables.contributions).toEqual(EXPECTED.filter((r) => r.repo === 'vertuo-core'));
  });

  it('skips a repository whose answer does not read, rather than guess', async () => {
    const fake = fakeSupabase(tablesOf());
    const exec = async (args) => (args[0] === 'pr' && args.includes('vertuoza/vertuo-flow') ? 'not json' : answerGh(world(), args));
    const report = await run(fake, { exec });
    expect(report.skipped.map((s) => s.repo)).toEqual(['vertuo-api', 'vertuo-flow']);
    expect(fake.tables.contributions.map((r) => r.repo)).not.toContain('vertuo-flow');
  });

  it('writes identical rows when run again on the same outputs, and leaves a row outside the window as it is', async () => {
    const old = { workspace_id: VERTUOZA, kind: 'pr-merged', repo: 'vertuo-core', number: 2, login: 'alice', at: '2026-07-01T08:00:00Z', seen_at: '2026-07-01T08:15:00Z' };
    const fake = fakeSupabase({ ...tablesOf(), contributions: [{ ...old }] });
    await run(fake, fakeGh(world()));
    const first = structuredClone(fake.tables.contributions);
    await run(fake, fakeGh(world()));

    const [one, two] = posts(fake);
    expect(two.body).toEqual(one.body);
    expect(fake.tables.contributions).toEqual(first);
    expect(fake.tables.contributions).toEqual([old, ...EXPECTED]);
  });

  it('reads only the named workspace\'s sectors, and writes only its rows', async () => {
    const theirs = { workspace_id: ACME, kind: 'pr-merged', repo: 'vertuo-core', number: 41, login: 'mallory', at: '2026-09-27T22:30:00Z' };
    const fake = fakeSupabase({ ...tablesOf(), contributions: [{ ...theirs }] });
    const gh = fakeGh(world());
    await run(fake, gh);
    for (const read of fake.calls.filter((c) => c.method === 'GET')) {
      expect(read.url.searchParams.get('workspace_id'), read.table).toBe(`eq.${VERTUOZA}`);
    }
    expect(gh.calls.join('\n')).not.toContain('acme');
    expect(posts(fake)[0].body.every((r) => r.workspace_id === VERTUOZA)).toBe(true);
    expect(fake.tables.contributions.find((r) => r.workspace_id === ACME)).toEqual(theirs);
  });

  it('writes nothing when no repository holds anything within the window', async () => {
    const fake = fakeSupabase(tablesOf());
    const report = await run(fake, fakeGh({ 'vertuoza/vertuo-core': {}, 'vertuoza/vertuo-flow': {} }));
    expect(report.rows).toEqual([]);
    expect(posts(fake)).toEqual([]);
  });

  it('fails, writing nothing and asking nothing of GitHub, when the sectors cannot be read', async () => {
    const fake = fakeSupabase(tablesOf(), { failOn: 'sectors' });
    const gh = fakeGh(world());
    await expect(run(fake, gh)).rejects.toThrow(/read sectors failed/);
    expect(gh.calls).toEqual([]);
    expect(posts(fake)).toEqual([]);
  });

  it('fails when the rows cannot be written', async () => {
    const fake = fakeSupabase(tablesOf(), { failOn: 'contributions' });
    await expect(run(fake, fakeGh(world()))).rejects.toThrow(/write contributions failed \(503/);
  });

  it('refuses to run without a workspace or a GitHub organisation, before any call', async () => {
    for (const over of [{ workspaceId: undefined }, { org: null }]) {
      const fake = fakeSupabase(tablesOf());
      const gh = fakeGh(world());
      await expect(run(fake, gh, over)).rejects.toThrow(over.org === null ? /github_org/ : /workspace/);
      expect(fake.calls).toEqual([]);
      expect(gh.calls).toEqual([]);
    }
  });
});

describe('pnpm game:contributions, as a process', () => {
  let server, tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'omni-contributions-'));
  });
  afterEach(async () => {
    await server?.close();
    server = null;
    rmSync(tmp, { recursive: true, force: true });
  });

  const workspaces = [
    { id: VERTUOZA, slug: 'vertuoza', name: 'Vertuoza', github_org: 'vertuoza', plan_repo: 'vertuo-omni-loop', theme: {}, created_at: '2026-09-26T12:00:00+00:00' },
    { id: ACME, slug: 'acme', name: 'Acme', github_org: null, plan_repo: null, theme: {}, created_at: '2026-09-27T12:00:00+00:00' },
  ];
  // The process reads the clock: its world is dated from now.
  const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const liveWorld = () => ({
    'vertuoza/vertuo-core': {
      merged: [{ number: 41, author: person('Alice'), mergedAt: ago(3) }],
      issues: [{ number: 328, author: person('Pierre-D'), createdAt: ago(30) }],
    },
    'vertuoza/vertuo-api': { unreadable: true },
  });

  async function contributions(args, { env = {}, gh = liveWorld() } = {}) {
    writeFileSync(join(tmp, 'gh'), `#!/usr/bin/env node
const answer = ${answerGh.toString()};
try {
  process.stdout.write(answer(${JSON.stringify(gh)}, process.argv.slice(2)));
} catch (err) {
  process.stderr.write(err.stderr ?? err.message + '\\n');
  process.exit(1);
}
`);
    chmodSync(join(tmp, 'gh'), 0o755);
    try {
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(here, 'contributions.mjs'), ...args], {
        cwd: tmp,
        env: { PATH: `${tmp}:${dirname(process.execPath)}:${process.env.PATH}`, SUPABASE_URL: server.url, SUPABASE_SERVICE_ROLE_KEY: 'k', ...env },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      return { code: err.code, stdout: err.stdout, stderr: err.stderr };
    }
  }

  it('writes the workspace OMNI_LOOP_WORKSPACE names, logs the repository it skipped, and exits 0', async () => {
    server = await serveFake({ workspaces, sectors: [{ workspace_id: VERTUOZA, name: 'core-belt', repos: ['vertuo-core', 'vertuo-api'] }], teams: [], players: [], contributions: [] });
    const done = await contributions([], { env: { OMNI_LOOP_WORKSPACE: 'vertuoza' } });
    expect(done.code, done.stderr).toBe(0);
    expect(done.stderr).toContain('vertuoza/vertuo-api skipped: gh: Not Found (HTTP 404)');
    expect(done.stdout).toMatch(/vertuoza: 1 of 2 repositories read · 1 merged pull request · 1 PRD issue · written to contributions/);
    expect(server.tables.contributions.map((r) => [r.kind, r.repo, r.number, r.login])).toEqual([
      ['pr-merged', 'vertuo-core', 41, 'alice'],
      ['prd-opened', 'vertuo-core', 328, 'pierre-d'],
    ]);
  });

  it('exits 1 and writes nothing when the rows cannot be written', async () => {
    server = await serveFake({ workspaces, sectors: [{ workspace_id: VERTUOZA, name: 'core-belt', repos: ['vertuo-core'] }], teams: [], players: [] }, { failOn: 'contributions' });
    const done = await contributions(['--workspace', 'vertuoza']);
    expect(done.code).toBe(1);
    expect(done.stderr).toMatch(/write contributions failed \(503/);
  });

  it('exits 1 for a workspace that names no GitHub organisation, before reading GitHub', async () => {
    server = await serveFake({ workspaces, sectors: [], teams: [], players: [] });
    const done = await contributions(['--workspace', 'acme']);
    expect(done.code).toBe(1);
    expect(done.stderr).toMatch(/workspace "acme" has no github_org/);
    expect(server.calls.filter((c) => c.table !== 'workspaces')).toEqual([]);
  });

  it('stops, naming both ways to name a workspace, when neither is set', async () => {
    server = await serveFake({ workspaces });
    const done = await contributions([]);
    expect(done.code).toBe(2);
    expect(done.stderr).toMatch(/no workspace named: pass --workspace <slug>, or set OMNI_LOOP_WORKSPACE/);
    expect(server.calls).toEqual([]);
  });
});
