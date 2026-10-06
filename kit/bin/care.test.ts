// PRD 790, slice s1: `omni care state` and `omni care reply` through `main()`, on a stubbed GitHub.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertDefined } from '../test/assert.ts';
import { makeRepo } from '../test/fixture.ts';
import { dig, digText } from './dig.ts';
import { main } from './omni.ts';
import type { ExecFileSyncOptions } from 'node:child_process';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

const CONFIG = { '.omni-loop/config.yml': 'kit: 1\nrepo:\n  slug: acme/widgets\n' };
const PLAN = [
  '# A plan',
  '',
  '| id | slice | territory | blocked by | wave |',
  '| --- | --- | --- | --- | --- |',
  '| s1 | Alpha | `a/` | — | 1 |',
  '| s2 | Beta | `b/` | — | 1 |',
  '',
].join('\n');

function repo() {
  return makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } }).root;
}

const NOW = new Date().toISOString();
const subPr = (slice: string, over = {}) => ({
  number: 20 + Number(slice.slice(1)),
  title: slice,
  headRefName: `feat/widgets--${slice}`,
  baseRefName: 'feat/widgets',
  state: 'MERGED',
  isDraft: false,
  mergedAt: NOW,
  body: '',
  labels: [],
  updatedAt: NOW,
  createdAt: NOW,
  ...over,
});

const PULL_REQUEST = {
  number: 9,
  url: 'https://github.com/acme/widgets/pull/9',
  state: 'OPEN',
  isDraft: false,
  baseRefName: 'main',
  headRefName: 'feat/widgets',
  mergeable: 'CONFLICTING',
  labels: { nodes: [] },
  commits: {
    nodes: [
      {
        commit: {
          statusCheckRollup: {
            state: 'FAILURE',
            contexts: { nodes: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://ci/run/1' }] },
          },
        },
      },
    ],
  },
  reviewThreads: {
    nodes: [
      {
        id: 'T1',
        isResolved: false,
        path: 'a/x.mjs',
        line: 2,
        comments: {
          nodes: [{ author: { login: 'rev', avatarUrl: 'https://av/rev' }, body: 'Remove the duplicate.', createdAt: NOW, url: 'https://github.com/acme/widgets/pull/9#discussion_r1' }],
        },
      },
      {
        id: 'T2',
        isResolved: true,
        path: 'a/y.mjs',
        line: 5,
        comments: {
          nodes: [
            { author: { login: 'rev', avatarUrl: 'https://av/rev' }, body: 'Rename this.', createdAt: NOW, url: 'https://github.com/acme/widgets/pull/9#discussion_r2' },
            { author: { login: 'bot', avatarUrl: 'https://av/bot' }, body: 'Naming taste.\n\n<!-- omni-care: pushed-back -->', createdAt: NOW, url: 'https://github.com/acme/widgets/pull/9#discussion_r3' },
          ],
        },
      },
    ],
  },
  comments: { nodes: [{ databaseId: 5, body: '<!-- omni-outbox-status -->\n- PR care: watching since 10:00 · last round 10:05' }] },
};

/** The JSON a recorded call sent on its stdin. */
function sentJson(call: { options: ExecFileSyncOptions } | undefined): unknown {
  assertDefined(call, 'the call');
  const { input } = call.options;
  if (typeof input !== 'string') throw new Error('the call sent no text on its stdin');
  return JSON.parse(input);
}

/** The care state `omni care state` prints, as these tests read it. */
type CareState = {
  prd: number;
  pr: unknown;
  checks: unknown;
  mergeable: string;
  threads: { id: string; verdict: string | null; needs: string | null }[];
  status: unknown;
  wave: unknown;
  round: { actions: { kind: string }[] };
};

/** A fake `execFileSync` standing in for git and gh. Records every call. */
/** What a fake GraphQL call answers instead of the defaults: the read, or the reply's mutation. */
type Graphql = { read?: unknown; reply?: unknown };

function fakeExec(
  root: string,
  { featurePrs = [{ number: 9, state: 'OPEN', updatedAt: NOW }], subPrs = [subPr('s1'), subPr('s2')], graphql = {} }: { featurePrs?: unknown[]; subPrs?: unknown[]; graphql?: Graphql } = {},
) {
  const calls: { file: string; args: readonly string[]; options: ExecFileSyncOptions }[] = [];
  // GraphQL answers by what the query asks for; the first match wins, the read last.
  const answers: [string, () => unknown][] = [
    ['addPullRequestReviewThreadReply', () => graphql.reply ?? { data: { addPullRequestReviewThreadReply: { comment: { url: 'https://github.com/acme/widgets/pull/9#discussion_r9' } } } }],
    ['resolveReviewThread', () => ({ data: { resolveReviewThread: { thread: { isResolved: true } } } })],
    ['', () => graphql.read ?? { data: { repository: { pullRequest: PULL_REQUEST } } }],
  ];
  const answerGraphql = (options: ExecFileSyncOptions) => {
    const query = digText(sentJson({ options }), 'query');
    const answer = answers.find(([asks]) => query.includes(asks));
    assertDefined(answer, `an answer to ${query}`);
    return JSON.stringify(answer[1]());
  };
  // Every command the fake answers, by its file and first two arguments.
  const handlers: Record<string, (args: readonly string[], options: ExecFileSyncOptions) => string> = {
    'git rev-parse': () => `${root}\n`,
    'gh pr list': (args) => JSON.stringify(args.includes('--head') ? featurePrs : subPrs),
    'gh api graphql': (_args, options) => answerGraphql(options),
  };
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}) => {
    calls.push({ file, args, options });
    const handler = handlers[[file, ...args.slice(0, 2)].join(' ')] ?? handlers[`${file} ${args[0]}`];
    if (!handler) throw new Error(`fakeExec: unexpected call ${file} ${args.join(' ')}`);
    return handler(args, options);
  };
  return { exec, calls };
}

