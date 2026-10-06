import { describe, expect, it } from 'vitest';
import { UNREAD, type GithubSummary, type PullRef } from '../github/summary';
import type { StageRow } from '../../stages/stage';
import type { CareState } from '../github/care';
import { careChipOf, stageOf, stageView, syncedWords } from './stage';
import { parseIssue, parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// PRD 426's reading of the stage from the GitHub summary, which only the page's pulse still uses: each
// row of its spec's table, tried from the latest stage down, and unknown whenever what decides it could
// not be read. Then the header's view (PRD 587): the stage from the stored rows, the button and the links
// from the summary.

const pr = (number: number, state: PullRef['state'], draft = false): PullRef =>
  ({ number: parsePr(number), url: `https://github.com/acme/widgets/pull/${number}`, state, draft });
const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: 'acme/widgets', prd: parsePrd(426), folder: '0426-prd-page-stage', topic: 'prd-page-stage',
  issue: { number: parseIssue(426), url: 'https://github.com/acme/widgets/issues/426', state: 'open' },
  phase0: null, feature: null, retro: null, mergedSlices: 0, ...more,
});

describe('the stage of a PRD, read from GitHub for the pulse', () => {
  it('is idea for a draft, whatever GitHub says', () => {
    expect(stageOf(null, null)).toEqual({ id: 'idea', action: null, caption: 'Brainstorm in progress' });
  });

  it('is PRD while the spec is being written, with no button until a phase-0 PR is open', () => {
    expect(stageOf(parsePrd(426), summary())).toEqual({ id: 'prd', action: null, caption: 'Spec being written' });
    expect(stageOf(parsePrd(426), summary({ phase0: pr(431, 'open') }))).toEqual({
      id: 'prd', action: { kind: 'link', label: 'Approve spec', href: 'https://github.com/acme/widgets/pull/431' }, caption: null,
    });
  });

  it('is inbox once phase-0 merged and no sub-PR is merged: Build it copies the command', () => {
    expect(stageOf(parsePrd(426), summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open', true) }))).toEqual({
      id: 'inbox', action: { kind: 'copy', label: 'Build it', command: '/omni:yolo 426' }, caption: null,
    });
  });

  it('is outbox once a sub-PR merged: being built while the feature PR is a draft, Review & merge once it is ready', () => {
    const building = summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open', true), mergedSlices: 2 });
    expect(stageOf(parsePrd(426), building, 4)).toEqual({ id: 'outbox', action: null, caption: 'Being built · 2/4 slices' });
    expect(stageOf(parsePrd(426), building, null)).toMatchObject({ caption: 'Being built · 2 slices merged' });
    expect(stageOf(parsePrd(426), { ...building, feature: null }, 4)).toMatchObject({ id: 'outbox', action: null });
    expect(stageOf(parsePrd(426), { ...building, feature: pr(433, 'open') }, 4)).toEqual({
      id: 'outbox', action: { kind: 'link', label: 'Review & merge', href: 'https://github.com/acme/widgets/pull/433' }, caption: null,
    });
  });

  it('in the outbox stage, an open item makes the button Answer the outbox: the outbox comment, else the feature PR', () => {
    const item = { id: 's1-01-x', rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null };
    const open = summary({
      phase0: pr(431, 'merged'), feature: pr(433, 'open'), mergedSlices: 2,
      outbox: { open: [item], settled: [] }, outboxComment: 'https://github.com/acme/widgets/pull/433#issuecomment-9',
    });
    expect(stageOf(parsePrd(426), open, 4)).toEqual({
      id: 'outbox', action: { kind: 'link', label: 'Answer the outbox', href: 'https://github.com/acme/widgets/pull/433#issuecomment-9' }, caption: null,
    });
    for (const outboxComment of [null, UNREAD] as const) {
      expect(stageOf(parsePrd(426), { ...open, feature: pr(433, 'open', true), outboxComment }, 4).action)
        .toEqual({ kind: 'link', label: 'Answer the outbox', href: 'https://github.com/acme/widgets/pull/433' });
    }
    // Nothing open, the settled ones do not count: Review & merge once the feature PR is ready.
    const settled = { id: 's1-01-x', title: 'Q?', verdict: 'adopted', answer: 'ok' };
    expect(stageOf(parsePrd(426), { ...open, outbox: { open: [], settled: [settled] } }, 4).action).toMatchObject({ label: 'Review & merge' });
    expect(stageOf(parsePrd(426), { ...open, outbox: null }, 4).action).toMatchObject({ label: 'Review & merge' });
    // An outbox that could not be read decides nothing: the stage is unknown.
    expect(stageOf(parsePrd(426), { ...open, outbox: UNREAD }, 4).id).toBe('unknown');
  });

  it('is shipped once the feature PR merged and there is no retro PR: Pitch, and the retro comes next', () => {
    expect(stageOf(parsePrd(426), summary({ phase0: pr(431, 'merged'), feature: pr(433, 'merged'), mergedSlices: 4 }))).toEqual({
      id: 'shipped', action: { kind: 'pitch', label: 'Pitch', prd: 426 }, caption: 'Shipped · the retro is written next',
    });
  });

  it('is retro once a retro PR exists, open or merged, and the latest stage wins: Pitch is its button', () => {
    for (const state of ['open', 'merged'] as const) {
      expect(stageOf(parsePrd(426), summary({ phase0: pr(431, 'merged'), feature: pr(433, 'merged'), mergedSlices: 4, retro: pr(440, state) }))).toEqual({
        id: 'retro', action: { kind: 'pitch', label: 'Pitch', prd: 426 }, caption: null,
      });
    }
  });

  it('is unknown when the summary is missing, or a part the deciding row needs could not be read', () => {
    expect(stageOf(parsePrd(426), null).id).toBe('unknown');
    expect(stageOf(parsePrd(426), summary({ retro: UNREAD })).id).toBe('unknown');
    expect(stageOf(parsePrd(426), summary({ feature: UNREAD })).id).toBe('unknown');
    expect(stageOf(parsePrd(426), summary({ mergedSlices: UNREAD })).id).toBe('unknown');
    expect(stageOf(parsePrd(426), summary({ phase0: UNREAD })).id).toBe('unknown');
    // A later stage already decided does not need the earlier parts.
    expect(stageOf(parsePrd(426), summary({ phase0: UNREAD, issue: UNREAD, retro: pr(440, 'open') })).id).toBe('retro');
  });
});

