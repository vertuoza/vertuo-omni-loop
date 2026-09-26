// PRD #99, slices s3 and s4: the credits reader, with a stubbed `exec` — the queries it asks `gh`
// for, what it keeps of each (pull requests, PRD issues, what the app opened, commits), the
// 1,000-result cap turned into a warning, and a missing or logged-out `gh` and a rate limit turned
// into errors (AC 8, AC 10). It never calls GitHub.
import { describe, expect, it } from 'vitest';
import { ConfigSchema } from '../config.mjs';
import { GitHubUnreadable, readCredits } from './reader.mjs';

const { labels, signature } = ConfigSchema.parse({ kit: 1 });
const TRAILER = 'Co-authored-by: OmniMan <333776611+omni-loop-invader[bot]@users.noreply.github.com>';
const SIGNED_BODY = 'Part of #7\n\n🦸 Delivered by OmniMan, with Omni Loop <!-- omni-loop:signed -->';
const PR_FIELDS = 'number,title,state,createdAt,labels,body,repository,author';

/** One pull request as `gh search prs --json` prints it. */
function searched(number, overrides = {}) {
  return {
    number,
    title: `PR ${number}`,
    state: 'merged',
    createdAt: '2026-08-10T09:00:00Z',
    labels: [],
    body: 'A plain body.',
    repository: { name: 'widgets', nameWithOwner: 'acme/widgets' },
    author: { login: 'someone' },
    ...overrides,
  };
}

/** One commit as `gh search commits --json` prints it. */
function searchedCommit(sha, message, repo = 'acme/widgets') {
  return { sha, commit: { message, committer: { date: '2026-08-11T09:00:00Z' } }, repository: { fullName: repo, name: repo.split('/')[1] } };
}

/**
 * A fake `execFileSync`: each call's arguments, joined by spaces, are matched against `routes` in
 * order by prefix; the first match answers (JSON-encoded unless a string) or, when it is an Error,
 * throws. Every call is recorded.
 */
function fakeExec(routes) {
  const calls = [];
  const exec = (file, args, options) => {
    calls.push({ file, args, options });
    const key = args.join(' ');
    for (const [prefix, out] of routes) {
      if (!key.startsWith(prefix)) continue;
      if (out instanceof Error) throw out;
      return typeof out === 'string' ? out : JSON.stringify(out);
    }
    throw new Error(`fakeExec: unexpected call ${file} ${key}`);
  };
  return { exec, calls };
}

/** Every search answered empty, after `routes`. */
const quiet = (routes = []) => [...routes, ['search prs', []], ['search issues', []], ['search commits', []]];

const read = (exec, options = {}) =>
  readCredits({ owner: 'acme', repo: null, since: null, labels, signature, exec, ...options });

/** An `execFileSync` failure, shaped as node throws it. */
function failure({ code, status = 1, stderr = '' } = {}) {
  return Object.assign(new Error(code ? `spawnSync gh ${code}` : `Command failed: gh\n${stderr}`), { code, status, stderr });
}

