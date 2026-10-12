import { generateKeyPairSync } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { memoryGithubStore } from '@omni/github';
import { firstPart } from 'vertuo-omni-plan/kit/lib/narrow.ts';
import { githubReader, latestPull, SUMMARY_TTL_MS } from './reader';
import { UNREAD } from './summary';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

// The PRD page's GitHub reader (PRD 426, part 1), against a stubbed `fetch`: never GitHub itself.
// A small fake GitHub answers by route; each test says what the repository holds.

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const CREDS = { appId: '123456', privateKey: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() };
const NOW = Date.parse('2026-09-28T10:00:00Z');
const DOSSIER = { id: 'd-426', home_repo: 'acme/widgets', prd: parsePrd(426) };

const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\n  defaultBranch: trunk\nbranches:\n  feature: feature/{topic}\npaths:\n  delivery: loop/delivery\n';

type Route = (url: URL, init: RequestInit) => Response | Promise<Response> | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const pull = (number: number, head: string, more: Record<string, unknown> = {}) => ({
  number: parsePr(number), html_url: `https://github.com/acme/widgets/pull/${number}`, state: 'open' as 'open' | 'closed', draft: false, merged_at: null as string | null,
  created_at: `2026-09-${String(10 + (number % 18)).padStart(2, '0')}T00:00:00Z`, head: { ref: head }, body: null, ...more,
});
const merged = (number: number, head: string, more: Record<string, unknown> = {}) =>
  pull(number, head, { state: 'closed', merged_at: '2026-09-27T00:00:00Z', ...more });

/** A fake GitHub: the App's installation and token routes, then the repository's contents and pulls. */
function fakeGithub(repo: {
  config?: string | null;
  shipped?: string[];
  inbox?: string[];
  issue?: unknown;
  pulls?: ReturnType<typeof pull>[];
  installed?: boolean;
  fail?: RegExp | undefined;
  /** Files by `<ref>:<path>`; a directory lists the files and folders right under it. */
  files?: Record<string, string>;
  /** The comments of each issue or pull request, by number. */
  comments?: Record<number, { id: number; html_url: string; body: string; created_at?: string; user?: { login: string }; author_association?: string }[]>;
  /** The GraphQL answer to the care query (PRD 790, s2); a PR with no check and no thread when left out. */
  care?: unknown;
}) {
  const calls: string[] = [];
  let tokens = 0;
  const routes: Route[] = [
    (url) => (url.pathname === '/repos/acme/widgets/installation'
      ? (repo.installed === false ? json({}, 404) : json({ id: 5001, account: { login: 'acme', type: 'Organization' } })) : undefined),
    (url, init) => {
      if (url.pathname !== '/app/installations/5001/access_tokens' || init.method !== 'POST') return undefined;
      tokens += 1;
      return json({ token: `ghs_${tokens}`, expires_at: new Date(NOW + 60 * 60_000).toISOString() }, 201);
    },
    (url) => (url.pathname === '/repos/acme/widgets/contents/.omni-loop/config.yml'
      ? (repo.config === null ? json({}, 404) : new Response(repo.config ?? CONFIG)) : undefined),
    (url) => {
      const dir = /^\/repos\/acme\/widgets\/contents\/loop\/delivery\/(shipped|inbox)$/.exec(url.pathname)?.[1] as 'shipped' | 'inbox' | undefined;
      if (!dir || url.searchParams.get('ref') !== 'trunk') return undefined;
      const names = repo[dir];
      return names ? json(names.map((name) => ({ name, type: 'dir' }))) : json({}, 404);
    },
    (url) => (url.pathname === '/repos/acme/widgets/issues/426'
      ? (repo.issue === undefined ? json({}, 404) : json(repo.issue)) : undefined),
    (url, init) => {
      const at = /^\/repos\/acme\/widgets\/contents\/(.+)$/.exec(url.pathname)?.[1];
      if (!at) return undefined;
      const key = `${url.searchParams.get('ref')}:${decodeURIComponent(at)}`;
      const files = repo.files ?? {};
      if (key in files) {
        expect((init.headers as Record<string, string>).accept).toContain('raw');
        return new Response(files[key]);
      }
      const under = Object.keys(files).filter((k) => k.startsWith(`${key}/`)).map((k) => k.slice(key.length + 1));
      if (!under.length) return json({ message: 'Not Found' }, 404);
      const names = [...new Set(under.map((rest) => firstPart(rest, '/')))];
      return json(names.map((name) => ({ name, type: under.includes(name) ? 'file' : 'dir' })));
    },
    (url) => {
      const n = /^\/repos\/acme\/widgets\/issues\/(\d+)\/comments$/.exec(url.pathname)?.[1];
      return n ? json(repo.comments?.[Number(n)] ?? []) : undefined;
    },
    (url, init) => {
      if (url.pathname !== '/graphql' || init.method !== 'POST') return undefined;
      if (typeof init.body !== 'string') throw new Error('a GraphQL call sends its query as text');
      const { variables } = JSON.parse(init.body) as { variables: { owner: string; name: string; number: number } };
      calls.push(`graphql ${variables.owner}/${variables.name}#${variables.number}`);
      return json({ data: repo.care ?? { repository: { pullRequest: {
        mergeable: 'MERGEABLE', baseRefName: 'trunk', commits: { nodes: [] }, reviewThreads: { nodes: [] }, comments: { nodes: [] },
      } } } });
    },
    (url) => {
      if (url.pathname !== '/repos/acme/widgets/pulls') return undefined;
      const head = url.searchParams.get('head');
      const base = url.searchParams.get('base');
      return json((repo.pulls ?? []).filter((p) => (head ? `acme:${p.head.ref}` === head : true))
        .filter((p) => (base ? (p as { base?: string }).base === base && p.state === 'closed' : true)));
    },
  ];
  const fetchImpl = vi.fn(async (href: string, init: RequestInit) => {
    const url = new URL(href);
    calls.push(`${url.pathname}${url.search}`);
    if (repo.fail?.test(`${url.pathname}${url.search}`)) return json({ message: 'boom' }, 502);
    for (const route of routes) {
      const answer = await route(url, init);
      if (answer) return answer;
    }
    throw new Error(`unexpected GitHub call ${href}`);
  });
  return { fetchImpl, calls, tokens: () => tokens };
}

beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

const ISSUE = { number: 426, html_url: 'https://github.com/acme/widgets/issues/426', state: 'open' };
const sub = (number: number, isMerged: boolean) =>
  ({ ...(isMerged ? merged(number, `feature/prd-page-stage--s${number}`) : pull(number, `feature/prd-page-stage--s${number}`, { state: 'closed' })), base: 'feature/prd-page-stage' });

describe('the GitHub summary of a numbered dossier', () => {
  it('reads the issue, each PR by the branch shapes of the repository\'s own config, and counts merged sub-PRs', async () => {
    const gh = fakeGithub({
      inbox: ['0425-other', '0426-prd-page-stage'],
      issue: ISSUE,
      pulls: [merged(431, 'docs/phase-0-prd-page-stage'), pull(433, 'feature/prd-page-stage', { draft: true }), sub(434, true), sub(435, true), sub(436, false)],
    });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);
    expect(summary).toEqual({
      repo: 'acme/widgets', prd: 426, folder: '0426-prd-page-stage', topic: 'prd-page-stage',
      issue: { number: 426, url: 'https://github.com/acme/widgets/issues/426', state: 'open' },
      phase0: { number: 431, url: 'https://github.com/acme/widgets/pull/431', state: 'merged', draft: false, mergedAt: '2026-09-27T00:00:00Z' },
      feature: { number: 433, url: 'https://github.com/acme/widgets/pull/433', state: 'open', draft: true, mergedAt: null },
      retro: null,
      mergedSlices: 2,
      outbox: null,
      outboxComment: null,
      replies: { numbering: [], pending: [] },
      retroText: null,
      care: { ci: 'none', failedUrl: null, conflict: false, base: 'trunk', threads: [], watchingSince: null, lastRound: null },
    });
    expect(gh.calls).toContain('graphql acme/widgets#433');
    expect(gh.calls).toContain('/repos/acme/widgets/pulls?state=all&per_page=100&head=acme%3Afeature%2Fprd-page-stage&sort=created&direction=desc');
    expect(gh.calls).toContain('/repos/acme/widgets/pulls?state=closed&per_page=100&base=feature%2Fprd-page-stage');
    expect(JSON.stringify(summary)).not.toContain('ghs_');
  });

  it('finds the folder under shipped first, and the retro PR on the retro branch', async () => {
    const gh = fakeGithub({
      shipped: ['0426-prd-page-stage'],
      issue: { ...ISSUE, state: 'closed' },
      pulls: [merged(431, 'docs/phase-0-prd-page-stage'), merged(433, 'feature/prd-page-stage'), pull(440, 'docs/retro-prd-page-stage')],
    });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);
    expect(summary).toMatchObject({ folder: '0426-prd-page-stage', feature: { state: 'merged' }, retro: { number: 440, state: 'open' } });
    expect(gh.calls.some((c) => c.includes('/contents/loop/delivery/inbox'))).toBe(false);
  });

  it('counts a closed, unmerged PR as absent and takes the most recent open or merged one', () => {
    const closed = pull(9, 'x', { state: 'closed', created_at: '2026-09-28T00:00:00Z' });
    expect(latestPull([closed])).toBeNull();
    expect(latestPull([closed, merged(3, 'x', { created_at: '2026-09-01T00:00:00Z' }), pull(5, 'x', { created_at: '2026-09-05T00:00:00Z' })]))
      .toMatchObject({ number: 5, state: 'open' });
  });

  it('before phase-0 merges, finds the topic from the PR that carries the PRD\'s link line', async () => {
    const gh = fakeGithub({
      issue: ISSUE,
      pulls: [pull(4260, 'docs/phase-0-other', { body: 'Refs #4260' }), pull(430, 'docs/phase-0-prd-page-stage', { body: 'Spec.\n\nRefs #426' })],
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      folder: null, topic: 'prd-page-stage', phase0: { number: 430, state: 'open' }, feature: null, retro: null, mergedSlices: 0,
    });
  });

  it('answers "none yet" when no folder and no PR name the PRD', async () => {
    const gh = fakeGithub({ issue: ISSUE });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      topic: null, phase0: null, feature: null, retro: null, mergedSlices: 0, issue: { number: 426 },
    });
  });

  it('lets one read fail while the others answer', async () => {
    const gh = fakeGithub({
      inbox: ['0426-prd-page-stage'], issue: ISSUE,
      pulls: [merged(431, 'docs/phase-0-prd-page-stage')], fail: /\/issues\/426|head=acme%3Afeature/,
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      issue: UNREAD, feature: UNREAD, phase0: { number: 431, state: 'merged' }, retro: null,
    });
  });

  it('is null when the App is not installed on the repository, when it has no config, and when GitHub is unreachable', async () => {
    expect(await githubReader(CREDS, fakeGithub({ installed: false }).fetchImpl, () => NOW).summary(DOSSIER)).toBeNull();
    expect(await githubReader(CREDS, fakeGithub({ config: null }).fetchImpl, () => NOW).summary(DOSSIER)).toBeNull();
    expect(await githubReader(CREDS, () => Promise.reject(new TypeError('fetch failed')), () => NOW).summary(DOSSIER)).toBeNull();
  });

  it('never puts an odd repository in a GitHub address', async () => {
    const gh = fakeGithub({});
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary({ ...DOSSIER, home_repo: '../evil' })).toBeNull();
    expect(gh.fetchImpl).not.toHaveBeenCalled();
  });
});