async function run(argv: readonly string[], root: string, fake: ReturnType<typeof fakeExec>) {
  const s = io();
  const code = await main(argv, { cwd: root, exec: fake.exec, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

describe('omni care state', () => {
  it('prints the feature PR care state as JSON: checks, mergeable, threads with verdicts, wave claims', async () => {
    const root = repo();
    const fake = fakeExec(root);
    const { code, out } = await run(['care', 'state', '7'], root, fake);
    expect(code).toBe(0);
    const state = JSON.parse(out) as CareState;
    expect(state.prd).toBe(7);
    expect(state.pr).toMatchObject({ number: 9, state: 'OPEN', base: 'main', head: 'feat/widgets' });
    expect(state.checks).toEqual({ state: 'red', failed: [{ name: 'test', url: 'https://ci/run/1' }], stuck: false, fixable: true });
    expect(state.mergeable).toBe('CONFLICTING');
    expect(state.threads.map((t) => [t.id, t.verdict, t.needs])).toEqual([
      ['T1', null, 'judge'],
      ['T2', 'pushed-back', null],
    ]);
    expect(state.status).toEqual({ commentId: 5, watchingSince: '10:00', lastRound: '10:05' });
    expect(state.wave).toEqual({ holdsClaims: false, claimed: [] });
    expect(state.round.actions.map((a) => a.kind)).toEqual(['merge-base', 'fix-ci', 'judge', 'status']);
  });

  it('finds the feature PR by its branch, and reads it with the owner, name and number', async () => {
    const root = repo();
    const fake = fakeExec(root);
    await run(['care', 'state', '7'], root, fake);
    const list = fake.calls.find((c) => c.args[1] === 'list' && c.args.includes('--head'));
    assertDefined(list, 'the feature PR lookup');
    expect(list.args).toEqual(expect.arrayContaining(['--repo', 'acme/widgets', '--head', 'feat/widgets', '--state', 'all']));
    const read = fake.calls.find((c) => c.args[1] === 'graphql');
    expect(dig(sentJson(read), 'variables')).toEqual({ owner: 'acme', name: 'widgets', number: 9 });
  });

  it('says a wave holds claims while a sub-PR is open, and the round only reports', async () => {
    const root = repo();
    const fake = fakeExec(root, { subPrs: [subPr('s1'), subPr('s2', { state: 'OPEN', mergedAt: null, isDraft: true })] });
    const state: unknown = JSON.parse((await run(['care', 'state', '7'], root, fake)).out);
    expect(dig(state, 'wave')).toEqual({ holdsClaims: true, claimed: ['s2'] });
    expect(dig(state, 'round')).toEqual({ mode: 'report-only', actions: [{ kind: 'status' }] });
  });

  it('for a PRD of two landings, looks after the first open landing PR and restacks it once landing 1 merged', async () => {
    const plan = [
      '| id | slice | territory | blocked by | wave | landing |',
      '| --- | --- | --- | --- | --- | --- |',
      '| s1 | Expand | `db/` | — | 1 | 1 |',
      '| s2 | Code | `src/` | — | 1 | 2 |',
      '',
    ].join('\n');
    const root = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': plan } }).root;
    const landingPr = (number: number, head: string, over = {}) => subPr('s9', { number, headRefName: head, baseRefName: 'main', ...over });
    const fake = fakeExec(root, {
      subPrs: [subPr('s1', { baseRefName: 'feat/widgets-1of2-landing-1' }), subPr('s2', { baseRefName: 'feat/widgets-2of2-landing-2' })],
      featurePrs: [
        landingPr(11, 'feat/widgets-1of2-landing-1'),
        landingPr(12, 'feat/widgets-2of2-landing-2', { state: 'OPEN', mergedAt: null, isDraft: true, baseRefName: 'feat/widgets-1of2-landing-1' }),
      ],
    });
    const { code, out } = await run(['care', 'state', '7'], root, fake);
    expect(code).toBe(0);
    const read = fake.calls.find((c) => c.args[1] === 'graphql');
    expect(dig(sentJson(read), 'variables')).toEqual({ owner: 'acme', name: 'widgets', number: 12 });
    const state: unknown = JSON.parse(out);
    expect(dig(state, 'chain')).toEqual([
      {
        landing: 2,
        pr: 12,
        branch: 'feat/widgets-2of2-landing-2',
        base: 'feat/widgets-1of2-landing-1',
        retarget: true,
        after: { landing: 1, pr: 11, branch: 'feat/widgets-1of2-landing-1' },
        later: [],
      },
    ]);
    expect(dig(state, 'round')).toMatchObject({ actions: [{ kind: 'restack' }, { kind: 'merge-base' }, { kind: 'fix-ci' }, { kind: 'judge' }, { kind: 'status' }] });
  });

  it('takes --pr instead of looking the feature PR up', async () => {
    const root = repo();
    const fake = fakeExec(root);
    await run(['care', 'state', '7', '--pr', '12'], root, fake);
    expect(fake.calls.some((c) => c.args.includes('--head'))).toBe(false);
    expect(dig(sentJson(fake.calls.find((c) => c.args[1] === 'graphql')), 'variables', 'number')).toBe(12);
  });

  it('prefers the open feature PR over a closed one', async () => {
    const root = repo();
    const fake = fakeExec(root, { featurePrs: [{ number: 3, state: 'CLOSED', updatedAt: NOW }, { number: 9, state: 'OPEN', updatedAt: NOW }] });
    await run(['care', 'state', '7'], root, fake);
    expect(dig(sentJson(fake.calls.find((c) => c.args[1] === 'graphql')), 'variables', 'number')).toBe(9);
  });

  it('exits 1 with one line when the PRD has no feature PR', async () => {
    const root = repo();
    const { code, err } = await run(['care', 'state', '7'], root, fakeExec(root, { featurePrs: [] }));
    expect(code).toBe(1);
    expect(err).toMatch(/no feature PR.*feat\/widgets/);
  });

  it('refuses a missing PRD number', async () => {
    const root = repo();
    expect((await run(['care', 'state'], root, fakeExec(root))).code).toBe(2);
  });
});

describe('omni care reply', () => {
  it('builds a body ending with the marker, and posts nothing without --thread', async () => {
    const root = repo();
    const fake = fakeExec(root);
    const { code, out } = await run(['care', 'reply', '--verdict', 'pushed-back', '--body', 'Low value for this PR: naming preference.'], root, fake);
    expect(code).toBe(0);
    expect(out).toBe('Low value for this PR: naming preference.\n\n<!-- omni-care: pushed-back -->\n');
    expect(fake.calls.some((c) => c.file === 'gh')).toBe(false);
  });

  it('reads the text from --file', async () => {
    const root = repo();
    writeFileSync(join(root, 'reply.md'), 'Fixed in abc1234: one helper.\n');
    const { out } = await run(['care', 'reply', '--verdict', 'fixed', '--file', 'reply.md'], root, fakeExec(root));
    expect(out).toBe('Fixed in abc1234: one helper.\n\n<!-- omni-care: fixed -->\n');
  });

  it.each(['fixed', 'pushed-back'])('posts a %s reply on the thread and resolves it', async (verdict: string) => {
    const root = repo();
    const fake = fakeExec(root);
    const { code, out } = await run(['care', 'reply', '--verdict', verdict, '--body', 'Why.', '--thread', 'T1'], root, fake);
    expect(code).toBe(0);
    const [reply, resolve] = fake.calls.filter((c) => c.args[1] === 'graphql').map((c) => sentJson(c));
    expect(dig(reply, 'variables')).toEqual({ thread: 'T1', body: `Why.\n\n<!-- omni-care: ${verdict} -->` });
    expect(dig(resolve, 'query')).toMatch(/resolveReviewThread/);
    expect(dig(resolve, 'variables')).toEqual({ thread: 'T1' });
    expect(JSON.parse(out)).toEqual({ thread: 'T1', verdict, url: 'https://github.com/acme/widgets/pull/9#discussion_r9', resolved: true });
  });

  it('posts an asked reply and leaves the thread open', async () => {
    const root = repo();
    const fake = fakeExec(root);
    const { out } = await run(['care', 'reply', '--verdict', 'asked', '--body', 'The PM will decide.', '--thread', 'T1'], root, fake);
    expect(fake.calls.filter((c) => c.args[1] === 'graphql')).toHaveLength(1);
    expect(JSON.parse(out)).toMatchObject({ verdict: 'asked', resolved: false });
  });

  it('exits 1 when GitHub refuses the reply', async () => {
    const root = repo();
    const fake = fakeExec(root, { graphql: { reply: { errors: [{ message: 'Could not resolve to a node' }] } } });
    const { code, err } = await run(['care', 'reply', '--verdict', 'fixed', '--body', 'x', '--thread', 'nope'], root, fake);
    expect(code).toBe(1);
    expect(err).toMatch(/Could not resolve to a node/);
  });

  it('refuses an unknown verdict, and a reply with no text', async () => {
    const root = repo();
    expect((await run(['care', 'reply', '--verdict', 'maybe', '--body', 'x'], root, fakeExec(root))).code).toBe(2);
    expect((await run(['care', 'reply', '--verdict', 'fixed'], root, fakeExec(root))).code).toBe(2);
  });

  it('refuses an unknown subcommand', async () => {
    const root = repo();
    expect((await run(['care', 'watch'], root, fakeExec(root))).code).toBe(2);
  });
});

// PRD 1118, slice s1: a plan repository's targets, through `omni care state --repo` and `omni care list`.
const PLAN_CONFIG = [
  'kit: 1',
  'repo:',
  '  slug: acme/plan',
  'plan:',
  '  targets:',
  '    - repo: acme/backend',
  '      role: back-end',
  '      knowledge: none',
  '    - repo: acme/frontend',
  '      role: front-end',
  '      knowledge: none',
  '',
].join('\n');

/** A plan of a back-end slice in wave 1 and a front-end one in wave 2, its `## Repositories` naming
 * the front-end first; `landing` adds a column putting `s3` in the back-end's landing 2. */
function multiPlan({ landing = false } = {}): string {
  const head = landing ? '| id | repo | slice | territory | blocked by | wave | landing |' : '| id | repo | slice | territory | blocked by | wave |';
  const cell = (n: number) => (landing ? ` ${n} |` : '');
  return [
    '# A plan',
    '',
    head,
    landing ? '| --- | --- | --- | --- | --- | --- | --- |' : '| --- | --- | --- | --- | --- | --- |',
    `| s1 | backend | Alpha | \`a/\` | — | 1 |${cell(1)}`,
    `| s2 | frontend | Beta | \`b/\` | — | 2 |${cell(1)}`,
    ...(landing ? [`| s3 | backend | Gamma | \`c/\` | — | 3 |${cell(2)}`] : []),
    '',
    '## Repositories',
    '',
    '| repo | role | read at | knowledge |',
    '| --- | --- | --- | --- |',
    '| frontend | front-end | abc | none |',
    '| backend | back-end | abc | none |',
    '',
  ].join('\n');
}

function planRepo(options: { landing?: boolean } = {}) {
  return makeRepo({ git: true, files: { '.omni-loop/config.yml': PLAN_CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': multiPlan(options) } }).root;
}

/** What the plan fake answers, by repository slug. */
type PlanGh = {
  /** Sub-PRs into a feature or landing branch, by slug. */
  subs?: Record<string, unknown[]>;
  /** Pull requests by head branch, by slug then branch. */
  heads?: Record<string, Record<string, unknown[]>>;
  /** `gh pr view <n> --repo <slug>`, by `<slug>#<n>`. */
  views?: Record<string, unknown>;
  issues?: unknown[];
  issueViews?: Record<string, unknown>;
  failing?: string[];
  read?: unknown;
};

const pr = (number: number, state = 'OPEN', over = {}) => ({ number, state, url: `https://github.com/x/pull/${number}`, updatedAt: NOW, ...over });

function fakePlanExec(root: string, gh: PlanGh = {}) {
  const calls: { file: string; args: readonly string[]; options: ExecFileSyncOptions }[] = [];
  const at = (args: readonly string[], flag: string) => String(args[args.indexOf(flag) + 1]);
  // Every `gh` call the fake answers with JSON, by its first two arguments and the slug it reads.
  const answers: Record<string, (args: readonly string[], slug: string) => unknown> = {
    'pr list': (args, slug) => (args.includes('--head') ? (gh.heads?.[slug]?.[at(args, '--head')] ?? []) : (gh.subs?.[slug] ?? [])),
    'pr view': (args, slug) => gh.views?.[`${slug}#${args[2]}`] ?? { number: Number(args[2]), state: 'OPEN', url: null },
    'issue list': () => gh.issues ?? [],
    'issue view': (args) => gh.issueViews?.[String(args[2])] ?? { comments: [], closedByPullRequestsReferences: [] },
  };
  const unreadable = (slug: string) => {
    if (gh.failing?.includes(slug)) throw Object.assign(new Error('gh: Could not resolve to a Repository'), { stderr: 'GraphQL: Could not resolve to a Repository' });
  };
  const answer = (args: readonly string[]): unknown => {
    const key = args.slice(0, 2).join(' ');
    if (key === 'api graphql') return gh.read ?? { data: { repository: { pullRequest: PULL_REQUEST } } };
    const slug = at(args, '--repo');
    unreadable(slug);
    const handler = answers[key];
    assertDefined(handler, `an answer to gh ${args.join(' ')}`);
    return handler(args, slug);
  };
  const defaultBranch = (args: readonly string[]) => {
    unreadable(String(args[2]));
    return args[2] === 'acme/backend' ? 'develop\n' : 'main\n';
  };
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}) => {
    calls.push({ file, args, options });
    if (file === 'git') return `${root}\n`;
    return args[0] === 'repo' ? defaultBranch(args) : JSON.stringify(answer(args));
  };
  return { exec, calls };
}

const openSub = (slice: string, over = {}) => subPr(slice, { state: 'OPEN', mergedAt: null, isDraft: true, ...over });
const readOf = (comments: string) => ({ data: { repository: { pullRequest: { ...PULL_REQUEST, comments: { nodes: [{ databaseId: 5, body: comments }] } } } } });

describe('omni care state --repo <target> — a target of a plan repository (PRD 1118)', () => {
  it("restacks a target's landing onto the target's own default branch, read from GitHub", async () => {
    const root = planRepo({ landing: true });
    const fake = fakePlanExec(root, {
      heads: {
        'acme/backend': {
          'feat/widgets-1of2-landing-1': [subPr('s9', { number: 11, headRefName: 'feat/widgets-1of2-landing-1', baseRefName: 'develop' })],
          'feat/widgets-2of2-landing-2': [openSub('s9', { number: 12, headRefName: 'feat/widgets-2of2-landing-2', baseRefName: 'develop' })],
        },
      },
    });
    const { code, out } = await run(['care', 'state', '7', '--repo', 'acme/backend', '--pr', '12'], root, fake);
    expect(code).toBe(0);
    const state: unknown = JSON.parse(out);
    expect(dig(state, 'target')).toEqual({ name: 'backend', slug: 'acme/backend', defaultBranch: 'develop' });
    expect(dig(state, 'chain')).toMatchObject([{ pr: 12, base: 'develop', retarget: false, after: { pr: 11 } }]);
    expect(dig(state, 'landings')).toHaveLength(2);
    expect(dig(sentJson(fake.calls.find((c) => c.args[1] === 'graphql')), 'variables')).toEqual({ owner: 'acme', name: 'backend', number: 12 });
  });

  it("acts while a wave holds claims only on another target's slices, and only reports while one holds its own", async () => {
    const root = planRepo();
    const gh = { subs: { 'acme/backend': [subPr('s1')], 'acme/frontend': [openSub('s2')] } };
    const backend: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/backend', '--pr', '40'], root, fakePlanExec(root, gh))).out);
    expect(dig(backend, 'wave')).toEqual({ holdsClaims: false, claimed: [] });
    expect(dig(backend, 'round', 'mode')).toBe('act');
    const frontend: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, fakePlanExec(root, gh))).out);
    expect(dig(frontend, 'wave')).toEqual({ holdsClaims: true, claimed: ['s2'] });
    expect(dig(frontend, 'round', 'mode')).toBe('report-only');
  });

  it("finds a target's feature PR in the target when --pr is not given", async () => {
    const root = planRepo();
    const fake = fakePlanExec(root, { heads: { 'acme/frontend': { 'feat/widgets': [pr(45)] } } });
    await run(['care', 'state', '7', '--repo', 'acme/frontend'], root, fake);
    expect(dig(sentJson(fake.calls.find((c) => c.args[1] === 'graphql')), 'variables')).toEqual({ owner: 'acme', name: 'frontend', number: 45 });
  });

  it('lists no fix-ci while the PR it waits on is open, and one rerun once that PR merged', async () => {
    const root = planRepo();
    const read = readOf('<!-- omni-outbox-status -->\n- PR care: watching since a · last round b\n- waits on acme/backend#41\n');
    const waiting: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, fakePlanExec(root, { read }))).out);
    expect(dig(waiting, 'waitsOn')).toEqual({ slug: 'acme/backend', pr: 41, state: 'open' });
    expect(dig(waiting, 'round')).toEqual({ mode: 'act', actions: [{ kind: 'merge-base', base: 'main' }, { kind: 'judge', thread: 'T1' }, { kind: 'status' }], waitsOn: 'acme/backend#41' });
    const views = { 'acme/backend#41': { number: 41, state: 'MERGED', url: null } };
    const merged: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, fakePlanExec(root, { read, views }))).out);
    expect(dig(merged, 'round', 'actions', 1)).toEqual({ kind: 'rerun', failed: [{ name: 'test', url: 'https://ci/run/1' }] });
  });

  it('holds when the PR it waits on cannot be read', async () => {
    const root = planRepo();
    const read = readOf('<!-- omni-outbox-status -->\n- waits on acme/backend#41\n');
    const fake = fakePlanExec(root, { read, failing: ['acme/backend'] });
    const state: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, fake)).out);
    expect(dig(state, 'waitsOn', 'state')).toBe('unreadable');
  });

  it('reads the plan PR as today when --repo names no target', async () => {
    const root = planRepo();
    const gh = { subs: { 'acme/frontend': [openSub('s2')] }, heads: { 'acme/plan': { 'feat/widgets': [pr(9)] } } };
    const state: unknown = JSON.parse((await run(['care', 'state', '7'], root, fakePlanExec(root, gh))).out);
    expect(dig(state, 'target')).toBeUndefined();
    expect(dig(state, 'wave')).toEqual({ holdsClaims: true, claimed: ['s2'] });
  });
});

