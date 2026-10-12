// PRD 790, slice s1: `omni care state` and `omni care reply` through `main()`. PRD 1665, s4: the reads
// come from the shared fake `LoopReads`, built from the same facts the `gh` fixtures held; `gh` only
// answers the writes (`care reply`) and a target's default branch.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertDefined } from '../test/assert.ts';
import { makeRepo } from '../test/fixture.ts';
import { parseCommentId, parseIssue, parsePr } from '../lib/ids.ts';
import type { LoopChange, LoopChangeDetail, LoopComment, LoopIssue, LoopIssueDetail } from '../lib/loop-reads/contract.ts';
import { aChange, fakeLoopReads } from '../lib/loop-reads/fake.ts';
import type { FakeLoopState, FakeRead } from '../lib/loop-reads/fake.ts';
import { LoopReadError } from '../lib/loop-reads/port.ts';
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

/** A slice's sub-PR into the feature branch, merged unless `over` says otherwise. */
const subPr = (slice: string, over: Partial<LoopChange> = {}): LoopChange =>
  aChange({
    number: parsePr(20 + Number(slice.slice(1))),
    title: slice,
    head: `feat/widgets--${slice}`,
    base: 'feat/widgets',
    state: 'merged',
    mergedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  });
const openSub = (slice: string, over: Partial<LoopChange> = {}) => subPr(slice, { state: 'draft', mergedAt: null, ...over });

/** A feature (or target, or plan) PR from `feat/widgets`, open unless `state` says otherwise. */
const pr = (number: number, state: LoopChange['state'] = 'open', over: Partial<LoopChange> = {}): LoopChange =>
  aChange({ number: parsePr(number), head: 'feat/widgets', base: 'main', state, url: `https://github.com/x/pull/${number}`, updatedAt: NOW, ...over });

/** The review every watched PR carries: one failed check, a conflict, a thread to judge and one pushed back. */
const REVIEW: LoopChangeDetail['review'] = {
  checks: [{ name: 'test', state: 'failure' }],
  mergeable: false,
  threads: [
    { id: 'T1', resolved: false, path: 'a/x.mjs', line: 2, comments: [{ author: 'rev', body: 'Remove the duplicate.', createdAt: NOW }] },
    {
      id: 'T2',
      resolved: true,
      path: 'a/y.mjs',
      line: 5,
      comments: [
        { author: 'rev', body: 'Rename this.', createdAt: NOW },
        { author: 'bot', body: 'Naming taste.\n\n<!-- omni-care: pushed-back -->', createdAt: NOW },
      ],
    },
  ],
};
const STATUS = '<!-- omni-outbox-status -->\n- PR care: watching since 10:00 · last round 10:05';
const comment = (body: string): LoopComment => ({ id: parseCommentId(5), author: 'bot', body, createdAt: NOW, updatedAt: NOW });

/** One repository of the fake: its changes, and the numbers of those a round reads with `REVIEW` and its status comment. */
type RepoFacts = { changes?: LoopChange[]; watched?: number[]; status?: string };

/** The fake `LoopReads` of `repos`, by slug, with the issues and the repositories refused alone. */
function loopOf(
  repos: Record<string, RepoFacts>,
  { issues = {}, issueDetails = {}, failing = [] }: { issues?: Record<string, LoopIssue[]>; issueDetails?: FakeLoopState['issueDetails']; failing?: string[] } = {},
) {
  const state: Required<Pick<FakeLoopState, 'changes' | 'details' | 'comments'>> & FakeLoopState = { changes: {}, details: {}, comments: {}, issues, issueDetails };
  for (const [slug, { changes = [], watched = [], status = STATUS }] of Object.entries(repos)) {
    state.changes[slug] = changes;
    for (const number of watched) {
      state.details[`${slug}#${number}`] = { review: REVIEW };
      state.comments[`${slug}#${number}`] = [comment(status)];
    }
  }
  state.failing = Object.fromEntries(failing.map((slug) => [slug, new LoopReadError(`refused (424): the Omni app cannot read ${slug}`, 'repository')]));
  return fakeLoopReads(state);
}

