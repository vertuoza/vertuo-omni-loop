// PRD #99, slice s3: `omni credits`, through `main()` on a fixture repository, with `gh` stubbed —
// the text report, `--repo`, `--since`, `signature: null`, a `gh` that cannot be read and the
// 1,000-result cap (AC 7, AC 9 first half, AC 10). It never calls GitHub.
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
];

describe('omni credits', () => {
  it('prints the pull request lines, by repository and by month, over the organisation (AC 7)', async () => {
    const { code, out, err } = await omni(['credits'], { routes: WORLD });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe([
      'OmniMan · acme · all time',
      'PRs        6    (merged 5 · open 1)       phase-0 1 · feature 1 · slices 2 · other 2',
      '  signed 3 · before signing 2 · missed 1',
      'By repo    widgets 4 · gadgets 2',
      'By month   2026-07 1 · 2026-08 2 · 2026-09 3',
      '',
    ].join('\n'));
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

  it('with signature: null, still counts the labelled pull requests, and says signing is off', async () => {
    const { code, out, calls } = await omni(['credits'], { config: `${CONFIG}signature: null\n`, routes: WORLD });
    expect(code).toBe(0);
    expect(calls.every((call) => call.includes('--label'))).toBe(true);
    expect(out.split('\n').slice(0, 3)).toEqual([
      'Omni Loop · acme · all time',
      'PRs        4    (merged 3 · open 1)       phase-0 1 · feature 1 · slices 2 · other 0',
      '  signing is off in this repository',
    ]);
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
