import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { parseIssue, parsePr, parsePrd } from 'omni-loop/kit/lib/ids.ts';
import type { GithubSummary, PullRef } from '../github/summary';
import type { StageRow } from '../../stages/stage';
import type { DossierRow, DossierVersionRow } from '../store';
import type { ApprovalRow } from './approval';
import { readyView, type ReadyRow } from './ready';
import { DossierPage } from './DossierPage';
import { actionsOf, eyebrowOf, fixTrack, metaOf, nextStep, prdTrack, sinceWords } from './next-step';
import { reviewPath } from '../review/review';
import { fixPageView } from '../../fixes/timeline';
import { dossierView, readPick, type DossierRead } from './view';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', async (original) => ({ ...(await original<typeof import('next/navigation')>()), useRouter: () => ({ refresh: () => {} }) }));

// Who acts next on a PRD's page (omni-loop-20 s6): the subtitle names who acts and what at each moment,
// read from what the page reads; the one primary shows only to the person who acts, its label the
// subtitle's verb, the signed decisions linking to the review screen; the meta row never says the stage.

const ID = '00000000-0000-4000-8000-0000000000d1';
const ADA = { user_id: 'u-ada', email: 'ada@example.com', name: 'Ada' };
const BOB = { user_id: 'u-bob', email: 'bob@example.com', name: 'Bob' };

const numbered = (more: Partial<DossierRow> = {}): DossierRow => ({
  id: ID, workspace_id: 'w1', home_repo: 'acme/widgets', prd: parsePrd(216), title: 'PRD dossiers',
  opened_by: ADA.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z', ...more,
});
const version = (id: string, kind: DossierVersionRow['kind'], at: string): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: ADA.user_id, commit_sha: null, created_at: at,
});
const VERSIONS = [version('v-spec-1', 'spec', '2026-10-09T08:05:00Z'), version('v-plan-1', 'plan', '2026-10-09T08:06:00Z')];
const APPROVED: ApprovalRow = {
  id: 'a-1', approver_login: 'ada', approved_at: '2026-10-09T09:12:00Z',
  files: [{ kind: 'spec', path: 'spec.md', version_id: 'v-spec-1', sha256: '9c41aa00e07b' }, { kind: 'plan', path: 'plan.md', version_id: 'v-plan-1', sha256: '41b0bb000cd2' }],
};
const pr = (number: number, state: PullRef['state'], draft = false): PullRef =>
  ({ number: parsePr(number), url: `https://github.com/acme/widgets/pull/${String(number)}`, state, draft });