describe('the queries it asks gh for', () => {
  it('over the organisation: one per loop label, the PRD label, the name in bodies and commits, the app', () => {
    const { exec, calls } = fakeExec(quiet());
    read(exec);
    expect(calls.map((call) => [call.file, ...call.args].join(' '))).toEqual([
      `gh search prs --owner acme --label omni:phase-0 --limit 1000 --json ${PR_FIELDS}`,
      `gh search prs --owner acme --label omni:feature --limit 1000 --json ${PR_FIELDS}`,
      `gh search prs --owner acme --label omni:sub --limit 1000 --json ${PR_FIELDS}`,
      `gh search issues --owner acme --label omni:prd --limit 1000 --json ${PR_FIELDS}`,
      `gh search prs --owner acme --match body --limit 1000 --json ${PR_FIELDS} -- OmniMan`,
      `gh search issues --owner acme --match body --limit 1000 --json ${PR_FIELDS} -- OmniMan`,
      'gh search commits --owner acme --limit 1000 --json sha,commit,repository -- OmniMan',
      `gh search prs --owner acme --app omni-loop-invader --limit 1000 --json ${PR_FIELDS}`,
      `gh search issues --owner acme --app omni-loop-invader --limit 1000 --json ${PR_FIELDS}`,
    ]);
  });

  it('--repo narrows each to one repository, --since to what was created from that month on', () => {
    const { exec, calls } = fakeExec(quiet());
    read(exec, { repo: 'acme/widgets', since: '2026-07' });
    expect(calls.map((call) => call.args.join(' '))).toEqual([
      `search prs --repo acme/widgets --label omni:phase-0 --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS}`,
      `search prs --repo acme/widgets --label omni:feature --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS}`,
      `search prs --repo acme/widgets --label omni:sub --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS}`,
      `search issues --repo acme/widgets --label omni:prd --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS}`,
      `search prs --repo acme/widgets --match body --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS} -- OmniMan`,
      `search issues --repo acme/widgets --match body --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS} -- OmniMan`,
      'search commits --repo acme/widgets --committer-date >=2026-07-01 --limit 1000 --json sha,commit,repository -- OmniMan',
      `search prs --repo acme/widgets --app omni-loop-invader --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS}`,
      `search issues --repo acme/widgets --app omni-loop-invader --created >=2026-07-01 --limit 1000 --json ${PR_FIELDS}`,
    ]);
  });

  it('asks for the configured labels, name and account, once each', () => {
    const { exec, calls } = fakeExec(quiet());
    read(exec, {
      labels: { ...labels, prd: 'loop:prd', phase0: 'loop', feature: 'loop', sub: 'loop:slice' },
      signature: { ...signature, name: 'Robo Cop', email: '7+robo-app[bot]@users.noreply.github.com' },
    });
    expect(calls.map((call) => call.args.slice(0, 6).join(' '))).toEqual([
      'search prs --owner acme --label loop',
      'search prs --owner acme --label loop:slice',
      'search issues --owner acme --label loop:prd',
      'search prs --owner acme --match body',
      'search issues --owner acme --match body',
      'search commits --owner acme --limit 1000',
      'search prs --owner acme --app robo-app',
      'search issues --owner acme --app robo-app',
    ]);
    expect(calls.slice(3, 6).map((call) => call.args.at(-1))).toEqual(['Robo Cop', 'Robo Cop', 'Robo Cop']);
  });

  it('looks for a person\'s account by author, and for none when the address is no noreply address', () => {
    const user = fakeExec(quiet());
    read(user.exec, { signature: { ...signature, email: '42+octocat@users.noreply.github.com' } });
    expect(user.calls.slice(-2).map((call) => call.args.slice(0, 6).join(' '))).toEqual([
      'search prs --owner acme --author octocat',
      'search issues --owner acme --author octocat',
    ]);

    const plain = fakeExec(quiet());
    read(plain.exec, { signature: { ...signature, email: 'omniman@example.com' } });
    expect(plain.calls.map((call) => call.args.join(' ')).filter((key) => /--(?:app|author) /.test(key))).toEqual([]);
    expect(plain.calls.at(-1).args.slice(0, 2)).toEqual(['search', 'commits']);
  });

  it('with signature: null, asks only for the labels', () => {
    const { exec, calls } = fakeExec(quiet());
    read(exec, { signature: null });
    expect(calls.map((call) => call.args.slice(0, 6).join(' '))).toEqual([
      'search prs --owner acme --label omni:phase-0',
      'search prs --owner acme --label omni:feature',
      'search prs --owner acme --label omni:sub',
      'search issues --owner acme --label omni:prd',
    ]);
  });

  it('keeps gh\'s own stderr off the terminal, and room for a large answer', () => {
    const { exec, calls } = fakeExec(quiet());
    read(exec, { env: { GH_TOKEN: 't' } });
    for (const { options } of calls) {
      expect(options).toMatchObject({ encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { GH_TOKEN: 't' } });
      expect(options.maxBuffer).toBeGreaterThanOrEqual(64 * 1024 * 1024);
    }
  });
});