describe('the cache and the token', () => {
  it('makes no call on a second read within 60 s, and reads again after', async () => {
    let now = NOW;
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    const first = await reader.summary(DOSSIER);
    const count = gh.fetchImpl.mock.calls.length;
    now += SUMMARY_TTL_MS - 1;
    expect(await reader.summary(DOSSIER)).toEqual(first);
    expect(gh.fetchImpl.mock.calls.length).toBe(count);
    now += 1;
    await reader.summary(DOSSIER);
    expect(gh.fetchImpl.mock.calls.length).toBeGreaterThan(count);
  });

  it('reads again at once once a dossier is forgotten, and keeps the other dossiers (PRD 251, s11)', async () => {
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW);
    const other = { ...DOSSIER, id: 'd-other' };
    await reader.summary(DOSSIER);
    await reader.summary(other);
    const count = gh.fetchImpl.mock.calls.length;
    reader.forget(DOSSIER.id);
    await reader.summary(other);
    expect(gh.fetchImpl.mock.calls.length).toBe(count);
    await reader.summary(DOSSIER);
    expect(gh.fetchImpl.mock.calls.length).toBeGreaterThan(count);
  });

  it('makes one set of requests for two concurrent summaries of one dossier (PRD 657, s6)', async () => {
    const alone = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    await githubReader(CREDS, alone.fetchImpl, () => NOW).summary(DOSSIER);
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW);
    const [first, second] = await Promise.all([reader.summary(DOSSIER), reader.summary(DOSSIER)]);
    expect(second).toBe(first);
    expect(gh.calls).toEqual(alone.calls);
  });

  it('reads a repository\'s config.yml once for two PRDs within the cache window, and again after (PRD 657, s6)', async () => {
    let now = NOW;
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    const configReads = () => gh.calls.filter((c) => c.includes('/contents/.omni-loop/config.yml')).length;
    await Promise.all([reader.summary(DOSSIER), reader.summary({ ...DOSSIER, id: 'd-427', prd: parsePrd(427) })]);
    await reader.summary({ ...DOSSIER, id: 'd-428', prd: parsePrd(428) });
    await reader.fix({ ...DOSSIER, id: 'd-fix', prd: parseIssue(429) });
    expect(configReads()).toBe(1);
    now += SUMMARY_TTL_MS;
    await reader.summary({ ...DOSSIER, id: 'd-430', prd: parsePrd(430) });
    expect(configReads()).toBe(2);
  });

  it('reads the config again at once after a failed read (PRD 657, s6)', async () => {
    let broken = true;
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const flaky = vi.fn(async (href: string, init: RequestInit) =>
      (broken && href.includes('config.yml') ? new Response('{}', { status: 502 }) : gh.fetchImpl(href, init)));
    const reader = githubReader(CREDS, flaky, () => NOW);
    expect(await reader.summary(DOSSIER)).toBeNull();
    broken = false;
    expect(await reader.summary({ ...DOSSIER, id: 'd-427', prd: parsePrd(427) })).not.toBeNull();
  });

  it('a forget while a read is in flight makes the next read fresh (PRD 657, s6)', async () => {
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW);
    const pending = reader.summary(DOSSIER);
    reader.forget(DOSSIER.id);
    await pending;
    const issueReads = () => gh.calls.filter((c) => c === '/repos/acme/widgets/issues/426').length;
    const before = issueReads();
    await reader.summary(DOSSIER);
    expect(issueReads()).toBe(before + 1);
  });

  it('keeps an unreadable answer for 60 s too', async () => {
    const gh = fakeGithub({ installed: false });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW);
    await reader.summary(DOSSIER);
    await reader.summary(DOSSIER);
    expect(gh.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('reuses the installation token until a minute before it expires', async () => {
    let now = NOW;
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    await reader.summary(DOSSIER);
    now += 30 * 60_000;
    await reader.summary(DOSSIER);
    expect(gh.tokens()).toBe(1);
    now = NOW + 59 * 60_000;
    await reader.summary(DOSSIER);
    expect(gh.tokens()).toBe(2);
    const authorizations = gh.fetchImpl.mock.calls
      .filter(([href]) => href.includes('/issues/426'))
      .map(([, init]) => (init.headers as Record<string, string>).authorization);
    expect(authorizations).toEqual(['Bearer ghs_1', 'Bearer ghs_1', 'Bearer ghs_2']);
  });
});