/** The single repository's fake: sub-PRs into the feature branch, its feature PRs, the PRs a round reads. */
function widgets({ subs = [subPr('s1'), subPr('s2')], features = [pr(9, 'open', { url: 'https://github.com/acme/widgets/pull/9' })], watched = [9] }: { subs?: LoopChange[]; features?: LoopChange[]; watched?: number[] } = {}) {
  return loopOf({ 'acme/widgets': { changes: [...subs, ...features], watched } });
}

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

/** What a fake GraphQL write answers instead of the default: the reply's mutation. */
type Graphql = { reply?: unknown };

/** A fake `execFileSync` standing in for git and for `gh`'s writes and a target's default branch. Records every call. */
function fakeExec(root: string, { graphql = {} }: { graphql?: Graphql } = {}) {
  const calls: { file: string; args: readonly string[]; options: ExecFileSyncOptions }[] = [];
  const answers: [string, () => unknown][] = [
    ['addPullRequestReviewThreadReply', () => graphql.reply ?? { data: { addPullRequestReviewThreadReply: { comment: { url: 'https://github.com/acme/widgets/pull/9#discussion_r9' } } } }],
    ['resolveReviewThread', () => ({ data: { resolveReviewThread: { thread: { isResolved: true } } } })],
  ];
  const answerGraphql = (options: ExecFileSyncOptions) => {
    const query = digText(sentJson({ options }), 'query');
    const answer = answers.find(([asks]) => query.includes(asks));
    assertDefined(answer, `an answer to ${query}`);
    return JSON.stringify(answer[1]());
  };
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}) => {
    calls.push({ file, args, options });
    if (file === 'git') return `${root}\n`;
    if (args[0] === 'api' && args[1] === 'graphql') return answerGraphql(options);
    if (args[0] === 'repo' && args[1] === 'view') return args[2] === 'acme/backend' ? 'develop\n' : 'main\n';
    throw new Error(`fakeExec: unexpected call ${file} ${args.join(' ')}`);
  };
  return { exec, calls };
}

async function run(argv: readonly string[], root: string, reads: ReturnType<typeof fakeLoopReads>, fake = fakeExec(root)) {
  const s = io();
  const code = await main(argv, { cwd: root, exec: fake.exec, reads, ...s });
  return { code, out: s.out.join(''), err: s.err.join(''), calls: fake.calls };
}

/** The PR numbers a round read as one change, in order. */
const changeReads = (reads: FakeRead[]) => reads.flatMap((read) => (read.read === 'change' ? [`${read.repo}#${read.number}`] : []));

