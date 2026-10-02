// pnpm game:contributions (PRD 328): its run, with gh and the REST client injected — gh answers from a
// small world of repositories, as game/dossiers/fake-github.ts does, and Supabase is the fake
// PostgREST; then the script itself, as a process, with the same fake gh on PATH and the fake
// PostgREST behind a local server. Nothing here reaches GitHub or Supabase.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runContributions, windowStart, WINDOW_DAYS } from './contributions.ts';
import { supabaseRest } from '../sources/supabase.ts';
import { fakeSupabase, serveFake, type Call, type Init, type Reply, type Row, type Served } from '../test/fake-supabase.ts';
import type { Exec } from '../sources/github.ts';
import { nth, present } from '../test/present.ts';
import { assertDefined } from '../../kit/test/assert.ts';

type Person = { id: string; is_bot: boolean; login: string; name: string } | null;
type MergedPr = { number: number; author: Person; mergedAt: string; base?: string; labels?: string[]; body?: string | null };
type PrdIssue = { number: number; author: Person; createdAt: string; labels?: string[] };
type FakeRepo = { branch?: string; merged?: MergedPr[]; issues?: PrdIssue[]; older?: PrdIssue[]; unreadable?: boolean; unreadableIssues?: boolean; unreadablePrds?: number[] };
type GhWorld = Record<string, FakeRepo>;

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
 * A merged pull request comes with its labels' names and its body; one issue is viewed by number, among
 * the listed issues and the `older` ones the list's date search leaves out.
 *
 * world: { 'owner/name': { branch?: 'main', merged?: [{ number, author, mergedAt, base?, labels?, body? }],
 *          issues?: [{ number, author, createdAt, labels? }], older?: [{ number, author, createdAt }],
 *          unreadable?: true, unreadableIssues?: true, unreadablePrds?: [number] } }
 */