const item = (id: string, rank: 'high' | 'medium' | 'human-action', question: string) => [
  '---', `id: ${id}`, 'prd: 426', `slice: ${id.split('-')[0]}`, `rank: ${rank}`, 'bears-on: none', 'raised: 2026-09-28', 'wave: 1', '---', '',
  '## The question, in plain words', '', question, '',
  '## The decision, in plain words', '', `Decided: ${question}`, '',
  ...(rank === 'human-action'
    ? ['## What a person must do', '', 'Add the secret on the host.', '']
    : ['## The options, in plain words', '', 'A. Keep what was built.', 'B. Change it.', '']),
  '## What I had to decide', '', 'x', '', '## What I did meanwhile', '', 'x', '',
  '## What it costs to change later', '', 'x', '', '## What I could not know', '', 'x', '',
].join('\n');
const settledEntry = (id: string, verdict: string, answer: string, itemText: string) => [
  `<!-- omni-outbox-settled: ${id} -->`, '', `## ${id} — ${verdict}`, '', `- Verdict: ${verdict}`, '- Rank: medium', '',
  '### The answer, as it was given', '', '```text', answer, '```', '', '### The item, as it was raised', '', '```text', itemText, '```', '',
  `<!-- /omni-outbox-settled: ${id} -->`, '',
].join('\n');
const SETTLED = `# Settled outbox items — PRD 426\n\n${settledEntry('s1-02-zeta', 'adopted', 'Adopted when raised.', item('s1-02-zeta', 'medium', 'Zeta or eta?'))}${settledEntry('s1-01-alpha', 'agreed', 'Yes, A.', 'not an item')}`;
const OUTBOX = 'loop/delivery/outbox/0426-prd-page-stage';

