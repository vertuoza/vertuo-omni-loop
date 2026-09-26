// PRD #99, slices s3 and s4: `omni credits`, through `main()` on a fixture repository, with `gh`
// stubbed — the text report, `--repo`, `--since`, `--list`, `--json`, `signature: null`, a `gh` that
// cannot be read and the 1,000-result cap (AC 7 to AC 10). It never calls GitHub.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.mjs';
import { main } from './omni.mjs';

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n';
const TRAILER = 'Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const SIGNED_BODY = 'Part of #7\n\n🦸 Delivered by OmniMan, with Omni Loop <!-- omni-loop:signed -->';

function searched(number, { repo = 'acme/widgets', labels = [], ...overrides } = {}) {
  return {
    number,
    title: `PR ${number}`,
    state: 'merged',
    createdAt: '2026-08-10T09:00:00Z',
    labels: labels.map((name) => ({ name })),
    body: 'A plain body.',
    repository: { name: repo.split('/')[1], nameWithOwner: repo },
    author: { login: 'someone' },
    ...overrides,
  };
}

/**
 * A fake `execFileSync`: `git` runs for real (the fixture repository's root), and each `gh` call's
 * arguments, joined by spaces, are answered by the first route whose prefix they start with (an
 * Error is thrown). Unrouted searches answer `[]`.
 */
function fakeExec(routes = []) {
  const calls = [];
  const exec = (file, args, options) => {
    if (file === 'git') return execFileSync(file, args, options);
    calls.push(args.join(' '));
    const key = args.join(' ');
    for (const [prefix, out] of [...routes, ['search ', []]]) {
      if (!key.startsWith(prefix)) continue;
      if (out instanceof Error) throw out;
      return typeof out === 'string' ? out : JSON.stringify(out);
    }
    throw new Error(`fakeExec: unexpected call ${file} ${key}`);
  };
  return { exec, calls };
}

