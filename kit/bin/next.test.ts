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
  if (args.includes('--label')) return 'phase0';
  return args.includes('--head') ? 'feature' : 'subs';
}

type Fakes = { feature?: unknown[]; subs?: unknown[]; phase0?: unknown[]; comments?: unknown[]; read?: unknown; down?: boolean };

/** A fake `execFileSync`: gh answered from `fakes`, git fetch a no-op, every other git call real. */
function fakeExec({ feature = [featurePr()], subs = [subPr('s1', { state: 'OPEN', mergedAt: null, isDraft: true }), subPr('s2', { state: 'OPEN', mergedAt: null, isDraft: true })], phase0 = [], comments = [], read, down = false }: Fakes = {}) {
  const calls: string[][] = [];
  const answers: Record<string, () => unknown> = { phase0: () => phase0, feature: () => feature, subs: () => subs, graphql: () => read, comments: () => comments };
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
    expect(text.out).toBe(`step 1/4 · PRD 7 — wait: another session holds the claim on s1, s2 (look again in 20 min) — ${PR_URL}\n`);
  });

  it('with no plan kept yet, a tick makes version 1 and follows it', async () => {
    const root = mine();
    const { out } = await run(['next'], root, fakeExec({ subs: [] }));
    expect(out).toBe(`step 1/4 · PRD 7 — act wave: wave 1 can take s1, s2 — ${PR_URL}\n`);
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