const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: 'acme/widgets', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers',
  issue: { number: parseIssue(216), url: 'https://github.com/acme/widgets/issues/216', state: 'open' },
  phase0: null, feature: null, retro: null, mergedSlices: 0, ...more,
});
const at = (stage: StageRow['stage']): StageRow[] => [{ stage, reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' }];

const view = (read: Partial<DossierRead> = {}, me: string | null = ADA.user_id) =>
  dossierView({ dossier: numbered(), versions: VERSIONS, members: [ADA, BOB], rounds: [], ...read }, me, readPick({}), Date.parse('2026-09-30T12:00:00Z'));
const born = { dossier: numbered({ birthplace: 'server' }) };

describe('the subtitle and the one primary, at each moment', () => {
  it('waiting for the reader\'s approval: the subtitle names the reader and the action, and the one primary reads Review and approve', () => {
    const step = nextStep(view({ ...born, approval: null }));
    expect(step.lede).toBe('You approve the spec and plan, then the agents build it.');
    expect(step.primary).toEqual({ kind: 'link', label: 'Review and approve', href: `/prd/${ID}/review` });
    expect(step.tone).toBe('waiting');
    const html = renderToStaticMarkup(createElement(DossierPage, { view: view({ ...born, approval: null }), markdown: null, supabase: null }));
    expect(html).toContain('<p class="omni-page-header__lede">You approve the spec and plan, then the agents build it.</p>');
    expect(html).toMatch(new RegExp(`<a class="omni-button omni-button--primary omni-button--md" href="/prd/${ID}/review" data-primary="">Review and approve</a>`));
  });

  it('waiting for someone else\'s approval: says who acts, and that nothing waits on the reader, with no primary', () => {
    const step = nextStep(view({ ...born, approval: null }, 'u-stranger'));
    expect(step).toEqual({ lede: 'A product approver approves the spec and plan. Nothing waits on you.', primary: null, tone: 'working' });
  });

  it('drifted since it was approved: the approver reviews the change and approves again', () => {
    const step = nextStep(view({ ...born, approval: APPROVED, versions: [...VERSIONS, version('v-plan-2', 'plan', '2026-10-09T10:00:00Z')] }));
    expect(step.lede).toBe('It changed since it was approved: you review the change and approve it again.');
    expect(step.primary).toMatchObject({ label: 'Review and approve', href: reviewPath(ID) });
  });

  it('approved: no signed decision waits, and the meta row says who approved it and when', () => {
    const approved = view({ ...born, approval: APPROVED });
    expect(nextStep(approved).primary).toBeNull();
    expect(metaOf(approved)).toEqual(['acme/widgets', 'Approved by ada · 9 Oct 2026, 09:12 UTC']);
  });

  it('in the PRD stage: the phase-0 pull request to merge, else the agents write the spec', () => {
    expect(nextStep(view({ github: summary({ phase0: pr(220, 'open') }), stages: at('prd') }))).toEqual({ lede: 'You review the spec and merge its phase-0 pull request.', primary: { kind: 'stage' }, tone: 'waiting' });
    expect(nextStep(view({ github: summary(), stages: at('prd') }))).toEqual({ lede: 'The agents write the spec. Nothing waits on you.', primary: null, tone: 'working' });
  });

  it('in the inbox stage: you start the build, with Build it', () => {
    expect(nextStep(view({ github: summary({ phase0: pr(220, 'merged') }), stages: at('inbox') }))).toMatchObject({ lede: 'It is approved: you start the build.', primary: { kind: 'stage' } });
  });

  it('building: the agents build the slices, nothing waits on the reader, and the track counts them', () => {
    const building = view({ github: summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 2 }), slices: 5, stages: at('building') });
    expect(nextStep(building)).toEqual({ lede: 'The agents build the slices (2 of 5 slices). Nothing waits on you.', primary: null, tone: 'working' });
    expect(prdTrack(building)).toMatchObject({ stage: 'Building', progress: '2 of 5 slices', tone: 'working' });
  });

  it('outbox items open: you answer them, the primary counts them and opens the Outbox tab', () => {
    const item = { id: 's1-01-x', rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null };
    const comment = 'https://github.com/acme/widgets/pull/221#issuecomment-7';
    const red = view({ github: summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 2, outbox: { open: [item], settled: [] }, outboxComment: comment }), stages: at('building') });
    const step = nextStep(red);
    expect(step.lede).toBe('You answer the decision the agents left open.');
    expect(step.primary).toEqual({ kind: 'link', label: 'Answer 1 item', href: `/prd/${ID}?tab=outbox` });
    expect(step.tone).toBe('waiting');
  });

  it('every answer in: you start the fix; while it runs, the agents fix it and nothing waits on you', () => {
    const item = { id: 'a', rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null };
    const answer = { number: 1, id: 'a', text: 'B', by: 'paula', at: null, url: null, counted: true, door: 'github' as const };
    const github = summary({
      phase0: pr(220, 'merged'), feature: pr(221, 'open', true), mergedSlices: 3, outbox: { open: [item], settled: [] },
      outboxComment: 'https://github.com/acme/widgets/pull/221#issuecomment-7', replies: { numbering: [{ number: 1, id: 'a' }], pending: [answer] },
    });
    expect(nextStep(view({ github, slices: 3, stages: at('building') }))).toMatchObject({ lede: 'Every answer is in: you start the fix with them.', primary: { kind: 'stage' } });
    const fixing = view({ github, slices: 3, stages: at('building'), fixing: { runner: 'pierre-laptop' } });
    expect(nextStep(fixing)).toEqual({ lede: 'The agents fix it with your answers on pierre-laptop. Nothing waits on you.', primary: null, tone: 'working' });
    expect(prdTrack(fixing)?.progress).toBe('3 of 3 slices · fixing on pierre-laptop');
  });

  it('ready with the Omni App\'s passing verdict: you review the feature on the review screen; without one, on GitHub', () => {
    const ready = view({ github: summary({ phase0: pr(220, 'merged'), feature: pr(221, 'open'), mergedSlices: 2 }), stages: at('outbox') });
    const row: ReadyRow = {
      repo: 'acme/widgets', prd: parsePrd(216), pr_number: 221, head_sha: 'a41f9c2'.padEnd(40, '0'), state: 'ready', passed: 5, headline: 'Ready for review · 5 of 5',
      checks: [], criteria: [], decided_at: '2026-11-15T07:00:00Z',
    };
    expect(nextStep(ready, readyView(row))).toEqual({
      lede: 'The feature is ready: you review it, then merge it on GitHub.', primary: { kind: 'link', label: 'Review the feature', href: reviewPath(ID) }, tone: 'waiting',
    });
    expect(nextStep(ready)).toEqual({ lede: 'The feature is ready: you review it and merge it on GitHub.', primary: { kind: 'stage' }, tone: 'waiting' });
  });

  it('shipped and retro: Pitch, and the retro next or written', () => {
    const shipped = summary({ phase0: pr(220, 'merged'), feature: pr(221, 'merged'), mergedSlices: 5 });
    expect(nextStep(view({ github: shipped, stages: at('shipped') }))).toEqual({ lede: 'Shipped: the retro is written next, and you may pitch it.', primary: { kind: 'stage' }, tone: 'working' });
    expect(nextStep(view({ github: { ...shipped, retro: pr(230, 'open') }, stages: at('retro') })).lede).toBe('Shipped, and its retro is written: you may pitch it.');
  });

  it('a draft: its opener shapes it; anyone else waits on them', () => {
    const draft = { dossier: numbered({ prd: null, numbered_at: null }) };
    expect(nextStep(view(draft)).lede).toBe('You shape this idea in the brainstorm; it gets its PRD number once written.');
    expect(nextStep(view(draft, BOB.user_id)).lede).toBe('Ada shapes this idea in the brainstorm. Nothing waits on you.');
    expect(eyebrowOf(view(draft))).toBe('Draft');
    expect(prdTrack(view(draft))).toMatchObject({ stage: 'Idea', progress: 'brainstorm in progress' });
  });
});