describe('the outbox', () => {
  it('before shipping, reads the open items and settled.md from the feature branch, and finds the outbox comment by its marker', async () => {
    const gh = fakeGithub({
      inbox: ['0426-prd-page-stage'], issue: ISSUE,
      pulls: [merged(431, 'docs/phase-0-prd-page-stage'), pull(433, 'feature/prd-page-stage'), sub(434, true)],
      files: {
        [`feature/prd-page-stage:${OUTBOX}/s1-03-medium-one.md`]: item('s1-03-medium-one', 'medium', 'Medium one?'),
        [`feature/prd-page-stage:${OUTBOX}/s2-01-high-one.md`]: item('s2-01-high-one', 'high', 'High one?'),
        [`feature/prd-page-stage:${OUTBOX}/s2-02-person.md`]: item('s2-02-person', 'human-action', 'A secret?'),
        [`feature/prd-page-stage:${OUTBOX}/s2-09-broken.md`]: 'not an item',
        [`feature/prd-page-stage:${OUTBOX}/settled.md`]: SETTLED,
        [`feature/prd-page-stage:${OUTBOX}/accounts/s1.md`]: '---\nprd: 426\n---\n',
      },
      comments: { 433: [
        { id: 1, html_url: 'https://github.com/acme/widgets/pull/433#issuecomment-1', body: 'hello' },
        { id: 2, html_url: 'https://github.com/acme/widgets/pull/433#issuecomment-2', body: 'Questions\n<!-- omni-outbox-pr -->' },
      ] },
    });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);
    expect(summary?.outboxComment).toBe('https://github.com/acme/widgets/pull/433#issuecomment-2');
    expect(summary?.outbox).toMatchObject({
      open: [
        { id: 's1-03-medium-one', rank: 'medium', question: 'Medium one?', decision: 'Decided: Medium one?',
          options: [{ letter: 'A', text: 'Keep what was built.' }, { letter: 'B', text: 'Change it.' }], personSteps: null },
        { id: 's2-01-high-one', rank: 'high', question: 'High one?', decision: 'Decided: High one?',
          options: [{ letter: 'A', text: 'Keep what was built.' }, { letter: 'B', text: 'Change it.' }], personSteps: null },
        { id: 's2-02-person', rank: 'human-action', question: 'A secret?', decision: 'Decided: A secret?', options: [], personSteps: 'Add the secret on the host.' },
      ],
      settled: [
        { id: 's1-02-zeta', title: 'Zeta or eta?', verdict: 'adopted', answer: 'Adopted when raised.' },
        { id: 's1-01-alpha', title: 's1-01-alpha', verdict: 'agreed', answer: 'Yes, A.' },
      ],
    });
  });

  it('takes the plain outbox comment when the feature PR has no numbered one, and none when neither is there', async () => {
    const base = { inbox: ['0426-prd-page-stage'], issue: ISSUE, pulls: [pull(433, 'feature/prd-page-stage')] };
    const plain = fakeGithub({ ...base, comments: { 433: [{ id: 3, html_url: 'https://github.com/acme/widgets/pull/433#issuecomment-3', body: '<!-- omni-outbox -->' }] } });
    expect((await githubReader(CREDS, plain.fetchImpl, () => NOW).summary(DOSSIER))?.outboxComment).toBe('https://github.com/acme/widgets/pull/433#issuecomment-3');
    const none = fakeGithub(base);
    expect(await githubReader(CREDS, none.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({ outbox: null, outboxComment: null });
  });

  it('once shipped, reads the shipped folder\'s outbox on the default branch, not the feature branch', async () => {
    const gh = fakeGithub({
      shipped: ['0426-prd-page-stage'], issue: { ...ISSUE, state: 'closed' },
      pulls: [merged(431, 'docs/phase-0-prd-page-stage'), merged(433, 'feature/prd-page-stage')],
      files: { 'trunk:loop/delivery/shipped/0426-prd-page-stage/outbox/settled.md': SETTLED },
    });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);
    expect(summary?.outbox).toMatchObject({ open: [], settled: [{ id: 's1-02-zeta' }, { id: 's1-01-alpha' }] });
    expect(gh.calls.some((c) => c.includes('ref=feature'))).toBe(false);
  });

  it('before phase-0 merges, finds the folder under inbox on the feature branch', async () => {
    const gh = fakeGithub({
      issue: ISSUE,
      pulls: [pull(430, 'docs/phase-0-prd-page-stage', { body: 'Refs #426' }), pull(433, 'feature/prd-page-stage', { body: 'Closes #426' })],
      files: {
        'feature/prd-page-stage:loop/delivery/inbox/0426-prd-page-stage/spec.md': '# spec',
        [`feature/prd-page-stage:${OUTBOX}/s1-01-a.md`]: item('s1-01-a', 'high', 'A?'),
      },
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      folder: '0426-prd-page-stage', outbox: { open: [{ id: 's1-01-a' }], settled: [] },
    });
  });

  it('lets the outbox and its comment fail on their own', async () => {
    const gh = fakeGithub({
      inbox: ['0426-prd-page-stage'], issue: ISSUE, pulls: [pull(433, 'feature/prd-page-stage')],
      files: { [`feature/prd-page-stage:${OUTBOX}/settled.md`]: SETTLED }, fail: /\/contents\/loop\/delivery\/outbox|\/comments/,
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      outbox: UNREAD, outboxComment: UNREAD, feature: { number: 433 }, issue: { number: 426 },
    });
  });
});

describe('the retro (s3)', () => {
  const RETRO = 'loop/delivery/shipped/0426-prd-page-stage/retro.md';
  const shipped = (retroPr: ReturnType<typeof pull>, files: Record<string, string>, fail?: RegExp) => fakeGithub({
    shipped: ['0426-prd-page-stage'], issue: { ...ISSUE, state: 'closed' },
    pulls: [merged(431, 'docs/phase-0-prd-page-stage'), merged(433, 'feature/prd-page-stage'), retroPr], files, fail,
  });

  it('reads retro.md from the retro branch while its PR is open', async () => {
    const gh = shipped(pull(440, 'docs/retro-prd-page-stage'), {
      [`docs/retro-prd-page-stage:${RETRO}`]: '# Retro\n\nFrom the branch.\n', [`trunk:${RETRO}`]: 'stale',
    });
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      retro: { number: 440, state: 'open' }, retroText: '# Retro\n\nFrom the branch.\n',
    });
  });

  it('reads it from the default branch once the retro PR is merged', async () => {
    const gh = shipped(merged(440, 'docs/retro-prd-page-stage'), { [`trunk:${RETRO}`]: '# Retro\n\nMerged.\n' });
    expect((await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER))?.retroText).toBe('# Retro\n\nMerged.\n');
    expect(gh.calls.some((c) => c.includes('retro.md') && c.includes('ref=docs'))).toBe(false);
  });

  it('is none with no retro PR, and makes no read for it', async () => {
    const gh = fakeGithub({ shipped: ['0426-prd-page-stage'], issue: ISSUE, pulls: [merged(433, 'feature/prd-page-stage')] });
    expect((await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER))?.retroText).toBeNull();
    expect(gh.calls.some((c) => c.includes('retro.md'))).toBe(false);
  });

  it('fails on its own while the others answer', async () => {
    const gh = shipped(pull(440, 'docs/retro-prd-page-stage'), {}, /retro\.md/);
    expect(await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({
      retroText: UNREAD, retro: { number: 440 }, feature: { state: 'merged' },
    });
  });
});

