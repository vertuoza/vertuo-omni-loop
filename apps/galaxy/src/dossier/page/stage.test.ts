import { describe, expect, it } from 'vitest';
import { UNREAD, type GithubSummary, type PullRef } from '../github/summary';
import { stageOf, stageView, UNKNOWN_WORDS } from './stage';

// The stage and its next action (PRD 426, part 2): each row of the spec's table, tried from the latest
// stage down, and unknown whenever what decides it could not be read.

const pr = (number: number, state: PullRef['state'], draft = false): PullRef =>
  ({ number, url: `https://github.com/acme/widgets/pull/${number}`, state, draft });
const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: 'acme/widgets', prd: 426, folder: '0426-prd-page-stage', topic: 'prd-page-stage',
  issue: { number: 426, url: 'https://github.com/acme/widgets/issues/426', state: 'open' },
  phase0: null, feature: null, retro: null, mergedSlices: 0, ...more,
});

describe('the stage of a PRD', () => {
  it('is idea for a draft, whatever GitHub says', () => {
    expect(stageOf(null, null)).toEqual({ id: 'idea', action: null, caption: 'Brainstorm in progress' });
  });

  it('is PRD while the spec is being written, with no button until a phase-0 PR is open', () => {
    expect(stageOf(426, summary())).toEqual({ id: 'prd', action: null, caption: 'Spec being written' });
    expect(stageOf(426, summary({ phase0: pr(431, 'open') }))).toEqual({
      id: 'prd', action: { kind: 'link', label: 'Approve spec', href: 'https://github.com/acme/widgets/pull/431' }, caption: null,
    });
  });

  it('is inbox once phase-0 merged and no sub-PR is merged: Build it copies the command', () => {
    expect(stageOf(426, summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open', true) }))).toEqual({
      id: 'inbox', action: { kind: 'copy', label: 'Build it', command: '/omni:yolo 426' }, caption: null,
    });
  });

  it('is outbox once a sub-PR merged: being built while the feature PR is a draft, Review & merge once it is ready', () => {
    const building = summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open', true), mergedSlices: 2 });
    expect(stageOf(426, building, 4)).toEqual({ id: 'outbox', action: null, caption: 'Being built · 2/4 slices' });
    expect(stageOf(426, building, null)).toMatchObject({ caption: 'Being built · 2 slices merged' });
    expect(stageOf(426, { ...building, feature: null }, 4)).toMatchObject({ id: 'outbox', action: null });
    expect(stageOf(426, { ...building, feature: pr(433, 'open') }, 4)).toEqual({
      id: 'outbox', action: { kind: 'link', label: 'Review & merge', href: 'https://github.com/acme/widgets/pull/433' }, caption: null,
    });
  });

  it('is shipped once the feature PR merged and there is no retro PR', () => {
    expect(stageOf(426, summary({ phase0: pr(431, 'merged'), feature: pr(433, 'merged'), mergedSlices: 4 }))).toEqual({
      id: 'shipped', action: null, caption: 'Shipped · the retro is written next',
    });
  });

  it('is retro once a retro PR exists, open or merged, and the latest stage wins', () => {
    for (const state of ['open', 'merged'] as const) {
      expect(stageOf(426, summary({ phase0: pr(431, 'merged'), feature: pr(433, 'merged'), mergedSlices: 4, retro: pr(440, state) }))).toEqual({
        id: 'retro', action: { kind: 'link', label: 'Read the retro', href: 'https://github.com/acme/widgets/pull/440' }, caption: null,
      });
    }
  });

  it('is unknown when the summary is missing, or a part the deciding row needs could not be read', () => {
    expect(stageOf(426, null).id).toBe('unknown');
    expect(stageOf(426, summary({ retro: UNREAD })).id).toBe('unknown');
    expect(stageOf(426, summary({ feature: UNREAD })).id).toBe('unknown');
    expect(stageOf(426, summary({ mergedSlices: UNREAD })).id).toBe('unknown');
    expect(stageOf(426, summary({ phase0: UNREAD })).id).toBe('unknown');
    // A later stage already decided does not need the earlier parts.
    expect(stageOf(426, summary({ phase0: UNREAD, issue: UNREAD, retro: pr(440, 'open') })).id).toBe('retro');
  });
});

describe('the header\'s view of the stage', () => {
  it('lights the current stop, ticks those passed, names the stage in words and lists only the links that exist', () => {
    const view = stageView(426, summary({ phase0: pr(431, 'merged'), feature: pr(433, 'open', true), mergedSlices: 1 }), 3);
    expect(view.track.map((s) => `${s.label}:${s.state}`)).toEqual(
      ['idea:passed', 'PRD:passed', 'inbox:passed', 'outbox:current', 'shipped:ahead', 'retro:ahead'],
    );
    expect(view.words).toBe('Stage: outbox');
    expect(view.links).toEqual([
      { label: 'issue #426', href: 'https://github.com/acme/widgets/issues/426', done: false },
      { label: 'phase-0 #431', href: 'https://github.com/acme/widgets/pull/431', done: true },
      { label: 'feature #433', href: 'https://github.com/acme/widgets/pull/433', done: false },
    ]);
  });

  it('lights nothing when unknown, and says so', () => {
    const view = stageView(426, null);
    expect(view.track.every((s) => s.state === 'ahead')).toBe(true);
    expect(view.words).toBe(UNKNOWN_WORDS);
    expect(view.links).toEqual([]);
  });

  it('leaves out of the links line what could not be read', () => {
    expect(stageView(426, summary({ issue: UNREAD, phase0: pr(431, 'open') })).links.map((l) => l.label)).toEqual(['phase-0 #431']);
  });
});
