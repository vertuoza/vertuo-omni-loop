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