describe('the feature PR\'s care state (PRD 790, s2)', () => {
  const building = (more: Parameters<typeof fakeGithub>[0] = {}) => fakeGithub({
    inbox: ['0426-prd-page-stage'], issue: ISSUE, pulls: [merged(431, 'docs/phase-0-prd-page-stage'), pull(433, 'feature/prd-page-stage')], ...more,
  });

  it('reads it in one GraphQL query while the feature PR is open, finding the status comment by its marker', async () => {
    const gh = building({ care: { repository: { pullRequest: {
      mergeable: 'CONFLICTING', baseRefName: 'trunk',
      commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE', contexts: { nodes: [{ conclusion: 'FAILURE', detailsUrl: 'https://github.com/acme/widgets/actions/runs/7' }] } } } }] },
      reviewThreads: { nodes: [] },
      comments: { nodes: [{ body: '<!-- omni-outbox-status -->\nPR care: watching since 2026-09-28T09:00:00Z · last round 2026-09-28T09:55:00Z' }] },
    } } } });
    expect((await githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER))?.care).toEqual({
      ci: 'red', failedUrl: 'https://github.com/acme/widgets/actions/runs/7', conflict: true, base: 'trunk', threads: [],
      watchingSince: '2026-09-28T09:00:00.000Z', lastRound: '2026-09-28T09:55:00.000Z',
    });
    expect(gh.calls.filter((c) => c.startsWith('graphql'))).toEqual(['graphql acme/widgets#433']);
  });

  it('is none, with no query, when the feature PR is merged or absent', async () => {
    const shipped = fakeGithub({ shipped: ['0426-prd-page-stage'], issue: ISSUE, pulls: [merged(433, 'feature/prd-page-stage')] });
    expect((await githubReader(CREDS, shipped.fetchImpl, () => NOW).summary(DOSSIER))?.care).toBeNull();
    expect(shipped.calls).not.toContain('/graphql');
    const none = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE, pulls: [merged(431, 'docs/phase-0-prd-page-stage')] });
    expect((await githubReader(CREDS, none.fetchImpl, () => NOW).summary(DOSSIER))?.care).toBeNull();
  });

  it('fails on its own while the others answer, and is unread when the feature PR is', async () => {
    const failed = building({ fail: /^\/graphql/ });
    expect(await githubReader(CREDS, failed.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({ care: UNREAD, feature: { number: 433 } });
    const odd = building({ care: { nope: true } });
    expect((await githubReader(CREDS, odd.fetchImpl, () => NOW).summary(DOSSIER))?.care).toBe(UNREAD);
    const unread = building({ fail: /head=acme%3Afeature/ });
    expect(await githubReader(CREDS, unread.fetchImpl, () => NOW).summary(DOSSIER)).toMatchObject({ care: UNREAD, feature: UNREAD });
  });
});

