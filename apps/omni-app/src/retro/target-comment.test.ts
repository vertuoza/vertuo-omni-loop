import { describe, expect, it } from 'vitest';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { failing, replayGitHub } from '../../test/github-replay.ts';
import { refusedWordsIn } from './rules.ts';
import type { FeaturePull, Octokit, SheetFinding, TargetRead } from './retro.types.ts';
import { commentTargets, targetComment, targetMarker } from './target-comment.ts';

const PRD = { number: parsePrd(7), title: 'Widgets that remember their colour' };
const LINK = { label: 'retro PR #930', url: 'https://github.com/acme/plan/pull/930' };
const BACKEND = 'acme/backend';
const MARKER = targetMarker('omni-outbox');

const finding = (ref: string, id: string, repo: string, title: string): SheetFinding => ({
  id,
  kind: 'slow-slice',
  title,
  happened: 'It happened.',
  evidence: [],
  source: 'delivery',
  ref,
  repo,
});
const FINDINGS = [
  finding('F1', 'repeated-red:e2e', 'acme/plan', 'The check e2e went red again and again'),
  finding('F2', 'backend/slow-slice:s3', BACKEND, `${BACKEND}: Slice s3 took far longer than the others`),
  finding('F3', 'backend/churn:src/a.ts:1-4', BACKEND, `${BACKEND}: Lines were rewritten again and again`),
];

const feature = (number: number, merged: boolean): FeaturePull => ({
  number: parsePr(number),
  title: 'feat',
  url: null,
  merged,
  baseRef: 'main',
  headRef: 'feat/widget',
  headSha: 'h',
  openedAt: null,
  mergedAt: null,
  mergeSha: 'm',
  labels: [],
});
const read = (name: string, featurePrs: FeaturePull[]): TargetRead => ({ name, repo: `acme/${name}`, read: true, installationId: 21, featurePrs, pulls: [] });

/** The step tools, running each step at once and keeping its id. */
function steps() {
  const ids: string[] = [];
  const run = (id: string, fn: () => unknown): Promise<unknown> => {
    ids.push(id);
    return Promise.resolve(fn());
  };
  return { ids, step: { run } };
}

describe('targetComment', () => {
  it("links the retro, then lists the target's findings, one line each, with the issue opened for it", () => {
    const text = targetComment({ prd: PRD, repo: BACKEND, link: LINK, findings: FINDINGS, issues: { 'backend/slow-slice:s3': { number: parseIssue(31), url: 'https://github.com/acme/plan/issues/31', state: 'open' } } });
    expect(text).toBe(
      [
        '**Retro of PRD 7** · Widgets that remember their colour',
        '',
        'The whole retro, across every repository of the PRD: [retro PR #930](https://github.com/acme/plan/pull/930).',
        '',
        '### Findings in acme/backend',
        '',
        '- F2 · Slice s3 took far longer than the others · [#31](https://github.com/acme/plan/issues/31)',
        '- F3 · Lines were rewritten again and again',
      ].join('\n'),
    );
    expect(refusedWordsIn(text)).toEqual([]);
  });

  it('says so when the target has no finding', () => {
    const text = targetComment({ prd: PRD, repo: 'acme/frontend', link: LINK, findings: FINDINGS, issues: {} });
    expect(text.split('\n').at(-1)).toBe('No finding for this repository.');
    expect(text).not.toContain('F1');
  });
});

describe('commentTargets', () => {
  it('writes one marked comment on each merged feature PR of a read target, and none for a target not read', async () => {
    const github = replayGitHub({});
    const { step, ids } = steps();
    const targets: TargetRead[] = [
      read('backend', [feature(40, true), feature(44, false)]),
      { name: 'mobile', repo: 'acme/mobile', read: false, reason: 'the App is not installed there' },
    ];
    const out = await commentTargets({ step, octokitFor: () => github.octokit, id: (name) => name, targets, prefix: 'omni-outbox', prd: PRD, link: LINK, findings: FINDINGS, issues: {} });
    expect(ids).toEqual(['comment-target-backend']);
    expect(github.state.comments.map((comment) => [comment.issue, comment.body.split('\n')[0]])).toEqual([[40, MARKER]]);
    expect(out).toEqual({ backend: { comments: [{ prNumber: 40, commentId: github.state.comments[0]?.id, created: true }] } });
  });

  it('rewrites the same comment in place on the day-14 run, never a second one', async () => {
    const github = replayGitHub({});
    const targets = [read('backend', [feature(40, true)])];
    const base = { octokitFor: () => github.octokit, targets, prefix: 'omni-outbox', prd: PRD, findings: FINDINGS, issues: {} };
    await commentTargets({ ...base, step: steps().step, id: (name) => name, link: { label: 'the verdict on acme/plan#12', url: null } });
    const later = steps();
    const out = await commentTargets({ ...base, step: later.step, id: (name) => `${name}-day-14`, link: LINK });
    expect(later.ids).toEqual(['comment-target-backend-day-14']);
    expect(github.state.comments).toHaveLength(1);
    expect(github.state.comments[0]?.body).toContain('[retro PR #930](https://github.com/acme/plan/pull/930)');
    expect(out.backend).toEqual({ comments: [{ prNumber: 40, commentId: github.state.comments[0]?.id, created: false }] });
  });

  it('saves a refused write with its status and goes on to the next target', async () => {
    const github = replayGitHub({});
    const refusing: Octokit = failing(github.octokit, 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { status: 403 });
    const targets = [read('backend', [feature(40, true)]), { ...read('frontend', [feature(50, true)]), installationId: 22 }];
    const octokitFor = (id: number): Octokit => (id === 21 ? refusing : github.octokit);
    const out = await commentTargets({ step: steps().step, octokitFor, id: (name) => name, targets, prefix: 'omni-outbox', prd: PRD, link: LINK, findings: FINDINGS, issues: {} });
    expect(out.backend).toEqual({ refused: 403 });
    expect(github.state.comments.map((comment) => comment.issue)).toEqual([50]);
  });

  it('throws any other failure, so the step is retried', async () => {
    const github = replayGitHub({});
    const down = failing(github.octokit, 'POST /repos/{owner}/{repo}/issues/{issue_number}/comments', { status: 502 });
    const run = commentTargets({ step: steps().step, octokitFor: () => down, id: (name) => name, targets: [read('backend', [feature(40, true)])], prefix: 'omni-outbox', prd: PRD, link: LINK, findings: FINDINGS, issues: {} });
    await expect(run).rejects.toThrow('GitHub is down');
  });
});