const row = (stage: StageRow['stage'], synced_at = '2026-09-29T09:15:00Z'): StageRow => ({ stage, reached_at: '2026-09-20T09:00:00Z', synced_at });

describe('the header\'s view of the stage (PRD 587)', () => {
  const building = summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open', true), mergedSlices: 1 });

  it('takes the stage from the stored rows, lights it bold with the earlier stops passed, and lists only the links that exist', () => {
    const view = stageView({ prd: parsePrd(426), rows: [row('prd'), row('inbox'), row('building')], github: building, slices: 3 });
    expect(view.track.map((s) => `${s.label}:${s.state}`)).toEqual(
      ['idea:passed', 'PRD:passed', 'inbox:passed', 'building:current', 'outbox:ahead', 'shipped:ahead', 'retro:ahead'],
    );
    expect(view).toMatchObject({ id: 'building', words: 'Stage: building', caption: 'Being built · 1/3 slices', action: null, badge: null });
    expect(view.links).toEqual([
      { label: 'issue #426', href: 'https://github.com/acme/widgets/issues/426', done: false },
      { label: 'phase-0 #431', href: 'https://github.com/acme/widgets/pull/431', done: true },
      { label: 'feature #433', href: 'https://github.com/acme/widgets/pull/433', done: false },
    ]);
  });

  it('never reads GitHub for the stage: the stored stage shows with the summary missing, only the GitHub-bound button goes', () => {
    for (const github of [null, undefined, summary({ retro: UNREAD, feature: UNREAD, phase0: UNREAD, mergedSlices: UNREAD, issue: UNREAD })]) {
      const view = stageView({ prd: parsePrd(426), rows: [row('outbox')], github });
      expect(view).toMatchObject({ id: 'outbox', words: 'Stage: outbox', action: null, links: [] });
      expect(stageView({ prd: parsePrd(426), rows: [row('inbox')], github }).action).toEqual({ kind: 'copy', label: 'Build it', command: '/omni:yolo 426' });
      expect(stageView({ prd: parsePrd(426), rows: [row('building')], github }).caption).toBe('Being built');
      expect(stageView({ prd: parsePrd(426), rows: [row('shipped')], github }).caption).toBe('Shipped · the retro is written next');
    }
  });

  it('keeps PRD 426\'s button for each stage', () => {
    const at = (rows: StageRow[], github: GithubSummary) => stageView({ prd: parsePrd(426), rows, github, slices: 4 }).action;
    expect(at([row('prd')], summary({ phase0: pr(431, 'open') }))).toEqual({ kind: 'link', label: 'Approve spec', href: 'https://github.com/acme/widgets/pull/431' });
    expect(stageView({ prd: parsePrd(426), rows: [row('prd')], github: summary() }).caption).toBe('Spec being written');
    expect(at([row('outbox')], summary({ feature: pr(433, 'open') }))).toEqual({ kind: 'link', label: 'Review & merge', href: 'https://github.com/acme/widgets/pull/433' });
  });

  it('is Pitch at shipped and retro, with or without GitHub, and at no earlier stage (PRD 859)', () => {
    const pitch = { kind: 'pitch', label: 'Pitch', prd: 426 };
    for (const github of [summary({ feature: pr(433, 'merged'), retro: pr(440, 'open') }), null]) {
      expect(stageView({ prd: parsePrd(426), rows: [row('shipped')], github }).action).toEqual(pitch);
      expect(stageView({ prd: parsePrd(426), rows: [row('retro')], github }).action).toEqual(pitch);
    }
    const earlier = summary({ phase0: pr(431, 'open'), feature: pr(433, 'open'), mergedSlices: 2 });
    for (const stage of ['prd', 'inbox', 'building', 'outbox'] as const) {
      for (const github of [earlier, null]) {
        expect(stageView({ prd: parsePrd(426), rows: [row(stage)], github }).action?.kind, stage).not.toBe('pitch');
      }
    }
    expect(stageView({ prd: null, rows: [] }).action).toBeNull();
    expect(stageView({ prd: null, answered: true, rows: [] }).action).toBeNull();
    expect(stageView({ prd: parsePrd(426), rows: [] }).action).toBeNull();
  });

  it('at building with open outbox items, shows N questions waiting linking to the outbox comment, and Answer the outbox', () => {
    const item = { id: 's1-01-x', rank: 'high' as const, question: 'Q?', decision: 'D.', options: [], personSteps: null };
    const comment = 'https://github.com/acme/widgets/pull/433#issuecomment-9';
    const view = stageView({ prd: parsePrd(426), rows: [row('building')], github: { ...building, outbox: { open: [item, { ...item, id: 's1-02-y' }], settled: [] }, outboxComment: comment } });
    expect(view.badge).toEqual({ label: '2 questions waiting', href: comment });
    expect(view.action).toEqual({ kind: 'link', label: 'Answer the outbox', href: comment });
  });

  it('reads Brainstorming for a draft with no answer and idea once answered, with no links and no sync time', () => {
    expect(stageView({ prd: null, rows: [] })).toMatchObject({ id: 'brainstorming', words: 'Brainstorming', caption: null, links: [], synced: null });
    expect(stageView({ prd: null, answered: true, rows: [] }).caption).toBe('Brainstorm in progress');
    expect(stageView({ prd: null, answered: true, rows: [] })).toMatchObject({ id: 'idea', words: 'Stage: idea' });
  });

  it('reads Syncing… for a numbered PRD with no rows yet, and says when each PRD was last synced', () => {
    expect(stageView({ prd: parsePrd(426), rows: [], github: building })).toMatchObject({ id: 'syncing', words: 'Syncing…', action: null, caption: null, synced: 'not synced yet' });
    expect(stageView({ prd: parsePrd(426), rows: [row('prd', '2026-09-29T11:15:00Z')] }).synced).toBe('last synced 29 Sep 2026, 11:15 UTC');
    expect(syncedWords(null)).toBe('not synced yet');
  });
});