describe('omni care state', () => {
  it('prints the feature PR care state as JSON: checks, mergeable, threads with verdicts, wave claims', async () => {
    const root = repo();
    const { code, out, calls } = await run(['care', 'state', '7'], root, widgets());
    expect(code).toBe(0);
    const state = JSON.parse(out) as CareState;
    expect(state.prd).toBe(7);
    expect(state.pr).toMatchObject({ number: 9, state: 'OPEN', base: 'main', head: 'feat/widgets' });
    expect(state.checks).toEqual({ state: 'red', failed: [{ name: 'test', url: null }], stuck: false, fixable: true });
    expect(state.mergeable).toBe('CONFLICTING');
    expect(state.threads.map((t) => [t.id, t.verdict, t.needs])).toEqual([
      ['T1', null, 'judge'],
      ['T2', 'pushed-back', null],
    ]);
    expect(state.status).toEqual({ commentId: 5, watchingSince: '10:00', lastRound: '10:05' });
    expect(state.wave).toEqual({ holdsClaims: false, claimed: [] });
    expect(state.round.actions.map((a) => a.kind)).toEqual(['merge-base', 'fix-ci', 'judge', 'status']);
    expect(calls.filter((call) => call.file === 'gh')).toEqual([]);
  });

  it('finds the feature PR by its branch, and reads that change and its comments', async () => {
    const root = repo();
    const reads = widgets();
    await run(['care', 'state', '7'], root, reads);
    expect(reads.reads).toContainEqual({ read: 'changes', query: { repo: 'acme/widgets', head: 'feat/widgets', state: 'all' } });
    expect(reads.reads).toContainEqual({ read: 'change', repo: 'acme/widgets', number: 9 });
    expect(reads.reads).toContainEqual({ read: 'comments', repo: 'acme/widgets', on: 9 });
  });

  it('says a wave holds claims while a sub-PR is open, and the round only reports', async () => {
    const root = repo();
    const state: unknown = JSON.parse((await run(['care', 'state', '7'], root, widgets({ subs: [subPr('s1'), openSub('s2')] }))).out);
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
    const landingPr = (number: number, head: string, over: Partial<LoopChange> = {}) => subPr('s9', { number: parsePr(number), head, base: 'main', ...over });
    const reads = widgets({
      subs: [subPr('s1', { base: 'feat/widgets-1of2-landing-1' }), subPr('s2', { base: 'feat/widgets-2of2-landing-2' })],
      features: [
        landingPr(11, 'feat/widgets-1of2-landing-1'),
        landingPr(12, 'feat/widgets-2of2-landing-2', { state: 'draft', mergedAt: null, base: 'feat/widgets-1of2-landing-1' }),
      ],
      watched: [12],
    });
    const { code, out } = await run(['care', 'state', '7'], root, reads);
    expect(code).toBe(0);
    expect(changeReads(reads.reads)).toEqual(['acme/widgets#12']);
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
    const reads = widgets({ features: [pr(9), pr(12, 'open', { head: 'feat/other' })], watched: [12] });
    await run(['care', 'state', '7', '--pr', '12'], root, reads);
    expect(reads.reads.some((read) => read.read === 'changes' && read.query.head !== undefined)).toBe(false);
    expect(changeReads(reads.reads)).toEqual(['acme/widgets#12']);
  });

  it('prefers the open feature PR over a closed one', async () => {
    const root = repo();
    const reads = widgets({ features: [pr(3, 'closed'), pr(9)] });
    await run(['care', 'state', '7'], root, reads);
    expect(changeReads(reads.reads)).toEqual(['acme/widgets#9']);
  });

  it('exits 1 with one line when the PRD has no feature PR', async () => {
    const root = repo();
    const { code, err } = await run(['care', 'state', '7'], root, widgets({ features: [] }));
    expect(code).toBe(1);
    expect(err).toMatch(/no feature PR.*feat\/widgets/);
  });

  it('exits 1 with the one line of a read that cannot be made: no sign-in', async () => {
    const root = repo();
    const reads = fakeLoopReads({ everything: new LoopReadError('no sign-in (omni signin)', 'everything') });
    const { code, out, err } = await run(['care', 'state', '7'], root, reads);
    expect(code).toBe(1);
    expect(out).toBe('');
    expect(err).toBe('no sign-in (omni signin)\n');
  });

  it('refuses a missing PRD number', async () => {
    const root = repo();
    expect((await run(['care', 'state'], root, widgets())).code).toBe(2);
  });
});