describe('the numbering and the pending answers (PRD 251, s9)', () => {
  const PR = 'https://github.com/acme/widgets/pull/433';
  const NUMBERS = '<!-- omni-outbox-numbers: 1=s2-02-person@2026-09-20T00:00:00Z,2=s2-01-high-one@2026-09-20T00:00:00Z,3=s1-03-medium-one@2026-09-20T00:00:00Z,4=s1-02-zeta@2026-09-20T00:00:00Z -->';
  const reply = (id: number, body: string, login = 'marie', association = 'MEMBER', at = `2026-09-2${Math.min(id, 7)}T10:00:00Z`) =>
    ({ id, html_url: `${PR}#issuecomment-${id}`, body, created_at: at, user: { login }, author_association: association });
  const ADOPTED = `# Settled outbox items — PRD 426\n\n${settledEntry('s1-02-zeta', 'adopted', 'Adopted when raised.', item('s1-02-zeta', 'medium', 'Zeta or eta?'))}`;
  const withComments = (comments: ReturnType<typeof reply>[], fail?: RegExp) => fakeGithub({
    inbox: ['0426-prd-page-stage'], issue: ISSUE, pulls: [pull(433, 'feature/prd-page-stage')], fail,
    files: {
      [`feature/prd-page-stage:${OUTBOX}/s1-03-medium-one.md`]: item('s1-03-medium-one', 'medium', 'Medium one?'),
      [`feature/prd-page-stage:${OUTBOX}/s2-01-high-one.md`]: item('s2-01-high-one', 'high', 'High one?'),
      [`feature/prd-page-stage:${OUTBOX}/s2-02-person.md`]: item('s2-02-person', 'human-action', 'A secret?'),
      [`feature/prd-page-stage:${OUTBOX}/settled.md`]: ADOPTED,
    },
    comments: { 433: [reply(1, `Questions\n<!-- omni-outbox-pr -->\n${NUMBERS}`, 'omni-loop[bot]', 'NONE'), ...comments] },
  });
  const read = async (gh: ReturnType<typeof fakeGithub>) => githubReader(CREDS, gh.fetchImpl, () => NOW).summary(DOSSIER);

  it('keeps the outbox comment\'s numbering, and reads each adopted medium back as its item', async () => {
    const summary = await read(withComments([]));
    expect(summary?.replies).toEqual({
      numbering: [{ number: 1, id: 's2-02-person' }, { number: 2, id: 's2-01-high-one' }, { number: 3, id: 's1-03-medium-one' }, { number: 4, id: 's1-02-zeta' }],
      pending: [],
    });
    expect(summary?.outbox).toMatchObject({ adopted: [{ id: 's1-02-zeta', rank: 'medium', question: 'Zeta or eta?', bearsOn: 'none' }] });
    expect(summary?.outbox !== UNREAD && summary?.outbox?.open[0]).toMatchObject({
      intro: null, punchline: null, bearsOn: 'none', details: { decide: 'x', meanwhile: 'x', cost: 'x', unknown: 'x' },
    });
  });

  it('reads one pending answer per number with the kit\'s reply reader: its text, who, when, link, door and whether it counts', async () => {
    const summary = await read(withComments([
      reply(2, '2: B because it is cheaper\n1: ok'),
      reply(3, '2: A\n\n_answered on the Omni page · PRD 426_', 'pierre'),
      reply(4, '4: B because we object', 'uma', 'CONTRIBUTOR'),
      reply(5, '3: no idea what this is'),
    ]));
    expect(summary?.replies !== UNREAD && summary?.replies?.pending).toEqual([
      { number: 1, id: 's2-02-person', text: 'ok', by: 'marie', at: '2026-09-22T10:00:00Z', url: `${PR}#issuecomment-2`, counted: true, door: 'github' },
      { number: 2, id: 's2-01-high-one', text: 'A', by: 'pierre', at: '2026-09-23T10:00:00Z', url: `${PR}#issuecomment-3`, counted: true, door: 'page' },
      { number: 3, id: 's1-03-medium-one', text: 'no idea what this is', by: 'marie', at: '2026-09-25T10:00:00Z', url: `${PR}#issuecomment-5`, counted: true, door: 'github' },
      { number: 4, id: 's1-02-zeta', text: 'B because we object', by: 'uma', at: '2026-09-24T10:00:00Z', url: `${PR}#issuecomment-4`, counted: false, door: 'github' },
    ]);
  });

  it('lets the latest reply per number win, a counted one over one that does not count, and reads the terminal\'s door line', async () => {
    const summary = await read(withComments([
      reply(2, '2: B'),
      reply(3, '2: A\n\n_answered in the terminal · PRD 426_', 'pierre'),
      reply(4, '2: C', 'stranger', 'NONE'),
    ]));
    expect(summary?.replies !== UNREAD && summary?.replies?.pending).toEqual([
      { number: 2, id: 's2-01-high-one', text: 'A', by: 'pierre', at: '2026-09-23T10:00:00Z', url: `${PR}#issuecomment-3`, counted: true, door: 'terminal' },
    ]);
  });

  it('leaves the outbox shown and the pending answers unread when the comments cannot be read', async () => {
    const summary = await read(withComments([reply(2, '2: B')], /\/comments/));
    expect(summary).toMatchObject({ replies: UNREAD, outboxComment: UNREAD, outbox: { open: [{ id: 's1-03-medium-one' }, { id: 's2-01-high-one' }, { id: 's2-02-person' }] } });
  });

  it('has no replies without a feature PR', async () => {
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    expect((await read(gh))?.replies).toBeNull();
  });
});

describe('a fix, through the same reader (PRD 627, s5)', () => {
  const FIX = { id: 'd-fix-426', home_repo: 'acme/widgets', prd: parseIssue(426) };

  it('reads the fix PR on the config\'s fix branch shape, cached 60 s like the PRD summary', async () => {
    let now = NOW;
    const gh = fakeGithub({
      config: CONFIG.replace('  feature: feature/{topic}\n', '  feature: feature/{topic}\n  fix: hotfix/{topic}\n'),
      issue: { ...ISSUE, created_at: '2026-09-27T08:00:00Z', user: { login: 'anna' }, labels: [] },
      pulls: [pull(9, 'fix/426-darker'), pull(12, 'hotfix/426-darker')],
    });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    const first = await reader.fix(FIX);
    expect(first).toMatchObject({ issue: { author: 'anna', state: 'open' }, pull: { number: 12, state: 'open' } });
    const count = gh.fetchImpl.mock.calls.length;
    now += SUMMARY_TTL_MS - 1;
    expect(await reader.fix(FIX)).toEqual(first);
    expect(gh.fetchImpl.mock.calls.length).toBe(count);
    now += 1;
    await reader.fix(FIX);
    expect(gh.fetchImpl.mock.calls.length).toBeGreaterThan(count);
  });

  it('is null when the App is not installed, and when GitHub is unreachable', async () => {
    expect(await githubReader(CREDS, fakeGithub({ installed: false }).fetchImpl, () => NOW).fix(FIX)).toBeNull();
    expect(await githubReader(CREDS, () => Promise.reject(new TypeError('fetch failed')), () => NOW).fix(FIX)).toBeNull();
  });
});