describe('the feature PR\'s health chip (PRD 790, s2)', () => {
  const care = (more: Partial<CareState> = {}): CareState => ({
    ci: 'green', failedUrl: null, conflict: false, base: 'main', threads: [], watchingSince: null, lastRound: null, ...more,
  });
  const thread = (verdict: CareState['threads'][number]['verdict'], resolved: boolean) =>
    ({ url: 'https://github.com/acme/widgets/pull/433#discussion_r1', login: 'rev', avatar: null, firstLine: 'x', verdict, reason: null, resolved });

  it('reads CI ✓ · no conflict · N open, counting the unresolved threads', () => {
    expect(careChipOf(care({ threads: [thread('open', false), thread('asked', false), thread('fixed', true)] })))
      .toEqual({ label: 'CI ✓ · no conflict · 2 open', tone: 'ok' });
  });

  it('is red on CI red or a conflict, grey while CI runs', () => {
    expect(careChipOf(care({ ci: 'red' }))).toEqual({ label: 'CI red · no conflict · 0 open', tone: 'red' });
    expect(careChipOf(care({ conflict: true }))).toEqual({ label: 'CI ✓ · conflict · 0 open', tone: 'red' });
    expect(careChipOf(care({ ci: 'running' }))).toEqual({ label: 'CI running · no conflict · 0 open', tone: 'grey' });
    expect(careChipOf(care({ ci: 'running', conflict: true })).tone).toBe('red');
    expect(careChipOf(care({ ci: 'none', conflict: null }))).toEqual({ label: 'no CI · 0 open', tone: 'ok' });
  });

  it('sits on the open feature PR\'s link only: none when it is merged, absent, or its care could not be read', () => {
    const open = summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open'), mergedSlices: 1, care: care({ ci: 'red' }) });
    const feature = (github: GithubSummary) => stageView({ prd: parsePrd(426), rows: [row('outbox')], github }).links.find((l) => l.label.startsWith('feature'));
    expect(feature(open)?.chip).toEqual({ label: 'CI red · no conflict · 0 open', tone: 'red' });
    expect(stageView({ prd: parsePrd(426), rows: [row('outbox')], github: open }).links.filter((l) => l.chip)).toHaveLength(1);
    for (const more of [{ care: UNREAD }, { care: null }, { care: undefined }, { feature: pr(433, 'merged') }] as Partial<GithubSummary>[]) {
      expect(feature({ ...open, ...more })?.chip ?? null).toBeNull();
    }
  });
});