describe('what it keeps', () => {
  it('every labelled pull request, a body match only with the marker, a commit only with the exact trailer', () => {
    const { exec } = fakeExec(quiet([
      ['search prs --owner acme --label omni:sub', [searched(1, { labels: [{ name: 'omni:sub' }] })]],
      ['search prs --owner acme --match body', [searched(2, { body: SIGNED_BODY }), searched(3, { body: 'Thanks, OmniMan!' })]],
      ['search commits', [
        searchedCommit('c1', `feat: one (#1)\n\n${TRAILER}\n`),
        searchedCommit('c2', 'chore: OmniMan was here (#5)\n'),
      ]],
    ]));
    const { prs, commits, warnings } = read(exec);
    expect(prs).toEqual([
      { repo: 'acme/widgets', number: 1, title: 'PR 1', state: 'merged', createdAt: '2026-08-10T09:00:00Z', labels: ['omni:sub'], body: 'A plain body.', author: 'someone' },
      { repo: 'acme/widgets', number: 2, title: 'PR 2', state: 'merged', createdAt: '2026-08-10T09:00:00Z', labels: [], body: SIGNED_BODY, author: 'someone' },
    ]);
    expect(commits).toEqual([{ repo: 'acme/widgets', sha: 'c1', message: `feat: one (#1)\n\n${TRAILER}\n`, date: '2026-08-11T09:00:00Z' }]);
    expect(warnings).toEqual([]);
  });

  it('every PRD-labelled issue, an issue body match only with the marker, and all the app opened', () => {
    const app = { author: { login: 'omni-loop-invader[bot]' } };
    const { exec, calls } = fakeExec(quiet([
      ['search issues --owner acme --label omni:prd', [searched(10, { labels: [{ name: 'omni:prd' }], state: 'closed' })]],
      ['search issues --owner acme --match body', [searched(11, { body: SIGNED_BODY }), searched(12, { body: 'OmniMan rocks' })]],
      ['search commits', [searchedCommit('c20', `chore: retro (#20)\n\n${TRAILER}`)]],
      ['search prs --owner acme --app', [searched(20, app)]],
      ['search issues --owner acme --app', [searched(13, app), searched(10, { labels: [{ name: 'omni:prd' }], state: 'closed' })]],
    ]));
    const { prs, issues } = read(exec);
    expect(issues.map((issue) => `${issue.repo}#${issue.number} ${issue.state} ${issue.author}`)).toEqual([
      'acme/widgets#10 closed someone',
      'acme/widgets#11 merged someone',
      'acme/widgets#13 merged omni-loop-invader[bot]',
    ]);
    expect(prs.map((pr) => `${pr.number} ${pr.author}`)).toEqual(['20 omni-loop-invader[bot]']);
    expect(calls.filter((call) => call.args[0] === 'pr')).toEqual([]);
  });

  it('reads a pull request found twice once', () => {
    const one = searched(1, { labels: [{ name: 'omni:sub' }], body: SIGNED_BODY });
    const { exec } = fakeExec(quiet([
      ['search prs --owner acme --label omni:sub', [one]],
      ['search prs --owner acme --match body', [one]],
    ]));
    expect(read(exec).prs.map((pr) => pr.number)).toEqual([1]);
  });

  it('looks up, one by one, a pull request only a signed commit names', () => {
    const { exec, calls } = fakeExec(quiet([
      ['search prs --owner acme --label omni:sub', [searched(1, { labels: [{ name: 'omni:sub' }] })]],
      ['search commits', [
        searchedCommit('c1', `feat: one (#1)\n\n${TRAILER}`),
        searchedCommit('c9', `feat: nine (#9)\n\n${TRAILER}`, 'acme/gadgets'),
        searchedCommit('c0', `chore: no number\n\n${TRAILER}`),
      ]],
      ['pr view 9 --repo acme/gadgets', { number: 9, title: 'Nine', state: 'MERGED', createdAt: '2026-08-01T10:00:00Z', labels: [], body: '', author: { login: 'pat' } }],
    ]));
    const { prs, commits } = read(exec);
    expect(calls.filter((call) => call.args[0] === 'pr').map((call) => call.args.join(' '))).toEqual([
      'pr view 9 --repo acme/gadgets --json number,title,state,createdAt,labels,body,author',
    ]);
    expect(prs.map((pr) => `${pr.repo}#${pr.number} ${pr.state}`)).toEqual(['acme/widgets#1 merged', 'acme/gadgets#9 merged']);
    expect(commits.map((commit) => commit.sha)).toEqual(['c1', 'c9', 'c0']);
  });

  it('a number a signed commit names that is no readable pull request is a warning, not a failure', () => {
    const { exec } = fakeExec(quiet([
      ['search commits', [searchedCommit('c4', `fix: four (#4)\n\n${TRAILER}`)]],
      ['pr view 4', failure({ stderr: 'GraphQL: Could not resolve to a PullRequest with the number of 4. (repository.pullRequest)\n' })],
    ]));
    const { prs, warnings } = read(exec);
    expect(prs).toEqual([]);
    expect(warnings).toEqual(['acme/widgets#4, named by a signed commit, could not be read: GraphQL: Could not resolve to a PullRequest with the number of 4. (repository.pullRequest)']);
  });

  it('skips a pull request whose creation date cannot be read', () => {
    const { exec } = fakeExec(quiet([
      ['search prs --owner acme --label omni:sub', [searched(1, { labels: [{ name: 'omni:sub' }], createdAt: 'soon' }), searched(2, { labels: [{ name: 'omni:sub' }], createdAt: '2026-08-10T09:00:00.000+02:00' })]],
    ]));
    expect(read(exec).prs.map((pr) => [pr.number, pr.createdAt])).toEqual([[2, '2026-08-10T07:00:00Z']]);
  });
});

