// PRD 1139, slice s1: `omni next <prd>` through `main()`, on a fixture repository and a stubbed GitHub.
import { execFileSync } from 'node:child_process';
import type { ExecFileSyncOptions } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo, realExec } from '../test/fixture.ts';
import { parseOutboxItemId } from '../lib/ids.ts';
import { makeMarkers } from '../lib/markers.ts';
import { formatNumbersMarker } from '../lib/outbox/comment.ts';
import { main } from './omni.ts';

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
const PR_URL = 'https://github.com/acme/widgets/pull/9';
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
const featurePr = (over = {}) => ({ number: 9, url: PR_URL, state: 'OPEN', isDraft: true, updatedAt: NOW, body: 'Closes #7', author: { login: 'pm' }, ...over });

const markers = makeMarkers('omni-outbox');
const ITEM_PATH = '.omni-loop/delivery/outbox/0007-widgets/wave-1/s1-01-list.md';

/** An open outbox item of PRD 7, as `/omni:do-work` writes one. */
function itemText(rank: string) {
  return [
    '---', 'id: s1-01-list', 'prd: 7', 'slice: s1', `rank: ${rank}`, 'bears-on: none', 'raised: 2026-09-27', 'wave: 1', '---', '',
    '## The question, in plain words', '', 'Which way?', '',
    '## The decision, in plain words', '', 'We kept the first way.', '',
    '## The options, in plain words', '', 'A. Option A.', 'B. Option B.', '',
    '## What I had to decide', '', 'x', '',
    '## What I did meanwhile', '', 'Kept the first way.', '',
    '## What it costs to change later', '', 'z', '',
    '## What I could not know', '', '(author) w', '',
  ].join('\n');
}
const PR_COMMENT = {
  id: 1,
  body: `${markers.prComment}\n${formatNumbersMarker([{ number: 1, id: parseOutboxItemId('s1-01-list'), since: '2026-09-27T08:00:00Z' }], markers)}`,
  user: { login: 'omni-loop[bot]' },
  author_association: 'NONE',
  created_at: '2026-09-27T08:00:00Z',
  html_url: `${PR_URL}#issuecomment-1`,
};
const REPLY = { id: 2, body: '1: B because it reads better', user: { login: 'pm' }, author_association: 'MEMBER', created_at: '2026-09-28T08:00:00Z', html_url: `${PR_URL}#issuecomment-2` };

/** A fixture repository whose feature branch, as last fetched, holds `remoteFiles`. */
function repo(remoteFiles: Record<string, string> = {}) {
  const { root, write } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } });
  const run = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  for (const [path, text] of Object.entries(remoteFiles)) write(path, text);
  run('add', '-A');
  run('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'feature');
  run('update-ref', 'refs/remotes/origin/feat/widgets', 'HEAD');
  run('reset', '-q', '--hard', 'HEAD~1');
  return root;
}

/** Which of the fake's answers a gh call asks for. */
function ghCallKind(args: readonly string[]): string {
  if (args[0] === 'api') return args[1] === 'graphql' ? 'graphql' : 'comments';
  if (args[0] === 'pr' && args[1] === 'view') return 'commits';
  if (args.includes('--label')) return 'phase0';
  return args.includes('--head') ? 'feature' : 'subs';
}

type Fakes = { feature?: unknown[]; subs?: unknown[]; phase0?: unknown[]; comments?: unknown[]; commits?: unknown; read?: unknown; down?: boolean };

/** A fake `execFileSync`: gh answered from `fakes`, git fetch a no-op, every other git call real. */
function fakeExec({ feature = [featurePr()], subs = [subPr('s1', { state: 'OPEN', mergedAt: null, isDraft: true }), subPr('s2', { state: 'OPEN', mergedAt: null, isDraft: true })], phase0 = [], comments = [], commits = { commits: [] }, read, down = false }: Fakes = {}) {
  const calls: string[][] = [];
  const answers: Record<string, () => unknown> = { phase0: () => phase0, feature: () => feature, subs: () => subs, graphql: () => read, comments: () => comments, commits: () => commits };
  const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}): string => {
    calls.push([file, ...args]);
    if (file === 'git') return args[0] === 'fetch' ? '' : realExec(file, args, options);
    if (down) throw Object.assign(new Error('error connecting to api.github.com'), { stderr: 'error connecting to api.github.com' });
    const answer = answers[ghCallKind(args)];
    if (!answer) throw new Error(`fakeExec: unexpected call ${file} ${args.join(' ')}`);
    return JSON.stringify(answer());
  };
  return { exec, calls };
}