describe('the eyebrow, the meta row and the Actions menu', () => {
  it('reads the PRD\'s number, Product PRD for a ◆ PRD, and a fix\'s kind', () => {
    expect(eyebrowOf(view())).toBe('PRD #216');
    expect(eyebrowOf(view({ ...born, approval: null }))).toBe('PRD #216 · Product PRD');
    expect(eyebrowOf(view({ dossier: numbered({ kind: 'visual', prd: parsePrd(548) }) }))).toBe('Visual fix · #548');
  });

  it('holds at most five facts and never the stage', () => {
    for (const stage of ['prd', 'inbox', 'building', 'outbox', 'shipped', 'retro'] as const) {
      const meta = metaOf(view({ github: summary(), stages: at(stage) }));
      expect(meta.length).toBeLessThanOrEqual(5);
      expect(meta.join(' ')).not.toMatch(/Stage|Now:|building|inbox|shipped/i);
    }
    expect(metaOf(view({ repos: ['acme/widgets', 'acme/api'] }))[0]).toBe('2 repositories');
  });

  it('offers Request a Tech Approval while it is allowed, and Delete draft to a draft\'s opener where it can be deleted', () => {
    expect(actionsOf(view({ ...born, approval: null }), false)).toEqual([{ id: 'request-tech', label: 'Request a Tech Approval' }]);
    expect(actionsOf(view({ ...born, approval: APPROVED }), false)).toEqual([]);
    expect(actionsOf(view(), true)).toEqual([{ id: 'delete-draft', label: 'Delete draft', tone: 'danger' }]);
  });
});

describe('the stage track', () => {
  it('says the stage once, in the signal tone while it waits on the reader, each stage reached with its time', () => {
    const rows: StageRow[] = [
      { stage: 'prd', reached_at: '2026-09-27T10:00:00Z', synced_at: '2026-09-27T10:00:00Z' },
      { stage: 'inbox', reached_at: '2026-09-28T10:00:00Z', synced_at: '2026-09-29T09:15:00Z' },
    ];
    const track = prdTrack(view({ ...born, approval: null, github: summary({ phase0: pr(220, 'merged') }), stages: rows }));
    expect(track).toMatchObject({ stage: 'Inbox', progress: 'waits for your approval', tone: 'waiting' });
    expect(track?.times).toEqual({
      PRD: 'PRD since 27 Sep 10:00 UTC · 24.0 h',
      Inbox: 'Inbox since 28 Sep 10:00 UTC · 23.3 h · last synced 29 Sep 2026, 09:15 UTC',
    });
  });

  it('words a span in days from 48 hours on, and a stage with no end as since alone', () => {
    expect(sinceWords('Building', '2026-11-17T09:40:00Z', '2026-11-20T09:40:00Z')).toBe('Building since 17 Nov 09:40 UTC · 3.0 d');
    expect(sinceWords('Building', '2026-11-17T09:40:00Z', null)).toBe('Building since 17 Nov 09:40 UTC');
  });

  it('gives a fix its own track, its latest moment done its stage, and none when GitHub gave no moment', () => {
    const ISSUE = { number: parseIssue(548), url: 'https://github.com/acme/widgets/issues/548', state: 'open' as const, author: 'anna', createdAt: '2026-09-29T08:00:00Z', risk: null, regression: false };
    const PULL = { number: parsePr(562), url: 'https://github.com/acme/widgets/pull/562', state: 'open' as const, mergedAt: null, mergedBy: null };
    const fix = fixPageView('visual', { issue: ISSUE, pull: PULL, approvals: [], release: null }, { letter: 'C', login: 'pierre', date: '2026-09-29' });
    const visual = view({ dossier: numbered({ kind: 'visual', prd: parsePrd(548) }), fix });
    expect(fixTrack(visual)).toMatchObject({ stages: ['Asked', 'Picked', 'Approved', 'Merged', 'Released'], stage: 'Picked', tone: 'working' });
    expect(fixTrack(view({ dossier: numbered({ kind: 'visual', prd: parsePrd(548) }), fix: fixPageView('visual', null, 'no-page') }))).toBeNull();
  });
});