function answerGh(world: GhWorld, args: string[]): string {
  const notFound = (what: string) => Object.assign(new Error(`Command failed: gh ${what}\ngh: Not Found (HTTP 404)`), { stderr: 'gh: Not Found (HTTP 404)\n' });
  const unknown = () => new Error(`the fake gh does not know: ${args.join(' ')}`);
  const flag = (name: string) => {
    const at = args.indexOf(name);
    return at < 0 ? undefined : args[at + 1];
  };
  const onOrAfter = (qualifier: string, search: string | undefined, at: string) => {
    const day = new RegExp(`^${qualifier}:>=(\\d{4}-\\d{2}-\\d{2})$`).exec(search ?? '')?.[1];
    if (day === undefined) throw unknown();
    return at.slice(0, 10) >= day;
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
  const repo = world[slug ?? ''];
  if (verb === 'pr' && sub === 'list' && flag('--state') === 'merged' && flag('--json') === 'number,author,mergedAt,labels,body' && flag('--base')) {
    if (!repo || repo.unreadable) throw notFound(`pr list -R ${slug}`);
    const base = flag('--base');
    const merged = (repo.merged ?? []).filter((pr) => (pr.base ?? repo.branch ?? 'main') === base && onOrAfter('merged', flag('--search'), pr.mergedAt));
    return JSON.stringify(merged.map(({ number, author, mergedAt, labels = [], body = '' }) => ({
      number, author, mergedAt, labels: labels.map((name) => ({ id: `L_${name}`, name, description: '', color: 'ededed' })), body,
    })));
  }
  if (verb === 'issue' && sub === 'view' && flag('--json') === 'author') {
    const number = Number(args[2]);
    const issue = (repo?.issues ?? []).concat(repo?.older ?? []).find((i) => i.number === number);
    if (!repo || repo.unreadable || !issue || (repo.unreadablePrds ?? []).includes(number)) throw notFound(`issue view ${args[2]} -R ${slug}`);
    return JSON.stringify({ author: issue.author });
  }
  if (verb === 'issue' && sub === 'list' && flag('--state') === 'all' && flag('--json') === 'number,author,createdAt' && flag('--label')) {
    if (!repo || repo.unreadable || repo.unreadableIssues) throw notFound(`issue list -R ${slug}`);
    const label = flag('--label');
    const issues = (repo.issues ?? []).filter((i) => (i.labels ?? ['omni:prd']).includes(label ?? '') && onOrAfter('created', flag('--search'), i.createdAt));
    return JSON.stringify(issues.map(({ number, author, createdAt }) => ({ number, author, createdAt })));
  }
  throw unknown();
}

function fakeGh(world: GhWorld): { exec: Exec; calls: string[] } {
  const calls: string[] = [];
  // Answers at once, as an async function's body did; a read it does not know rejects.
  const exec: Exec = (args) => new Promise((resolve) => {
    calls.push(args.join(' '));
    resolve(answerGh(world, args));
  });
  return { exec, calls };
}

const person = (login: string): Person => ({ id: `U_${login}`, is_bot: false, login, name: '' });

// Vertuoza's sectors hold three repositories: vertuo-core and vertuo-flow read, vertuo-api does not.
const world = (): GhWorld => ({
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

const restOn = (fake: { fetch: (href: string, init?: Init) => Promise<Reply> }) => supabaseRest({ url: 'https://x.supabase.co', key: 'k', fetch: fake.fetch });
const posts = (fake: { calls: Call[] }) => fake.calls.filter((c) => c.method === 'POST');
const quiet = () => {
  const lines: string[] = [];
  return { log: (line: string) => lines.push(line), lines };
};
const run = (fake: { fetch: (href: string, init?: Init) => Promise<Reply> }, gh: { exec: Exec }, over: Partial<Parameters<typeof runContributions>[0]> = {}) => runContributions({ exec: gh.exec, rest: restOn(fake), workspaceId: VERTUOZA, org: 'vertuoza', now: NOW, log: quiet().log, ...over });

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
    const reads = (repo: string, branch: string) => [
      `api repos/vertuoza/${repo} --jq .default_branch`,
      `pr list -R vertuoza/${repo} --base ${branch} --state merged --search merged:>=2026-08-19 --limit 1000 --json number,author,mergedAt,labels,body`,
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
    assertDefined(write, 'the write');
    expect(write.table).toBe('contributions');
    expect(write.url.searchParams.get('on_conflict')).toBe(KEY);
    expect(present(write.headers, 'headers').Prefer).toMatch(/resolution=merge-duplicates/);
    expect(write.body).toEqual(EXPECTED);
    expect(fake.tables.contributions).toEqual(EXPECTED);
  });

  it('never writes a sub-PR, an issue without the label, an item with no author, or one merged or opened before the window', async () => {
    const fake = fakeSupabase(tablesOf());
    await run(fake, fakeGh(world()));
    const keys = present(fake.tables.contributions, 'contributions').map((r) => `${String(r.repo)}#${String(r.number)}`);
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
      { repo: 'vertuo-core', merged: 2, opened: 1, started: 0, shipped: 0 },
      { repo: 'vertuo-flow', merged: 1, opened: 1, started: 0, shipped: 0 },
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
    const exec: Exec = (args) => new Promise((resolve) => { resolve(args[0] === 'pr' && args.includes('vertuoza/vertuo-flow') ? 'not json' : answerGh(world(), args)); });
    const report = await run(fake, { exec });
    expect(report.skipped.map((s) => s.repo)).toEqual(['vertuo-api', 'vertuo-flow']);
    expect(present(fake.tables.contributions, 'contributions').map((r) => r.repo)).not.toContain('vertuo-flow');
  });

  it('writes identical rows when run again on the same outputs, and leaves a row outside the window as it is', async () => {
    const old = { workspace_id: VERTUOZA, kind: 'pr-merged', repo: 'vertuo-core', number: 2, login: 'alice', at: '2026-07-01T08:00:00Z', seen_at: '2026-07-01T08:15:00Z' };
    const fake = fakeSupabase({ ...tablesOf(), contributions: [{ ...old }] });
    await run(fake, fakeGh(world()));
    const first = structuredClone(fake.tables.contributions);
    await run(fake, fakeGh(world()));

    const [one, two] = posts(fake);
    assertDefined(one, 'the first write');
    assertDefined(two, 'the second write');
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
    expect((nth(posts(fake), 0, 'the first post').body as Row[]).every((r) => r.workspace_id === VERTUOZA)).toBe(true);
    expect(present(fake.tables.contributions, 'contributions').find((r) => r.workspace_id === ACME)).toEqual(theirs);
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

describe('PRD stages', () => {
  // vertuo-core's PRD 328 was opened in the window; PRD 12 before it, so only `gh issue view` knows its author.
  const stages = (): GhWorld => ({
    'vertuoza/vertuo-core': {
      merged: [
        { number: 50, author: person('Bob'), mergedAt: '2026-09-20T10:00:00Z', labels: ['omni:phase-0'], body: 'The spec and the plan.\n\nRefs #328\n' },
        { number: 51, author: person('alice'), mergedAt: '2026-09-27T18:00:00Z', labels: ['omni:feature', 'omni:in-progress'], body: 'Closes #328' },
        { number: 52, author: person('alice'), mergedAt: '2026-09-02T08:00:00Z', labels: ['omni:phase-0'], body: 'Refs #12' },
        { number: 53, author: person('bob'), mergedAt: '2026-09-10T08:00:00Z', labels: ['omni:feature'], body: 'closes #12' },
        { number: 54, author: person('bob'), mergedAt: '2026-09-11T08:00:00Z', labels: ['omni:feature'], body: 'No link here.' },
        { number: 55, author: person('bob'), mergedAt: '2026-09-12T08:00:00Z', labels: ['omni:phase-0'], body: null },
        { number: 56, author: person('bob'), mergedAt: '2026-09-13T08:00:00Z', labels: [], body: 'Closes #328' },
      ],
      issues: [{ number: 328, author: person('Pierre-D'), createdAt: '2026-09-18T07:00:00Z' }],
      older: [{ number: 12, author: person('Carol'), createdAt: '2026-07-01T07:00:00Z' }],
    },
  });
  const oneRepo = () => ({ ...tablesOf(), sectors: [{ workspace_id: VERTUOZA, name: 'core-belt', repos: ['vertuo-core'] }] });
  const stageRows = (rows: Row[] | undefined) => present(rows, 'the rows').filter((r) => r.kind === 'prd-started' || r.kind === 'prd-shipped').map((r) => [r.kind, r.repo, r.number, r.login, r.at]);

  it('writes prd-started for a merged omni:phase-0 PR that refs a PRD, and prd-shipped for a merged omni:feature PR that closes one, credited to the PRD issue\'s author at the merge', async () => {
    const fake = fakeSupabase(oneRepo());
    const report = await run(fake, fakeGh(stages()));
    expect(stageRows(fake.tables.contributions)).toEqual([
      ['prd-shipped', 'vertuo-core', 12, 'carol', '2026-09-10T08:00:00Z'],
      ['prd-shipped', 'vertuo-core', 328, 'pierre-d', '2026-09-27T18:00:00Z'],
      ['prd-started', 'vertuo-core', 12, 'carol', '2026-09-02T08:00:00Z'],
      ['prd-started', 'vertuo-core', 328, 'pierre-d', '2026-09-20T10:00:00Z'],
    ]);
    expect(report.read).toEqual([{ repo: 'vertuo-core', merged: 7, opened: 1, started: 2, shipped: 2 }]);
  });

  it('reads a PRD\'s author from the listed omni:prd issues, else with gh issue view, once per PRD', async () => {
    const gh = fakeGh(stages());
    await run(fakeSupabase(oneRepo()), gh);
    const views = gh.calls.filter((c) => c.startsWith('issue view'));
    expect(views).toEqual(['issue view 12 -R vertuoza/vertuo-core --json author']);
  });

  it('writes no stage for a labelled PR with no link, nor for a linked PR with no stage label, and keeps every merge a pr-merged row', async () => {
    const fake = fakeSupabase(oneRepo());
    await run(fake, fakeGh(stages()));
    const merged = present(fake.tables.contributions, 'contributions').filter((r) => r.kind === 'pr-merged').map((r) => r.number);
    expect(merged).toEqual([50, 51, 52, 53, 54, 55, 56]);
    expect(present(fake.tables.contributions, 'contributions').filter((r) => r.kind === 'prd-opened').map((r) => r.number)).toEqual([328]);
    expect(stageRows(fake.tables.contributions).map((r) => r[2])).not.toContain(54);
  });

  it('skips and logs a PRD whose issue cannot be read, and still writes the rest', async () => {
    const fake = fakeSupabase(oneRepo());
    const { log, lines } = quiet();
    const world = { 'vertuoza/vertuo-core': { ...stages()['vertuoza/vertuo-core'], unreadablePrds: [12] } };
    const report = await run(fake, fakeGh(world), { log });
    expect(lines).toEqual(['vertuoza/vertuo-core PRD #12 skipped: gh: Not Found (HTTP 404)']);
    expect(report.skipped).toEqual([]);
    expect(stageRows(fake.tables.contributions).map((r) => [r[0], r[2]])).toEqual([['prd-shipped', 328], ['prd-started', 328]]);
    expect(present(fake.tables.contributions, 'contributions').filter((r) => r.kind === 'pr-merged')).toHaveLength(7);
  });

  it('writes no stage for a PRD whose author is a deleted account', async () => {
    const world = stages();
    present(world['vertuoza/vertuo-core'], 'the repository').older = [{ number: 12, author: null, createdAt: '2026-07-01T07:00:00Z' }];
    const fake = fakeSupabase(oneRepo());
    await run(fake, fakeGh(world));
    expect(stageRows(fake.tables.contributions).map((r) => r[2])).toEqual([328, 328]);
  });
});

describe('pnpm game:contributions, as a process', () => {
  let server: Served<Call> | null = null, tmp: string;
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
  const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const liveWorld = (): GhWorld => ({
    'vertuoza/vertuo-core': {
      merged: [{ number: 41, author: person('Alice'), mergedAt: ago(3) }],
      issues: [{ number: 328, author: person('Pierre-D'), createdAt: ago(30) }],
    },
    'vertuoza/vertuo-api': { unreadable: true },
  });

  async function contributions(args: string[], { env = {}, gh = liveWorld() }: { env?: Record<string, string>; gh?: GhWorld } = {}) {
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
      const { stdout, stderr } = await promisify(execFile)(process.execPath, [join(here, 'contributions.ts'), ...args], {
        cwd: tmp,
        env: { PATH: `${tmp}:${dirname(process.execPath)}:${process.env.PATH}`, SUPABASE_URL: present(server, 'the fake server').url, SUPABASE_SERVICE_ROLE_KEY: 'k', ...env },
      });
      return { code: 0, stdout, stderr };
    } catch (err) {
      const failed = err as { code: number; stdout: string; stderr: string };
      return { code: failed.code, stdout: failed.stdout, stderr: failed.stderr };
    }
  }

  it('writes the workspace OMNI_LOOP_WORKSPACE names, logs the repository it skipped, and exits 0', async () => {
    server = await serveFake({ workspaces, sectors: [{ workspace_id: VERTUOZA, name: 'core-belt', repos: ['vertuo-core', 'vertuo-api'] }], teams: [], players: [], contributions: [] });
    const done = await contributions([], { env: { OMNI_LOOP_WORKSPACE: 'vertuoza' } });
    expect(done.code, done.stderr).toBe(0);
    expect(done.stderr).toContain('vertuoza/vertuo-api skipped: gh: Not Found (HTTP 404)');
    expect(done.stdout).toMatch(/vertuoza: 1 of 2 repositories read · 1 merged pull request · 1 PRD issue · 0 PRD stages · written to contributions/);
    expect(present(server.tables.contributions, 'contributions').map((r) => [r.kind, r.repo, r.number, r.login])).toEqual([
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