describe('omni care list (PRD 1118)', () => {
  const BUG_PLAN = [
    '<!-- omni-bug:fix-plan -->',
    '| order | repository | what changes | pull request |',
    '| --- | --- | --- | --- |',
    '| 1 | backend | restore the total | acme/backend#41 |',
    '| 2 | frontend | show it | acme/frontend#46 |',
  ].join('\n');
  const GH: PlanGh = {
    heads: {
      'acme/backend': { 'feat/widgets': [pr(40)] },
      'acme/frontend': { 'feat/widgets': [pr(44, 'CLOSED', { updatedAt: '2026-01-01' }), pr(45)] },
      'acme/plan': { 'feat/widgets': [pr(9)] },
    },
    issues: [
      { number: 30, body: 'The total is wrong.\n\nFor PRD #7\n' },
      { number: 31, body: 'Another.\n\nFor PRD #8\n' },
    ],
    issueViews: {
      30: { comments: [{ body: 'triage' }, { body: BUG_PLAN }], closedByPullRequestsReferences: [{ number: 51, url: 'https://github.com/acme/plan/pull/51' }] },
    },
    views: { 'acme/backend#41': { number: 41, state: 'MERGED', url: 'https://github.com/acme/backend/pull/41' } },
  };
  type Entry = { repo: string; number: number | null; kind: string; target: string | null; state: string; bug?: number };
  const brief = (out: string) => (JSON.parse(out) as Entry[]).map((e) => `${e.kind} ${e.repo}#${e.number ?? '-'} ${e.state}${e.target ? ` ${e.target}` : ''}`);

  it('lists the target PRs, the linked bug fixes and their record, then the plan PR, in merge order', async () => {
    const root = planRepo();
    const fake = fakePlanExec(root, GH);
    const { code, out } = await run(['care', 'list', '7', '--json'], root, fake);
    expect(code).toBe(0);
    expect(brief(out)).toEqual([
      'target acme/backend#40 open backend',
      'target acme/frontend#45 open frontend',
      'bug-fix acme/backend#41 merged backend',
      'bug-fix acme/frontend#46 open frontend',
      'bug-record acme/plan#51 open',
      'plan acme/plan#9 open',
    ]);
    expect((JSON.parse(out) as Entry[])[2]).toMatchObject({ bug: 30 });
    const issues = fake.calls.find((c) => c.args[0] === 'issue' && c.args[1] === 'list');
    assertDefined(issues, 'the bug lookup');
    expect(issues.args).toEqual(expect.arrayContaining(['--repo', 'acme/plan', '--label', 'omni:bug', '--state', 'all']));
  });

  it("lists each landing of a target's chain in the plan's landing order", async () => {
    const root = planRepo({ landing: true });
    const fake = fakePlanExec(root, {
      heads: {
        'acme/backend': { 'feat/widgets-1of2-landing-1': [pr(11)], 'feat/widgets-2of2-landing-2': [pr(12)] },
        'acme/frontend': { 'feat/widgets': [pr(45)] },
        'acme/plan': { 'feat/widgets': [pr(9)] },
      },
    });
    const { out } = await run(['care', 'list', '7', '--json'], root, fake);
    expect(brief(out)).toEqual(['landing acme/backend#11 open backend', 'target acme/frontend#45 open frontend', 'landing acme/backend#12 open backend', 'plan acme/plan#9 open']);
    expect((JSON.parse(out) as unknown[])[2]).toMatchObject({ landing: { landing: 2, count: 2, name: 'landing-2' } });
  });

  it('lists a repository it cannot read as unreadable, never failing', async () => {
    const root = planRepo();
    const { code, out } = await run(['care', 'list', '7', '--json'], root, fakePlanExec(root, { ...GH, failing: ['acme/frontend'] }));
    expect(code).toBe(0);
    expect(brief(out)).toEqual([
      'target acme/backend#40 open backend',
      'target acme/frontend#- unreadable frontend',
      'bug-fix acme/backend#41 merged backend',
      'bug-fix acme/frontend#46 unreadable frontend',
      'bug-record acme/plan#51 open',
      'plan acme/plan#9 open',
    ]);
  });

  it('prints one line per pull request without --json', async () => {
    const root = planRepo();
    const { code, out } = await run(['care', 'list', '7'], root, fakePlanExec(root, GH));
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toMatch(/PRD 7: 6 pull requests/);
    expect(out).toMatch(/1\. target +acme\/backend#40 — open — backend/);
    expect(out).toMatch(/6\. plan +acme\/plan#9 — open\n/);
  });

  it('exits 2 with one line outside a plan repository', async () => {
    const root = repo();
    const { code, err } = await run(['care', 'list', '7'], root, fakeExec(root));
    expect(code).toBe(2);
    expect(err.trim().split('\n')).toHaveLength(1);
    expect(err).toMatch(/not a plan repository/);
  });
});