describe('the 1,000-result cap (AC 10)', () => {
  it('reads what it got, and warns naming each query that hit the cap', () => {
    const full = Array.from({ length: 1000 }, (_, index) => searched(index + 1, { labels: [{ name: 'omni:sub' }] }));
    const commits = Array.from({ length: 1000 }, (_, index) => searchedCommit(`c${index}`, 'chore: OmniMan'));
    const { exec } = fakeExec(quiet([
      ['search prs --owner acme --label omni:sub', full],
      ['search commits', commits],
    ]));
    const { prs, warnings } = read(exec, { since: '2026-07' });
    expect(prs).toHaveLength(1000);
    expect(warnings).toEqual([
      'gh search prs --owner acme --label omni:sub --created >=2026-07-01 hit GitHub\'s 1,000-result cap: some items may be missing; narrow it with --since or --repo.',
      'gh search commits --owner acme --committer-date >=2026-07-01 -- OmniMan hit GitHub\'s 1,000-result cap: some items may be missing; narrow it with --since or --repo.',
    ]);
  });

  it('quotes a name with a space when it names the query', () => {
    const full = Array.from({ length: 1000 }, (_, index) => searched(index + 1));
    const { exec } = fakeExec(quiet([['search prs --owner acme --match body', full]]));
    const { warnings } = read(exec, { signature: { ...signature, name: 'Robo Cop' } });
    expect(warnings).toEqual([
      'gh search prs --owner acme --match body -- "Robo Cop" hit GitHub\'s 1,000-result cap: some items may be missing; narrow it with --since or --repo.',
    ]);
  });
});

describe('when gh cannot be read (AC 10)', () => {
  const cases = [
    ['missing', failure({ code: 'ENOENT' }), /^gh is not installed/],
    ['logged-out', failure({ status: 4, stderr: 'To get started with GitHub CLI, please run:  gh auth login\n' }), /^gh is not logged in/],
    ['logged-out', failure({ stderr: 'HTTP 401: Bad credentials (https://api.github.com/search/issues)\n' }), /^gh is not logged in/],
    ['rate-limited', failure({ stderr: 'HTTP 403: API rate limit exceeded for user ID 1. (https://api.github.com/search/issues?q=x)\n' }), /^GitHub's rate limit/],
    ['rate-limited', failure({ stderr: 'HTTP 429: You have exceeded a secondary rate limit.\n' }), /^GitHub's rate limit/],
    ['failed', failure({ stderr: '\nHTTP 502: Bad Gateway (https://api.github.com/search/issues)\nmore\n' }), /^gh failed: HTTP 502: Bad Gateway/],
  ];

  it.each(cases)('%s: throws a one-line GitHubUnreadable', (reason, error, message) => {
    const { exec } = fakeExec([['search prs', error]]);
    let thrown;
    try {
      read(exec);
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeInstanceOf(GitHubUnreadable);
    expect(thrown.reason).toBe(reason);
    expect(thrown.message).toMatch(message);
    expect(thrown.message).not.toMatch(/\n/);
  });

  it('a rate limit met while looking up a pull request still stops the run', () => {
    const { exec } = fakeExec(quiet([
      ['search commits', [searchedCommit('c4', `fix: four (#4)\n\n${TRAILER}`)]],
      ['pr view 4', failure({ stderr: 'HTTP 403: API rate limit exceeded\n' })],
    ]));
    expect(() => read(exec)).toThrow(GitHubUnreadable);
  });
});