describe('a concept, through the same reader (PRD 1272, s4)', () => {
  const CONCEPT = { id: 'd-concept-426', home_repo: 'acme/widgets', prd: parseIssue(426) };

  it('reads the concept PR on the config\'s concept branch shape, cached 60 s apart from the fix\'s', async () => {
    let now = NOW;
    const gh = fakeGithub({
      config: CONFIG.replace('  feature: feature/{topic}\n', '  feature: feature/{topic}\n  concept: ideas/{topic}\n'),
      issue: { ...ISSUE, created_at: '2026-09-27T08:00:00Z', labels: [] },
      pulls: [pull(9, 'docs/concept-426-umbrella'), pull(12, 'ideas/426-umbrella')],
    });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now);
    const first = await reader.concept(CONCEPT);
    expect(first).toMatchObject({ issue: { number: 426, state: 'open' }, pull: { number: 12, state: 'open' } });
    expect(Object.keys(first ?? {})).toEqual(['issue', 'pull']);
    const count = gh.fetchImpl.mock.calls.length;
    now += SUMMARY_TTL_MS - 1;
    expect(await reader.concept(CONCEPT)).toEqual(first);
    expect(gh.fetchImpl.mock.calls.length).toBe(count);
    now += 1;
    await reader.concept(CONCEPT);
    expect(gh.fetchImpl.mock.calls.length).toBeGreaterThan(count);
  });

  it('is null when the App is not installed, and when GitHub is unreachable', async () => {
    expect(await githubReader(CREDS, fakeGithub({ installed: false }).fetchImpl, () => NOW).concept(CONCEPT)).toBeNull();
    expect(await githubReader(CREDS, () => Promise.reject(new TypeError('fetch failed')), () => NOW).concept(CONCEPT)).toBeNull();
  });
});

describe('the budget (PRD 902, s1)', () => {
  const RESET = NOW + 30 * 60_000;
  /** The repository's calls only: the App's own (JWT) calls spend another budget. */
  const repoCalls = (gh: ReturnType<typeof fakeGithub>) => gh.calls.filter((c) => c.startsWith('/repos/acme/widgets/') && !c.endsWith('/installation'));
  const low = async () => {
    const store = memoryGithubStore();
    await store.saveBudget(5001, 'core', { limit: 5000, remaining: 100, resetAt: RESET, at: NOW });
    return store;
  };

  it('reads through the shared client: a page\'s read is interactive and spends a low budget', async () => {
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const summary = await githubReader(CREDS, gh.fetchImpl, () => NOW, await low()).summary(DOSSIER);
    expect(summary).toMatchObject({ issue: { number: 426 } });
  });

  it('defers a recount\'s background read below the floor: nothing is sent, nothing logged, nothing kept', async () => {
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW, await low());
    expect(await reader.summary(DOSSIER, { priority: 'background' })).toBeNull();
    expect(repoCalls(gh)).toEqual([]);
    expect(console.error).not.toHaveBeenCalled();
    expect(await reader.summary(DOSSIER)).toMatchObject({ issue: { number: 426 } });
  });

  it('sends nothing to the repository while the installation is paused, at either priority, and logs nothing per read', async () => {
    const store = memoryGithubStore();
    await store.pause(5001, 'core', RESET, NOW);
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => NOW, store);
    expect(await reader.summary(DOSSIER)).toBeNull();
    expect(await reader.fix({ ...DOSSIER, id: 'd-fix' }, { priority: 'background' })).toBeNull();
    expect(repoCalls(gh)).toEqual([]);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keeps no summary whose parts the budget refused, so the next read asks again', async () => {
    let now = NOW;
    const store = memoryGithubStore();
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const reader = githubReader(CREDS, gh.fetchImpl, () => now, store);
    await reader.summary({ ...DOSSIER, id: 'd-warm' }); // the repository's config, kept for 60 s
    await store.pause(5001, 'core', RESET, now);
    expect(await reader.summary(DOSSIER)).toMatchObject({ issue: UNREAD });
    now = RESET;
    expect(await reader.summary(DOSSIER)).toMatchObject({ issue: { number: 426 } });
  });

  it('sends the stored ETag again, and reads a 304 as the stored answer', async () => {
    let now = NOW;
    const store = memoryGithubStore();
    const gh = fakeGithub({ inbox: ['0426-prd-page-stage'], issue: ISSUE });
    const sentEtags: (string | undefined)[] = [];
    const withEtags = vi.fn(async (href: string, init: RequestInit) => {
      if (!href.endsWith('/issues/426')) return gh.fetchImpl(href, init);
      const asked = (init.headers as Record<string, string>)['if-none-match'];
      sentEtags.push(asked);
      if (asked === '"i1"') return new Response(null, { status: 304 });
      const answer = await gh.fetchImpl(href, init);
      return new Response(await answer.text(), { status: 200, headers: { etag: '"i1"', 'content-type': 'application/json' } });
    });
    const reader = githubReader(CREDS, withEtags, () => now, store);
    await reader.summary(DOSSIER);
    now += SUMMARY_TTL_MS;
    expect(await reader.summary(DOSSIER)).toMatchObject({ issue: { number: 426, state: 'open' } });
    expect(sentEtags).toEqual([undefined, '"i1"']);
  });
});