/** Runs `omni <argv>` in a fixture repository whose config is `config`: `{ code, out, err, calls }`. */
async function omni(argv, { config = CONFIG, routes = [] } = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const { exec, calls } = fakeExec(routes);
  const out = [];
  const err = [];
  const code = await main(argv, { cwd: root, exec, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, out: out.join(''), err: err.join(''), calls };
}

/** A small organisation: one pull request for each way of being his, plus ones that are not. */
const WORLD = [
  ['search prs --owner acme --label omni:phase-0', [searched(1, { labels: ['omni:phase-0'], createdAt: '2026-07-02T09:00:00Z' })]],
  ['search prs --owner acme --label omni:feature', [searched(2, { labels: ['omni:feature'], state: 'open', createdAt: '2026-08-01T09:00:00Z', body: SIGNED_BODY })]],
  ['search prs --owner acme --label omni:sub', [
    searched(3, { labels: ['omni:sub'], createdAt: '2026-08-02T09:00:00Z' }),
    searched(4, { labels: ['omni:sub'], createdAt: '2026-08-03T09:00:00Z', state: 'closed' }),
    searched(7, { repo: 'acme/gadgets', labels: ['omni:sub'], createdAt: '2026-09-01T09:00:00Z' }),
  ]],
  ['search prs --owner acme --match body', [
    searched(5, { createdAt: '2026-09-02T09:00:00Z', body: SIGNED_BODY }),
    searched(6, { createdAt: '2026-09-03T09:00:00Z', body: 'OmniMan, thanks.' }),
  ]],
  ['search commits --owner acme', [
    { sha: 'c8', commit: { message: `feat: eight (#8)\n\n${TRAILER}\n`, committer: { date: '2026-09-05T09:00:00Z' } }, repository: { fullName: 'acme/gadgets' } },
  ]],
  ['pr view 8 --repo acme/gadgets', { number: 8, title: 'Eight', state: 'MERGED', createdAt: '2026-09-04T09:00:00Z', labels: [], body: '', author: { login: 'pat' } }],
  ['search issues --owner acme --label omni:prd', [
    searched(20, { labels: ['omni:prd'], state: 'open', title: 'Issue 20', createdAt: '2026-07-01T09:00:00Z' }),
  ]],
  ['search issues --owner acme --match body', [
    searched(21, { state: 'closed', title: 'Issue 21', createdAt: '2026-09-10T09:00:00Z', body: SIGNED_BODY }),
    searched(22, { state: 'open', title: 'Issue 22', createdAt: '2026-09-11T09:00:00Z', body: 'Ask OmniMan.' }),
  ]],
  ['search issues --owner acme --app omni-loop-invader', [
    searched(30, { state: 'open', title: 'Retro', createdAt: '2026-09-15T09:00:00Z', author: { login: 'omni-loop-invader[bot]' } }),
  ]],
];

/** The report WORLD prints. */
const REPORT = [
  'OmniMan · acme · all time',
  'PRs        6    (merged 5 · open 1)       phase-0 1 · feature 1 · slices 2 · other 2',
  '  signed 3 · before signing 2 · missed 1',
  'PRD issues 2    signed 1 · before signing 1 · missed 0',
  'Opened by the app: 1 issue',
  'Co-authored commits on default branches: 1',
  'By repo    widgets 4 · gadgets 2',
  'By month   2026-07 1 · 2026-08 2 · 2026-09 3',
];

describe('omni credits', () => {
  it('prints the pull requests, the PRD issues, the app, the commits, by repository and by month (AC 7, AC 8)', async () => {
    const { code, out, err } = await omni(['credits'], { routes: WORLD });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe([...REPORT, ''].join('\n'));
  });

  it('--list adds one line per item, oldest first, after the report (AC 9)', async () => {
    const { code, out, err } = await omni(['credits', '--list'], { routes: WORLD });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe([
      ...REPORT,
      '',
      'widgets #20 prd     open   2026-07-01 before signing Issue 20',
      'widgets #1  phase-0 merged 2026-07-02 before signing PR 1',
      'widgets #2  feature open   2026-08-01 signed         PR 2',
      'widgets #3  slice   merged 2026-08-02 missed         PR 3',
      'gadgets #7  slice   merged 2026-09-01 before signing PR 7',
      'widgets #5  other   merged 2026-09-02 signed         PR 5',
      'gadgets #8  other   merged 2026-09-04 signed         Eight',
      'widgets #21 prd     closed 2026-09-10 signed         Issue 21',
      'widgets #30 issue   open   2026-09-15 by the app     Retro',
      '',
    ].join('\n'));
  });

  it('--json prints the whole report as one document: scope, totals, items and their reasons, commits, warnings (AC 9)', async () => {
    const { code, out, err } = await omni(['credits', '--json'], { routes: WORLD });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    const doc = JSON.parse(out);
    expect(Object.keys(doc)).toEqual(['name', 'scope', 'totals', 'items', 'commits', 'warnings']);
    expect(doc.name).toBe('OmniMan');
    expect(doc.scope).toEqual({ owner: 'acme', repo: null, since: null });
    expect(doc.totals).toMatchObject({
      prs: { total: 6, states: { merged: 5, open: 1 }, kinds: { 'phase-0': 1, feature: 1, slice: 2, other: 2 }, signatures: { signed: 3, 'before signing': 2, missed: 1 } },
      prdIssues: { total: 2, states: { open: 1, closed: 1 }, signatures: { signed: 1, 'before signing': 1, missed: 0 } },
      byTheApp: { issues: 1, prs: 0 },
      commits: 1,
      byRepo: [{ repo: 'acme/widgets', count: 4 }, { repo: 'acme/gadgets', count: 2 }],
    });
    expect(doc.items.map(({ type, repo, number, reasons, signature }) => `${type} ${repo}#${number} ${reasons.join('+')} ${signature}`)).toEqual([
      'issue acme/widgets#20 label before signing',
      'pr acme/widgets#1 label before signing',
      'pr acme/widgets#2 label+marker signed',
      'pr acme/widgets#3 label missed',
      'pr acme/gadgets#7 label before signing',
      'pr acme/widgets#5 marker signed',
      'pr acme/gadgets#8 commit signed',
      'issue acme/widgets#21 marker signed',
      'issue acme/widgets#30 author by the app',
    ]);
    expect(doc.items[0]).toEqual({
      type: 'issue', repo: 'acme/widgets', number: 20, title: 'Issue 20', kind: 'prd', state: 'open',
      createdAt: '2026-07-01T09:00:00Z', reasons: ['label'], signature: 'before signing',
    });
    expect(doc.commits).toEqual([{ repo: 'acme/gadgets', sha: 'c8', date: '2026-09-05T09:00:00Z', subject: 'feat: eight (#8)', pullRequest: 8 }]);
    expect(doc.warnings).toEqual([]);
  });

  it('--json carries the scope it was narrowed to, and the warnings in place of the stderr lines', async () => {
    const full = Array.from({ length: 1000 }, (_, index) => searched(index + 1, { repo: 'acme/gadgets', labels: ['omni:sub'], createdAt: '2026-09-02T09:00:00Z' }));
    const routes = [['search prs --repo acme/gadgets --label omni:sub', full]];
    const { code, out, err } = await omni(['credits', '--json', '--list', '--repo', 'acme/gadgets', '--since', '2026-09'], { routes });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    const doc = JSON.parse(out);
    expect(doc.scope).toEqual({ owner: 'acme', repo: 'acme/gadgets', since: '2026-09' });
    expect(doc.items).toHaveLength(1000);
    expect(doc.warnings).toEqual([
      "gh search prs --repo acme/gadgets --label omni:sub --created >=2026-09-01 hit GitHub's 1,000-result cap: some items may be missing; narrow it with --since or --repo.",
    ]);
  });

  it('--json with signature: null: no name, no signatures, no app and no commits read', async () => {
    const { code, out } = await omni(['credits', '--json'], { config: `${CONFIG}signature: null\n`, routes: WORLD });
    expect(code).toBe(0);
    const doc = JSON.parse(out);
    expect(doc.name).toBeNull();
    expect(doc.totals).toMatchObject({ byTheApp: null, commits: null, prdIssues: { total: 1 } });
    expect(doc.items.every((item) => item.signature === null)).toBe(true);
    expect(doc.commits).toEqual([]);
  });

  it('--repo narrows to one repository and --since to what was created from that month on (AC 9)', async () => {
    const routes = [
      ['search prs --repo acme/gadgets --label omni:sub --created >=2026-09-01', [searched(7, { repo: 'acme/gadgets', labels: ['omni:sub'], createdAt: '2026-09-01T09:00:00Z' })]],
    ];
    const { code, out, calls } = await omni(['credits', '--repo', 'acme/gadgets', '--since', '2026-09'], { routes });
    expect(code).toBe(0);
    expect(calls.every((call) => call.includes('--repo acme/gadgets'))).toBe(true);
    expect(calls.filter((call) => call.startsWith('search')).every((call) => /--(?:created|committer-date) >=2026-09-01/.test(call))).toBe(true);
    expect(out.split('\n').slice(0, 2)).toEqual([
      'OmniMan · acme/gadgets · since 2026-09',
      'PRs        1    (merged 1 · open 0)       phase-0 0 · feature 0 · slices 1 · other 0',
    ]);
  });

  it('with signature: null, still counts the labelled pull requests and issues, and says signing is off', async () => {
    const { code, out, calls } = await omni(['credits'], { config: `${CONFIG}signature: null\n`, routes: WORLD });
    expect(code).toBe(0);
    expect(calls.every((call) => call.includes('--label'))).toBe(true);
    expect(out).toBe([
      'Omni Loop · acme · all time',
      'PRs        4    (merged 3 · open 1)       phase-0 1 · feature 1 · slices 2 · other 0',
      '  signing is off in this repository',
      'PRD issues 1',
      'By repo    widgets 3 · gadgets 1',
      'By month   2026-07 1 · 2026-08 2 · 2026-09 1',
      '',
    ].join('\n'));
  });

  it('at the 1,000-result cap, prints the report and a warning naming the query (AC 10)', async () => {
    const full = Array.from({ length: 1000 }, (_, index) => searched(index + 1, { labels: ['omni:sub'] }));
    const { code, out, err } = await omni(['credits'], { routes: [['search prs --owner acme --label omni:sub', full]] });
    expect(code).toBe(0);
    expect(out).toMatch(/^PRs {8}1000 /m);
    expect(err).toBe("warning: gh search prs --owner acme --label omni:sub hit GitHub's 1,000-result cap: some items may be missing; narrow it with --since or --repo.\n");
  });

  const unreadable = [
    ['missing', Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' }), 'omni credits: gh is not installed'],
    ['logged out', Object.assign(new Error('Command failed'), { status: 4, stderr: 'To get started with GitHub CLI, please run:  gh auth login\n' }), 'omni credits: gh is not logged in'],
    ['rate limited', Object.assign(new Error('Command failed'), { status: 1, stderr: 'HTTP 403: API rate limit exceeded for user ID 1.\n' }), "omni credits: GitHub's rate limit"],
  ];

  it.each(unreadable)('gh %s: exits 2 with one line saying so, and prints no report (AC 10)', async (_, error, said) => {
    const { code, out, err } = await omni(['credits'], { routes: [['search', error]] });
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err.split('\n').filter(Boolean)).toHaveLength(1);
    expect(err.startsWith(said)).toBe(true);
  });

  it('gh missing while reading the login of github.user: exits 2 with one line', async () => {
    const config = `${CONFIG}github:\n  user: robot\n`;
    const { code, err } = await omni(['credits'], { config, routes: [['auth token', Object.assign(new Error('spawnSync gh ENOENT'), { code: 'ENOENT' })]] });
    expect(code).toBe(2);
    expect(err).toMatch(/^omni credits: gh is not installed[^\n]*\n$/);
  });

  it('refuses a bad --since, an unknown flag or an argument: one usage line, exit 2', async () => {
    for (const argv of [['credits', '--since', '2026-13'], ['credits', '--since', '2026'], ['credits', '--list-all'], ['credits', 'now'], ['credits', '--repo', 'widgets']]) {
      const { code, out, err, calls } = await omni(argv);
      expect(code).toBe(2);
      expect(out).toBe('');
      expect(err.split('\n').filter(Boolean)).toHaveLength(1);
      expect(err).toMatch(/omni credits/);
      expect(calls).toEqual([]);
    }
  });

  it('needs a repository slug to know the organisation', async () => {
    const { code, err } = await omni(['credits'], { config: 'kit: 1\n' });
    expect(code).toBe(2);
    expect(err).toMatch(/^omni credits: no repository slug/);
  });
});