async function run(argv: readonly string[], root: string, fake: ReturnType<typeof fakeExec>) {
  const s = io();
  const code = await main(argv, { cwd: root, exec: fake.exec, ...s });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

const readyRead = (over = {}) => ({
  data: {
    repository: {
      pullRequest: {
        number: 9, url: PR_URL, state: 'OPEN', isDraft: false, baseRefName: 'main', headRefName: 'feat/widgets', mergeable: 'MERGEABLE',
        labels: { nodes: [] },
        commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE', contexts: { nodes: [{ __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE', detailsUrl: 'https://ci/1' }] } } } }] },
        reviewThreads: { nodes: [] },
        comments: { nodes: [] },
        ...over,
      },
    },
  },
});

describe('omni next', () => {
  it('prints one verdict line for a PRD with takeable slices', async () => {
    const root = repo();
    const { code, out, err } = await run(['next', '7'], root, fakeExec({ subs: [] }));
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out).toBe(`PRD 7 — act wave: wave 1 can take s1, s2 — ${PR_URL}\n`);
  });

  it('--json prints {prds: [{prd, verdict, skill?, why, link?, wakeHint?}]}', async () => {
    const root = repo();
    const { code, out } = await run(['next', '7', '--json'], root, fakeExec());
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({ prds: [{ prd: 7, verdict: 'wait', why: 'another session holds the claim on s1, s2', wakeHint: 1200, link: PR_URL }] });
  });

  it('a slice in flight with no commit for limits.stallDays parks on a person: its sub-PR, since when, take over or close, its link', async () => {
    const root = repo();
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const quietSince = daysAgo(5.5);
    const subs = [subPr('s1', { state: 'OPEN', mergedAt: null, isDraft: true, createdAt: daysAgo(6), updatedAt: daysAgo(5.5) }), subPr('s2')];
    const { out } = await run(['next', '7', '--json'], root, fakeExec({ subs, commits: { commits: [{ committedDate: daysAgo(6) }, { committedDate: quietSince }] } }));
    expect(JSON.parse(out)).toEqual({
      prds: [
        {
          prd: 7,
          verdict: 'park',
          why: `waits on a person: s1's sub-PR #21 has had no commit since ${quietSince.slice(0, 10)} (5 days or more); take it over or close it`,
          link: 'https://github.com/acme/widgets/pull/21',
        },
      ],
    });
  });

  it('a slice in flight with a commit inside limits.stallDays still waits on its claim', async () => {
    const root = repo();
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const subs = [subPr('s1', { state: 'OPEN', mergedAt: null, isDraft: true, createdAt: daysAgo(6) }), subPr('s2')];
    const { out } = await run(['next', '7', '--json'], root, fakeExec({ subs, commits: { commits: [{ committedDate: daysAgo(4.9) }] } }));
    expect(JSON.parse(out)).toEqual({ prds: [{ prd: 7, verdict: 'wait', why: 'another session holds the claim on s1', wakeHint: 1200, link: PR_URL }] });
  });

  it('a ready feature PR with red CI → act pr-care --once, read through its care state', async () => {
    const root = repo();
    const fake = fakeExec({ feature: [featurePr({ isDraft: false })], subs: [subPr('s1'), subPr('s2')], read: readyRead() });
    const { out } = await run(['next', '7', '--json'], root, fake);
    expect(JSON.parse(out)).toMatchObject({ prds: [{ prd: 7, verdict: 'act', skill: 'pr-care --once', link: PR_URL }] });
    expect(fake.calls.some((call) => call[1] === 'api' && call[2] === 'graphql')).toBe(true);
  });

  it('every slice merged and a question open on the feature branch → park on the PR author', async () => {
    const root = repo({ [ITEM_PATH]: itemText('high') });
    const { out } = await run(['next', '7', '--json'], root, fakeExec({ subs: [subPr('s1'), subPr('s2')], comments: [PR_COMMENT] }));
    expect(JSON.parse(out)).toEqual({ prds: [{ prd: 7, verdict: 'park', why: 'waits on @pm: 1 outbox question to answer', link: PR_URL }] });
  });

  it('every slice merged and the question answered on the feature PR → act yolo-fix', async () => {
    const root = repo({ [ITEM_PATH]: itemText('high') });
    const { out } = await run(['next', '7', '--json'], root, fakeExec({ subs: [subPr('s1'), subPr('s2')], comments: [PR_COMMENT, REPLY] }));
    expect(JSON.parse(out)).toMatchObject({ prds: [{ verdict: 'act', skill: 'yolo-fix' }] });
  });

  it('a medium item is adopted, never asked: every slice merged → act yolo', async () => {
    const root = repo({ [ITEM_PATH]: itemText('medium') });
    const fake = fakeExec({ subs: [subPr('s1'), subPr('s2')] });
    const { out } = await run(['next', '7', '--json'], root, fake);
    expect(JSON.parse(out)).toMatchObject({ prds: [{ verdict: 'act', skill: 'yolo' }] });
    expect(fake.calls.some((call) => String(call[2]).endsWith('/comments'))).toBe(false);
  });

  it('two PRDs give two lines, in the order named', async () => {
    const root = repo();
    const { out } = await run(['next', '7', '7'], root, fakeExec({ subs: [] }));
    expect(out.trimEnd().split('\n')).toHaveLength(2);
  });

  it('an open phase-0 PR parks on a reviewer, even before the folder reached the inbox', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const fake = fakeExec({ phase0: [{ number: 3, url: 'https://github.com/acme/widgets/pull/3', state: 'OPEN', body: 'Refs #7' }, { number: 4, url: 'x', state: 'OPEN', body: 'Refs #70' }] });
    const { code, out } = await run(['next', '7'], root, fake);
    expect(code).toBe(0);
    expect(out).toBe('PRD 7 — park: waits on a reviewer: the phase-0 PR is open — https://github.com/acme/widgets/pull/3\n');
  });

  it('a roadmap\'s one phase-0 PR, naming every row, parks each PRD on a reviewer (issue 1198)', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    const body = ['Refs #6', 'Refs #7', 'Refs #8', '', '## PRDs'].join('\n');
    const fake = fakeExec({ phase0: [{ number: 36, url: 'https://github.com/acme/widgets/pull/36', state: 'OPEN', body }] });
    const { code, out } = await run(['next', '7', '8'], root, fake);
    expect(code).toBe(0);
    expect(out).toBe(
      [7, 8].map((prd) => `PRD ${prd} — park: waits on a reviewer: the phase-0 PR is open — https://github.com/acme/widgets/pull/36\n`).join(''),
    );
  });

  it('a merged feature PR → done', async () => {
    const root = repo();
    const { out } = await run(['next', '7'], root, fakeExec({ feature: [featurePr({ state: 'MERGED' })] }));
    expect(out).toBe(`PRD 7 — done: the feature PR is merged — ${PR_URL}\n`);
  });

  it('gh unreachable prints wait: github unreachable, with exit 0', async () => {
    const root = repo();
    const { code, out } = await run(['next', '7'], root, fakeExec({ down: true }));
    expect(code).toBe(0);
    expect(out).toBe('PRD 7 — wait: github unreachable (look again in 5 min)\n');
  });

  it('a PRD with no folder and no phase-0 PR is a usage error', async () => {
    const { root } = makeRepo({ git: true, files: CONFIG });
    expect((await run(['next', '7'], root, fakeExec())).code).toBe(2);
  });
});