describe('omni care reply', () => {
  it('builds a body ending with the marker, and posts nothing without --thread', async () => {
    const root = repo();
    const { code, out, calls } = await run(['care', 'reply', '--verdict', 'pushed-back', '--body', 'Low value for this PR: naming preference.'], root, widgets());
    expect(code).toBe(0);
    expect(out).toBe('Low value for this PR: naming preference.\n\n<!-- omni-care: pushed-back -->\n');
    expect(calls.some((c) => c.file === 'gh')).toBe(false);
  });

  it('reads the text from --file', async () => {
    const root = repo();
    writeFileSync(join(root, 'reply.md'), 'Fixed in abc1234: one helper.\n');
    const { out } = await run(['care', 'reply', '--verdict', 'fixed', '--file', 'reply.md'], root, widgets());
    expect(out).toBe('Fixed in abc1234: one helper.\n\n<!-- omni-care: fixed -->\n');
  });

  it.each(['fixed', 'pushed-back'])('posts a %s reply on the thread and resolves it', async (verdict: string) => {
    const root = repo();
    const reads = widgets();
    const { code, out, calls } = await run(['care', 'reply', '--verdict', verdict, '--body', 'Why.', '--thread', 'T1'], root, reads);
    expect(code).toBe(0);
    const [reply, resolve] = calls.filter((c) => c.args[1] === 'graphql').map((c) => sentJson(c));
    expect(dig(reply, 'variables')).toEqual({ thread: 'T1', body: `Why.\n\n<!-- omni-care: ${verdict} -->` });
    expect(dig(resolve, 'query')).toMatch(/resolveReviewThread/);
    expect(dig(resolve, 'variables')).toEqual({ thread: 'T1' });
    expect(JSON.parse(out)).toEqual({ thread: 'T1', verdict, url: 'https://github.com/acme/widgets/pull/9#discussion_r9', resolved: true });
    expect(reads.reads).toEqual([]);
  });

  it('posts an asked reply and leaves the thread open', async () => {
    const root = repo();
    const { out, calls } = await run(['care', 'reply', '--verdict', 'asked', '--body', 'The PM will decide.', '--thread', 'T1'], root, widgets());
    expect(calls.filter((c) => c.args[1] === 'graphql')).toHaveLength(1);
    expect(JSON.parse(out)).toMatchObject({ verdict: 'asked', resolved: false });
  });

  it('exits 1 when GitHub refuses the reply', async () => {
    const root = repo();
    const fake = fakeExec(root, { graphql: { reply: { errors: [{ message: 'Could not resolve to a node' }] } } });
    const { code, err } = await run(['care', 'reply', '--verdict', 'fixed', '--body', 'x', '--thread', 'nope'], root, widgets(), fake);
    expect(code).toBe(1);
    expect(err).toMatch(/Could not resolve to a node/);
  });

  it('refuses an unknown verdict, and a reply with no text', async () => {
    const root = repo();
    expect((await run(['care', 'reply', '--verdict', 'maybe', '--body', 'x'], root, widgets())).code).toBe(2);
    expect((await run(['care', 'reply', '--verdict', 'fixed'], root, widgets())).code).toBe(2);
  });

  it('refuses an unknown subcommand', async () => {
    const root = repo();
    expect((await run(['care', 'watch'], root, widgets())).code).toBe(2);
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

describe('omni care state --repo <target> — a target of a plan repository (PRD 1118)', () => {
  it("restacks a target's landing onto the target's own default branch, read from GitHub", async () => {
    const root = planRepo({ landing: true });
    const reads = loopOf({
      'acme/backend': {
        changes: [
          subPr('s9', { number: parsePr(11), head: 'feat/widgets-1of2-landing-1', base: 'develop' }),
          openSub('s9', { number: parsePr(12), head: 'feat/widgets-2of2-landing-2', base: 'develop' }),
        ],
        watched: [12],
      },
    });
    const { code, out } = await run(['care', 'state', '7', '--repo', 'acme/backend', '--pr', '12'], root, reads);
    expect(code).toBe(0);
    const state: unknown = JSON.parse(out);
    expect(dig(state, 'target')).toEqual({ name: 'backend', slug: 'acme/backend', defaultBranch: 'develop' });
    expect(dig(state, 'chain')).toMatchObject([{ pr: 12, base: 'develop', retarget: false, after: { pr: 11 } }]);
    expect(dig(state, 'landings')).toHaveLength(2);
    expect(changeReads(reads.reads)).toEqual(['acme/backend#12']);
  });

  it("acts while a wave holds claims only on another target's slices, and only reports while one holds its own", async () => {
    const root = planRepo();
    const repos = (watched: Record<string, number[]>) =>
      loopOf({ 'acme/backend': { changes: [subPr('s1'), pr(40)], watched: watched['acme/backend'] ?? [] }, 'acme/frontend': { changes: [openSub('s2'), pr(45)], watched: watched['acme/frontend'] ?? [] } });
    const backend: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/backend', '--pr', '40'], root, repos({ 'acme/backend': [40] }))).out);
    expect(dig(backend, 'wave')).toEqual({ holdsClaims: false, claimed: [] });
    expect(dig(backend, 'round', 'mode')).toBe('act');
    const frontend: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, repos({ 'acme/frontend': [45] }))).out);
    expect(dig(frontend, 'wave')).toEqual({ holdsClaims: true, claimed: ['s2'] });
    expect(dig(frontend, 'round', 'mode')).toBe('report-only');
  });

  it("finds a target's feature PR in the target when --pr is not given", async () => {
    const root = planRepo();
    const reads = loopOf({ 'acme/frontend': { changes: [pr(45)], watched: [45] } });
    await run(['care', 'state', '7', '--repo', 'acme/frontend'], root, reads);
    expect(reads.reads).toContainEqual({ read: 'changes', query: { repo: 'acme/frontend', head: 'feat/widgets', state: 'all' } });
    expect(changeReads(reads.reads)).toEqual(['acme/frontend#45']);
  });

  it('lists no fix-ci while the PR it waits on is open, and one rerun once that PR merged', async () => {
    const root = planRepo();
    const status = '<!-- omni-outbox-status -->\n- PR care: watching since a · last round b\n- waits on acme/backend#41\n';
    const waitedOn = (state: LoopChange['state']) =>
      loopOf({ 'acme/frontend': { changes: [pr(45)], watched: [45], status }, 'acme/backend': { changes: [pr(41, state, { head: 'fix/total' })] } });
    const waiting: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, waitedOn('open'))).out);
    expect(dig(waiting, 'waitsOn')).toEqual({ slug: 'acme/backend', pr: 41, state: 'open' });
    expect(dig(waiting, 'round')).toEqual({ mode: 'act', actions: [{ kind: 'merge-base', base: 'main' }, { kind: 'judge', thread: 'T1' }, { kind: 'status' }], waitsOn: 'acme/backend#41' });
    const merged: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, waitedOn('merged'))).out);
    expect(dig(merged, 'round', 'actions', 1)).toEqual({ kind: 'rerun', failed: [{ name: 'test', url: null }] });
  });

  it('holds when the PR it waits on cannot be read', async () => {
    const root = planRepo();
    const status = '<!-- omni-outbox-status -->\n- waits on acme/backend#41\n';
    const reads = loopOf({ 'acme/frontend': { changes: [pr(45)], watched: [45], status } }, { failing: ['acme/backend'] });
    const state: unknown = JSON.parse((await run(['care', 'state', '7', '--repo', 'acme/frontend', '--pr', '45'], root, reads)).out);
    expect(dig(state, 'waitsOn', 'state')).toBe('unreadable');
  });

  it('reads the plan PR as today when --repo names no target', async () => {
    const root = planRepo();
    const reads = loopOf({ 'acme/frontend': { changes: [openSub('s2')] }, 'acme/plan': { changes: [pr(9)], watched: [9] } });
    const state: unknown = JSON.parse((await run(['care', 'state', '7'], root, reads)).out);
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
  const issue = (number: number, body: string): LoopIssue => ({ number: parseIssue(number), title: `#${number}`, state: 'open', labels: ['omni:bug'], body });
  const bugComment = (id: number, body: string): LoopComment => ({ id: parseCommentId(id), author: 'pm', body, createdAt: NOW, updatedAt: NOW });
  const ISSUES = { 'acme/plan': [issue(30, 'The total is wrong.\n\nFor PRD #7\n'), issue(31, 'Another.\n\nFor PRD #8\n')] };
  const detailOf = (comments: string[], closedBy: number[]): Partial<Omit<LoopIssueDetail, keyof LoopIssue>> => ({
    comments: comments.map((body, index) => bugComment(index + 1, body)),
    closedBy: closedBy.map((n) => parsePr(n)),
  });
  const REPOS: Record<string, RepoFacts> = {
    'acme/backend': { changes: [pr(40), pr(41, 'merged', { head: 'fix/total' })] },
    'acme/frontend': { changes: [pr(44, 'closed', { updatedAt: '2026-01-01' }), pr(45), pr(46, 'open', { head: 'fix/show' })] },
    'acme/plan': { changes: [pr(9), pr(51, 'open', { head: 'docs/bug-30' })] },
  };
  const bugs = (comments: string[]) => ({ issues: ISSUES, issueDetails: { 'acme/plan#30': detailOf(comments, [51]) } });
  type Entry = { repo: string; number: number | null; kind: string; target: string | null; state: string; bug?: number };
  const brief = (out: string) => (JSON.parse(out) as Entry[]).map((e) => `${e.kind} ${e.repo}#${e.number ?? '-'} ${e.state}${e.target ? ` ${e.target}` : ''}`);

  it('lists the target PRs, the linked bug fixes and their record, then the plan PR, in merge order', async () => {
    const root = planRepo();
    const reads = loopOf(REPOS, bugs(['triage', BUG_PLAN]));
    const { code, out } = await run(['care', 'list', '7', '--json'], root, reads);
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
    expect(reads.reads).toContainEqual({ read: 'issues', query: { repo: 'acme/plan', label: 'omni:bug', state: 'all' } });
  });

  it("lists each landing of a target's chain in the plan's landing order", async () => {
    const root = planRepo({ landing: true });
    const reads = loopOf({
      'acme/backend': { changes: [pr(11, 'open', { head: 'feat/widgets-1of2-landing-1' }), pr(12, 'open', { head: 'feat/widgets-2of2-landing-2' })] },
      'acme/frontend': { changes: [pr(45)] },
      'acme/plan': { changes: [pr(9)] },
    });
    const { out } = await run(['care', 'list', '7', '--json'], root, reads);
    expect(brief(out)).toEqual(['landing acme/backend#11 open backend', 'target acme/frontend#45 open frontend', 'landing acme/backend#12 open backend', 'plan acme/plan#9 open']);
    expect((JSON.parse(out) as unknown[])[2]).toMatchObject({ landing: { landing: 2, count: 2, name: 'landing-2' } });
  });

  it('lists a repository it cannot read as unreadable, never failing', async () => {
    const root = planRepo();
    const { code, out } = await run(['care', 'list', '7', '--json'], root, loopOf(REPOS, { ...bugs(['triage', BUG_PLAN]), failing: ['acme/frontend'] }));
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

  it('lists the bugs as unreadable when the plan repository is refused, and exits 1 when nothing can be read', async () => {
    const root = planRepo();
    const refused = await run(['care', 'list', '7', '--json'], root, loopOf(REPOS, { ...bugs([BUG_PLAN]), failing: ['acme/plan'] }));
    expect(refused.code).toBe(0);
    expect(brief(refused.out)).toContain('bug-fix acme/plan#- unreadable');
    const down = await run(['care', 'list', '7', '--json'], root, fakeLoopReads({ everything: new LoopReadError('unreachable', 'everything') }));
    expect(down.code).toBe(1);
    expect(down.err).toBe('unreachable\n');
  });

  it('prints one line per pull request without --json', async () => {
    const root = planRepo();
    const { code, out } = await run(['care', 'list', '7'], root, loopOf(REPOS, bugs(['triage', BUG_PLAN])));
    expect(code).toBe(0);
    expect(out.split('\n')[0]).toMatch(/PRD 7: 6 pull requests/);
    expect(out).toMatch(/1\. target +acme\/backend#40 — open — backend/);
    expect(out).toMatch(/6\. plan +acme\/plan#9 — open\n/);
  });

  // Law BR-PRODUCT-72 (.omni-loop/knowledge/product/rules.md, #1533).
  it("law BR-PRODUCT-72: a bug's fixes come from its fix-plan rows in table order, once each, its record from GitHub's closing links, a repository with no pull request left off", async () => {
    const root = planRepo();
    const plan = [
      '<!-- omni-bug:fix-plan -->',
      '| order | repository | what changes | pull request |',
      '| --- | --- | --- | --- |',
      '| 1 | frontend | show it | acme/frontend#46 |',
      '| 2 | backend | restore the total | https://github.com/acme/backend/pull/41 |',
      '| 3 | frontend | show it again | acme/frontend#46 |',
      '| 4 | backend | a follow-up | not opened yet |',
    ].join('\n');
    const { out } = await run(['care', 'list', '7', '--json'], root, loopOf(REPOS, bugs([plan])));
    const found = brief(out).filter((line) => line.startsWith('bug-'));
    expect(found).toEqual(['bug-fix acme/frontend#46 open frontend', 'bug-fix acme/backend#41 merged backend', 'bug-record acme/plan#51 open']);
  });

  it('exits 2 with one line outside a plan repository', async () => {
    const root = repo();
    const { code, err } = await run(['care', 'list', '7'], root, widgets());
    expect(code).toBe(2);
    expect(err.trim().split('\n')).toHaveLength(1);
    expect(err).toMatch(/not a plan repository/);
  });
});