// PRD 1139, slice s3: with no number, the PRDs that are yours; `--plan`; following the saved plan.
describe('omni next — the loop plan', () => {
  const ME = 'me@example.com';
  const PLAN_FILE = '.omni-loop/local/loop-plan.json';
  const planOf = (territory: Record<string, string>) =>
    ['# A plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', ...Object.entries(territory).map(([id, path]) => `| ${id} | ${id} | \`${path}\` | — | 1 |`), ''].join('\n');
  const versions = (root: string) => (JSON.parse(readFileSync(join(root, PLAN_FILE), 'utf8')) as { versions: unknown[] }).versions;

  /** PRDs 7 and 9 committed by you, 8 by someone else; 9 shares `a/` with 7. */
  function mine() {
    const { root, write } = makeRepo({ git: true, files: CONFIG });
    const run = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    const add = (folder: string, plan: string, email: string) => {
      write(`.omni-loop/delivery/inbox/${folder}/plan.md`, plan);
      run('add', '-A');
      run('-c', `user.email=${email}`, '-c', 'user.name=x', 'commit', '-q', '-m', folder);
    };
    add('0007-widgets', PLAN, ME);
    add('0008-gadgets', planOf({ s1: 'q/' }), 'someone@example.com');
    add('0009-gizmos', planOf({ s1: 'a/x' }), ME);
    run('config', 'user.email', ME);
    return root;
  }

  it('--plan orders your PRDs into numbered steps, prints each cross-PRD order with its reason, and keeps it', async () => {
    const root = mine();
    const { code, out, err } = await run(['next', '--plan'], root, fakeExec());
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(out).toBe(
      [
        'loop plan v1 · PRDs 7, 9 · 4 steps',
        '  1. PRD 7 wave 1: s1, s2',
        '  2. PRD 7 finish · after 1 · beside 3',
        '  3. PRD 9 wave 1: s1 · after 1 · beside 2',
        '  4. PRD 9 finish · after 3',
        'orders across PRDs:',
        '  step 3: 9 s1 after 7 s1: both touch a/',
        '',
      ].join('\n'),
    );
    expect(versions(root)).toHaveLength(1);
  });

  it('with no number, drives only your PRDs, and follows the first step not done', async () => {
    const root = mine();
    await run(['next', '--plan'], root, fakeExec());
    const { code, out } = await run(['next', '--json'], root, fakeExec());
    expect(code).toBe(0);
    const json = JSON.parse(out) as { prds: { prd: number }[] };
    expect(json.prds.map((verdict: { prd: number }) => verdict.prd)).toEqual([7, 9]);
    expect(json).toMatchObject({ plan: { version: 1, steps: 4 }, replanned: null, stop: false, step: { step: 1, prd: 7 }, verdict: { prd: 7, verdict: 'wait' } });
    const text = await run(['next'], root, fakeExec());
    expect(text.out).toBe(
      [
        `step 1/4 · PRD 7 — wait: another session holds the claim on s1, s2 (look again in 20 min) — ${PR_URL}`,
        `  step 1 (PRD 7 w1) running since ${NOW}`,
        '  step 3 (PRD 9 w1) held: a/ shared with step 1 (PRD 7 w1, running)',
        '',
      ].join('\n'),
    );
  });

  it('with no plan kept yet, a tick makes version 1 and follows it', async () => {
    const root = mine();
    const { out } = await run(['next'], root, fakeExec({ subs: [] }));
    expect(out).toBe(`step 1/4 · PRD 7 — act wave: wave 1 can take s1, s2 — ${PR_URL}\n  step 3 (PRD 9 w1) held: a/ shared with step 1 (PRD 7 w1, starting)\n`);
    expect(existsSync(join(root, PLAN_FILE))).toBe(true);
  });

  it('a slice going stuck writes version 2 with its reason, and the next tick follows it', async () => {
    const root = mine();
    await run(['next', '--plan'], root, fakeExec());
    const stuck = [subPr('s1', { state: 'OPEN', mergedAt: null, isDraft: true, labels: [{ name: 'omni:needs-fix' }] }), subPr('s2', { state: 'OPEN', mergedAt: null, isDraft: true })];
    const { out } = await run(['next'], root, fakeExec({ subs: stuck }));
    expect(out.split('\n')[0]).toBe('replanned v2: s1 of PRD 7 stuck → 9 moves up');
    expect(out.split('\n')[1]).toMatch(/^step 1\/4 · PRD 9 — act wave: /);
    expect(versions(root)).toHaveLength(2);
    const again = await run(['next'], root, fakeExec({ subs: stuck }));
    expect(again.out.startsWith('replanned')).toBe(false);
  });

  it('numbers matching the kept plan follow it; other numbers get one verdict each', async () => {
    const root = mine();
    await run(['next', '--plan'], root, fakeExec());
    expect((await run(['next', '9', '7'], root, fakeExec())).out).toMatch(/^step 1\/4 · PRD 7 /);
    expect((await run(['next', '7'], root, fakeExec())).out).toMatch(/^PRD 7 — wait: /);
  });

  it('stops when every PRD is parked or done', async () => {
    const root = mine();
    const { out } = await run(['next', '--plan', '--json'], root, fakeExec());
    expect((JSON.parse(out) as { plan: { steps: unknown[] } }).plan.steps).toHaveLength(4);
    const parked = await run(['next', '--json'], root, fakeExec({ feature: [featurePr({ state: 'CLOSED' })] }));
    const json = JSON.parse(parked.out) as { stop: boolean; step: unknown };
    expect(json.stop).toBe(true);
    expect(json.step).toBeNull();
    const text = await run(['next'], root, fakeExec({ feature: [featurePr({ state: 'MERGED' })] }));
    expect(text.out).toBe('stop: every PRD is parked or done\n');
  });

  it('cannot tell which PRDs are yours without a user.email: a usage error naming the way out', async () => {
    const { root } = makeRepo({ git: true, files: { ...CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': PLAN } });
    execFileSync('git', ['config', 'user.email', ''], { cwd: root });
    const { code, err } = await run(['next'], root, fakeExec());
    expect(code).toBe(2);
    expect(err).toMatch(/cannot tell which PRDs are yours/);
  });
});

// PRD 1162, slice s1: in a plan repository, `omni next` reads the plan PR, each target's feature PR and
// the board across repositories, and returns only the ultra- skills.
describe('omni next — a plan repository', () => {
  const PLAN_CONFIG = {
    '.omni-loop/config.yml': [
      'kit: 1',
      'repo:',
      '  slug: acme/plans',
      'plan:',
      '  targets:',
      '    - repo: acme/crew',
      '      role: back-end',
      '      knowledge: own',
      '    - repo: acme/ai-domain',
      '      role: ai',
      '      knowledge: none',
      '',
    ].join('\n'),
  };
  const MULTI_PLAN = [
    '# A plan',
    '',
    '| id | repo | slice | territory | blocked by | wave |',
    '| --- | --- | --- | --- | --- | --- |',
    '| s1 | crew | Alpha | `apps/crew-api/` | — | 1 |',
    '| s2 | ai-domain | Beta | `apps/crew-api/` | — | 1 |',
    '',
  ].join('\n');
  const PRS: Record<string, number> = { 'acme/plans': 12, 'acme/crew': 40, 'acme/ai-domain': 41 };
  const urlOf = (slug: string) => `https://github.com/${slug}/pull/${PRS[slug] ?? 0}`;
  const prIn = (slug: string, over = {}) => ({ number: PRS[slug], url: urlOf(slug), state: 'OPEN', isDraft: true, updatedAt: NOW, body: 'Closes #7', author: { login: 'pm' }, ...over });

  type MultiFakes = { features?: Record<string, unknown[]>; subs?: Record<string, unknown[]>; read?: unknown; phase0?: unknown[] };

  /** A fake `execFileSync` answering each gh call from the repository it names. */
  function fakeMulti({ features = {}, subs = {}, read, phase0 = [] }: MultiFakes = {}) {
    const calls: string[][] = [];
    const queries: unknown[] = [];
    const answers: Record<string, (slug: string, input: unknown) => unknown> = {
      graphql: (_, input) => {
        queries.push(typeof input === 'string' ? JSON.parse(input) : null);
        return read;
      },
      phase0: () => phase0,
      feature: (slug) => features[slug] ?? [],
      subs: (slug) => subs[slug] ?? [],
    };
    const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}): string => {
      calls.push([file, ...args]);
      if (file === 'git') return args[0] === 'fetch' ? '' : realExec(file, args, options);
      const answer = answers[ghCallKind(args)];
      if (!answer) throw new Error(`fakeMulti: unexpected call ${file} ${args.join(' ')}`);
      return JSON.stringify(answer(String(args[args.indexOf('--repo') + 1]), options.input));
    };
    return { exec, calls, queries };
  }

  const planRepo = () => makeRepo({ git: true, files: { ...PLAN_CONFIG, '.omni-loop/delivery/inbox/0007-widgets/plan.md': MULTI_PLAN } }).root;
  const allDraft = { 'acme/plans': [prIn('acme/plans')], 'acme/crew': [prIn('acme/crew')], 'acme/ai-domain': [prIn('acme/ai-domain')] };

  it('--json prints the ultra verdict and the repositories of the PRD', async () => {
    const fake = fakeMulti({ features: allDraft });
    const { code, out, err } = await run(['next', '7', '--json'], planRepo(), fake);
    expect(err).toBe('');
    expect(code).toBe(0);
    expect(JSON.parse(out)).toEqual({
      prds: [{ prd: 7, verdict: 'act', skill: 'ultra-wave', why: 'wave 1 can take s1, s2', link: urlOf('acme/plans'), repos: ['ai-domain', 'crew'] }],
    });
    const heads = fake.calls.filter((call) => call.includes('--head')).map((call) => call[call.indexOf('--repo') + 1]);
    expect(heads).toEqual(['acme/plans', 'acme/crew', 'acme/ai-domain']);
  });

  it('a ready target PR with red CI → act mega-pr-care --once, its care state read from the target', async () => {
    const fake = fakeMulti({
      features: { ...allDraft, 'acme/crew': [prIn('acme/crew', { isDraft: false })] },
      subs: { 'acme/crew': [subPr('s1')], 'acme/ai-domain': [subPr('s2')] },
      read: readyRead({ number: 40, url: urlOf('acme/crew') }),
    });
    const { out } = await run(['next', '7', '--json'], planRepo(), fake);
    expect(JSON.parse(out)).toMatchObject({ prds: [{ verdict: 'act', skill: 'mega-pr-care --once', why: 'crew#40 has red CI', link: urlOf('acme/crew') }] });
    expect(fake.queries).toEqual([expect.objectContaining({ variables: { owner: 'acme', name: 'crew', number: 40 } })]);
  });

  it('an open phase-0 PR, before the folder reached the inbox, parks naming it by repository', async () => {
    const { root } = makeRepo({ git: true, files: PLAN_CONFIG });
    const phase0 = [{ number: 3, url: 'https://github.com/acme/plans/pull/3', state: 'OPEN', body: 'Refs #7' }];
    const { out } = await run(['next', '7'], root, fakeMulti({ phase0 }));
    expect(out).toBe('PRD 7 — park: waits on a reviewer: the phase-0 PR plans#3 is open — https://github.com/acme/plans/pull/3\n');
  });

  it('a tick on the kept plan carries the repositories of its step; the same path in two repositories runs beside', async () => {
    const root = planRepo();
    const planned = await run(['next', '7', '--plan'], root, fakeMulti({ features: allDraft }));
    expect(planned.out).toBe(['loop plan v1 · PRDs 7 · 2 steps', '  1. PRD 7 wave 1: s1, s2 · in ai-domain, crew', '  2. PRD 7 finish · after 1 · in ai-domain, crew', ''].join('\n'));
    const { out } = await run(['next', '7', '--json'], root, fakeMulti({ features: allDraft }));
    expect(JSON.parse(out)).toMatchObject({ step: { step: 1, prd: 7, repos: ['ai-domain', 'crew'] }, verdict: { skill: 'ultra-wave' } });
  });
});

// PRD 1162, slice s7: `omni next --roadmap <n>` drives exactly the roadmap's PRDs.
describe('omni next --roadmap', () => {
  const ROADMAP = [
    '---', 'roadmap: 12', 'title: Crew', 'milestone: A mandate is granted.', '---', '',
    '## PRDs', '',
    '| id | PRD | title | blocked by | why | wave |',
    '|---|---|---|---|---|---|',
    '| P1 | #7 | Widgets | – | – | 1 |',
    '| P2 | #8 | Gadgets | P1 | it calls the widgets | 2 |',
    '',
    '## Open questions', '',
    '| id | question | recommendation | blocks | kind |',
    '|---|---|---|---|---|',
    '| Q5 | Who signs? | The owner | P2 | person |',
    '',
  ].join('\n');

  /** PRD 7 by you, 8 by someone else, both on the roadmap; 9 by you, off it. */
  function roadmapRepo() {
    const { root, write } = makeRepo({ git: true, files: CONFIG });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    const add = (path: string, text: string, email: string) => {
      write(path, text);
      git('add', '-A');
      git('-c', `user.email=${email}`, '-c', 'user.name=x', 'commit', '-q', '-m', path);
    };
    add('.omni-loop/delivery/inbox/0007-widgets/plan.md', PLAN, 'me@example.com');
    add('.omni-loop/delivery/inbox/0008-gadgets/plan.md', PLAN, 'someone@example.com');
    add('.omni-loop/delivery/inbox/0009-gizmos/plan.md', PLAN, 'me@example.com');
    add('.omni-loop/delivery/inbox/roadmaps/0012-crew/roadmap.md', ROADMAP, 'me@example.com');
    git('config', 'user.email', 'me@example.com');
    return root;
  }

  /** A fake answering each feature PR by its branch, and the roadmap issue's comments. */
  function fakeRoadmap({ features = {}, comments = [] }: { features?: Record<string, unknown[]>; comments?: unknown[] } = {}) {
    const calls: string[][] = [];
    const exec = (file: string, args: readonly string[], options: ExecFileSyncOptions = {}): string => {
      calls.push([file, ...args]);
      if (file === 'git') return args[0] === 'fetch' ? '' : realExec(file, args, options);
      const kind = ghCallKind(args);
      if (kind === 'feature') return JSON.stringify(features[String(args[args.indexOf('--head') + 1])] ?? []);
      if (kind === 'comments') return JSON.stringify(String(args[1]).includes('/issues/12/') ? comments : []);
      if (kind === 'phase0' || kind === 'subs') return '[]';
      throw new Error(`fakeRoadmap: unexpected call ${file} ${args.join(' ')}`);
    };
    return { exec, calls };
  }
  const answer = { id: 5, body: '<!-- omni-roadmap-answer: Q5 -->\n**Q5**, answered:\n\nThe owner.', user: { login: 'pm' }, author_association: 'MEMBER', created_at: NOW, html_url: 'x' };
  const widgets = { 'feat/widgets': [featurePr()] };

  it('drives exactly the roadmap\'s PRDs, someone else\'s included; a person question parks the PRD it blocks', async () => {
    const root = roadmapRepo();
    const { code, out, err } = await run(['next', '--roadmap', '12', '--json'], root, fakeRoadmap({ features: widgets }));
    expect(err).toBe('');
    expect(code).toBe(0);
    const json = JSON.parse(out) as { prds: { prd: number }[]; held: { prd: number; gate: string; why: string; link: string }[] };
    expect(json.prds.map((verdict) => verdict.prd)).toEqual([7, 8]);
    expect(json).toMatchObject({ roadmap: 12, step: { prd: 7 }, verdict: { prd: 7, verdict: 'act', skill: 'wave' } });
    expect(json.held).toHaveLength(1);
    expect(json.held[0]).toMatchObject({ prd: 8, gate: 'park', link: 'https://github.com/acme/widgets/issues/12' });
    expect(json.held[0]?.why).toMatch(/^waits on a person: roadmap 12 question Q5 is not answered \(Who signs\?\)/);
  });

  it('once answered, the blocked PRD is held on its blocker\'s PR, named with its state', async () => {
    const root = roadmapRepo();
    const { out } = await run(['next', '--roadmap', '12'], root, fakeRoadmap({ features: widgets, comments: [answer] }));
    expect(out).toBe([
      `step 1/4 · PRD 7 — act wave: wave 1 can take s1, s2 — ${PR_URL}`,
      `  held: PRD 8 — waits on widgets#9 (P1 Widgets): building wave 1/1 — ${PR_URL}`,
      '',
    ].join('\n'));
    const merged = await run(['next', '--roadmap', '12', '--json'], root, fakeRoadmap({ features: { 'feat/widgets': [featurePr({ state: 'MERGED' })] }, comments: [answer] }));
    expect(JSON.parse(merged.out)).toMatchObject({ step: { prd: 8 }, held: [] });
  });

  it('a blocker closed unmerged parks its dependent', async () => {
    const root = roadmapRepo();
    const { out } = await run(['next', '--roadmap', '12', '--json'], root, fakeRoadmap({ features: { 'feat/widgets': [featurePr({ state: 'CLOSED' })] }, comments: [answer] }));
    expect(JSON.parse(out)).toMatchObject({ stop: true, waiting: [{ prd: 8, verdict: 'park', why: 'blocker #9 closed unmerged: fix the roadmap', link: PR_URL }] });
  });

  it('an unknown roadmap exits 2 with one line', async () => {
    const root = roadmapRepo();
    const { code, out, err } = await run(['next', '--roadmap', '99'], root, fakeRoadmap());
    expect(code).toBe(2);
    expect(out).toBe('');
    expect(err.trimEnd().split('\n')).toEqual(['omni next: no roadmap 99 in the inbox; omni roadmap check lists them.']);
    expect((await run(['next', '7', '--roadmap', '12'], root, fakeRoadmap())).code).toBe(2);
  });
});

// PRD 1205, slice s1: the pool — `steps`, `running` and `held` beside the step and verdict of today.
describe('omni next — the pool of steps', () => {
  const ME = 'me@example.com';
  const planOf = (territory: Record<string, string>) =>
    ['# A plan', '', '| id | slice | territory | blocked by | wave |', '| --- | --- | --- | --- | --- |', ...Object.entries(territory).map(([id, path]) => `| ${id} | ${id} | \`${path}\` | — | 1 |`), ''].join('\n');
  type Tick = { step: unknown; verdict: unknown; waiting: unknown; prds: unknown; steps: { step: number; prd: number; verdict: { verdict: string } }[]; running: { step: number; prd: number; kind: string; since: string }[]; held: { step: number; prd: number; why: string }[] };

  /** PRDs 7, 8 and 9, all yours, on the plans given (by default sharing no ground), with `limits`. */
  function yours({ limits = '', plans = { '0008-gadgets': planOf({ s1: 'q/' }), '0009-gizmos': planOf({ s1: 'z/' }) } }: { limits?: string; plans?: Record<string, string> } = {}) {
    const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `${CONFIG['.omni-loop/config.yml']}${limits}` } });
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
    for (const [folder, plan] of Object.entries({ '0007-widgets': PLAN, ...plans })) {
      write(`.omni-loop/delivery/inbox/${folder}/plan.md`, plan);
      git('add', '-A');
      git('-c', `user.email=${ME}`, '-c', 'user.name=x', 'commit', '-q', '-m', folder);
    }
    git('config', 'user.email', ME);
    return root;
  }
  async function tick(root: string, fake: ReturnType<typeof fakeExec>): Promise<Tick> {
    const { code, out, err } = await run(['next', '--json'], root, fake);
    expect(err).toBe('');
    expect(code).toBe(0);
    return JSON.parse(out) as Tick;
  }

  it('three PRDs sharing no ground: one tick lists three steps, each of a different PRD, the first being step', async () => {
    const json = await tick(yours(), fakeExec({ subs: [] }));
    expect(json.steps.map((one) => one.prd)).toEqual([7, 8, 9]);
    expect(json.steps.map((one) => one.verdict.verdict)).toEqual(['act', 'act', 'act']);
    expect(json.steps[0]).toEqual({ ...(json.step as object), verdict: json.verdict });
    expect(json).toMatchObject({ running: [], held: [] });
  });

  it('limits.parallelSteps: 1 keeps step, verdict, waiting and prds byte-identical, and steps holds step alone', async () => {
    const three = await tick(yours(), fakeExec({ subs: [] }));
    const one = await tick(yours({ limits: 'limits:\n  parallelSteps: 1\n' }), fakeExec({ subs: [] }));
    const today = ({ step, verdict, waiting, prds }: Tick) => JSON.stringify({ step, verdict, waiting, prds });
    expect(today(one)).toBe(today(three));
    expect(one.steps).toEqual([{ ...(one.step as object), verdict: one.verdict }]);
  });

  it('two PRDs sharing a path: the first in steps, the second held naming the path and the step it waits on', async () => {
    const json = await tick(yours({ plans: { '0009-gizmos': planOf({ s1: 'a/x' }) } }), fakeExec({ subs: [] }));
    expect(json.steps.map((one) => one.prd)).toEqual([7]);
    expect(json.held).toEqual([{ step: 3, prd: 9, why: 'a/ shared with step 1 (PRD 7 w1, starting)' }]);
  });

  it('a live claim is a step running: it counts against the slots, its PRD gets no second step', async () => {
    const json = await tick(yours({ limits: 'limits:\n  parallelSteps: 2\n' }), fakeExec());
    expect(json.running).toEqual([{ step: 1, prd: 7, kind: 'wave', since: NOW }]);
    expect(json.steps).toHaveLength(1);
  });

  it('a stale claim is not running', async () => {
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const stale = (slice: string) => subPr(slice, { state: 'OPEN', mergedAt: null, isDraft: true, createdAt: old, updatedAt: old });
    const json = await tick(yours(), fakeExec({ subs: [stale('s1'), stale('s2')], commits: { commits: [{ committedDate: old }] } }));
    expect(json.running).toEqual([]);
    expect(json.steps.map((one) => one.prd)).toEqual([7, 8, 9]);
  });

  it("the feature PR's in-progress label with a fresh status comment is its step running; a stale comment is not", async () => {
    const status = (at: string) => [{ id: 5, body: `${markers.status}\nworking`, user: { login: 'omni-loop[bot]' }, created_at: at, updated_at: at, html_url: `${PR_URL}#issuecomment-5` }];
    const labelled = [featurePr({ labels: [{ name: 'omni:in-progress' }] })];
    const merged = [subPr('s1'), subPr('s2')];
    const root = yours({ plans: {} });
    const fresh = await tick(root, fakeExec({ subs: merged, feature: labelled, comments: status(NOW) }));
    expect(fresh.running).toEqual([{ step: 2, prd: 7, kind: 'finish', since: NOW }]);
    expect(fresh.steps).toEqual([]);
    const old = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const cold = await tick(root, fakeExec({ subs: merged, feature: labelled, comments: status(old) }));
    expect(cold.running).toEqual([]);
    expect(cold.steps.map((one) => `${one.prd}:${one.step}`)).toEqual(['7:2']);
  });

  it('the plain output prints one line per step to launch, per step running and per step held', async () => {
    const root = yours({ plans: { '0008-gadgets': planOf({ s1: 'q/' }), '0009-gizmos': planOf({ s1: 'a/x' }) } });
    const { out } = await run(['next'], root, fakeExec({ subs: [] }));
    expect(out.trimEnd().split('\n')).toEqual([
      `step 1/6 · PRD 7 — act wave: wave 1 can take s1, s2 — ${PR_URL}`,
      `step 2/6 · PRD 8 — act wave: wave 1 can take s1 — ${PR_URL}`,
      '  step 5 (PRD 9 w1) held: a/ shared with step 1 (PRD 7 w1, starting)',
    ]);
  });
});
