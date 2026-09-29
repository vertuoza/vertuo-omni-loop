import { describe, expect, it } from 'vitest';
import { UNREAD } from '../dossier/github/summary';
import type { FixSummary } from '../dossier/github/fix';
import { fixState, readPickLine, STATE_LABELS, timelineOf, type PickRead } from './timeline';

// A fix's state and its Timeline (PRD 627, s5), as pure functions of what GitHub said of it and of the
// pick line of its latest before/after page: Asked, Picked (a visual fix only), Approved, Merged and
// Released, each with who and when, or *not yet*, *unknown* or *not recorded*.

const ISSUE = {
  number: 548, url: 'https://github.com/acme/widgets/issues/548', state: 'open' as const, author: 'anna', createdAt: '2026-09-29T08:00:00Z',
  risk: null, regression: false,
};
const OPEN = { number: 562, url: 'https://github.com/acme/widgets/pull/562', state: 'open' as const, mergedAt: null, mergedBy: null };
const MERGED = { ...OPEN, state: 'merged' as const, mergedAt: '2026-09-29T12:00:00Z', mergedBy: 'pierre-derval' };
const RELEASE = { tag: 'v0.0.79', url: 'https://github.com/acme/widgets/releases/tag/v0.0.79', at: '2026-09-29T12:05:00Z' };

const asked: FixSummary = { issue: ISSUE, pull: null, approvals: [], release: null };
const inReview: FixSummary = { issue: ISSUE, pull: OPEN, approvals: [{ login: 'carla', at: '2026-09-29T11:00:00Z' }], release: null };
const shipped: FixSummary = { issue: { ...ISSUE, state: 'closed' }, pull: MERGED, approvals: [{ login: 'carla', at: '2026-09-29T11:00:00Z' }], release: RELEASE };
const PICKED: PickRead = { letter: 'C', login: 'pierre-derval', date: '2026-09-29' };

const lines = (moments: ReturnType<typeof timelineOf>) => moments.map((m) => [m.label, m.state, m.who, m.when]);

describe('the pick line', () => {
  it('reads the one fixed shape: letter, login and date', () => {
    expect(readPickLine('<body><p data-omni-pick>Picked C by @pierre-derval on 2026-09-29</p></body>'))
      .toEqual({ letter: 'C', login: 'pierre-derval', date: '2026-09-29' });
  });

  it('ignores any other shape, and a page without it reads as not recorded', () => {
    for (const html of [
      '<p>Picked C by @pierre-derval on 2026-09-29</p>',
      '<p data-omni-pick>Picked c by @pierre-derval on 2026-09-29</p>',
      '<p data-omni-pick>Picked C by pierre-derval on 2026-09-29</p>',
      '<p data-omni-pick>Picked C by @pierre-derval on 29 Sep 2026</p>',
      '<p data-omni-pick>Picked C by @pierre-derval on 2026-09-29.</p>',
      '<p data-omni-pick class="x">Picked C by @pierre-derval on 2026-09-29</p>',
      '<p data-omni-pick>Picked C by @<b>x</b> on 2026-09-29</p>',
      '',
    ]) expect(readPickLine(html)).toBe('none');
  });
});

describe('the state pill', () => {
  it('reads Asked, In review or Merged by the spec\'s table', () => {
    expect(fixState(asked)).toBe('asked');
    expect(fixState(inReview)).toBe('in-review');
    expect(fixState(shipped)).toBe('merged');
    expect([STATE_LABELS.asked, STATE_LABELS['in-review'], STATE_LABELS.merged]).toEqual(['Asked', 'In review', 'Merged']);
  });

  it('is — when GitHub does not answer', () => {
    expect(fixState(null)).toBeNull();
    expect(fixState({ ...asked, pull: UNREAD })).toBeNull();
    expect(fixState({ ...asked, issue: UNREAD })).toBeNull();
    expect(STATE_LABELS.unknown).toBe('—');
  });

  it('is — for a closed issue with no fix PR open or merged', () => {
    expect(fixState({ ...asked, issue: { ...ISSUE, state: 'closed' } })).toBeNull();
  });
});

describe('the Timeline', () => {
  it('lists the five moments in order, each with who and when, on a visual fix released', () => {
    expect(lines(timelineOf('visual', shipped, PICKED))).toEqual([
      ['Asked', 'done', '@anna', '29 Sep 2026, 08:00 UTC'],
      ['Picked C', 'done', '@pierre-derval', '29 Sep 2026'],
      ['Approved', 'done', '@carla', '29 Sep 2026, 11:00 UTC'],
      ['Merged', 'done', '@pierre-derval', '29 Sep 2026, 12:00 UTC'],
      ['Released v0.0.79', 'done', null, '29 Sep 2026, 12:05 UTC'],
    ]);
    const moments = timelineOf('visual', shipped, PICKED);
    expect(moments.map((m) => m.href)).toEqual([ISSUE.url, null, OPEN.url, OPEN.url, RELEASE.url]);
  });

  it('gives a bug fix no Picked moment', () => {
    expect(timelineOf('bug', shipped, 'none').map((m) => m.id)).toEqual(['asked', 'approved', 'merged', 'released']);
  });

  it('keeps one Approved line per approving review', () => {
    const two = { ...inReview, approvals: [{ login: 'carla', at: '2026-09-29T11:00:00Z' }, { login: 'dan', at: '2026-09-29T11:30:00Z' }] };
    expect(timelineOf('bug', two, 'none').filter((m) => m.id === 'approved').map((m) => m.who)).toEqual(['@carla', '@dan']);
  });

  it('reads not yet for a moment not reached', () => {
    expect(lines(timelineOf('visual', asked, PICKED)).slice(2)).toEqual([
      ['Approved', 'not-yet', null, null],
      ['Merged', 'not-yet', null, null],
      ['Released', 'not-yet', null, null],
    ]);
    expect(lines(timelineOf('bug', { ...shipped, release: null }, 'none')).at(-1)).toEqual(['Released', 'not-yet', null, null]);
  });

  it('reads Picked: not recorded for a page without the pick line, and not yet with no page', () => {
    expect(timelineOf('visual', asked, 'none')[1]).toMatchObject({ label: 'Picked', state: 'not-recorded' });
    expect(timelineOf('visual', asked, 'no-page')[1]).toMatchObject({ label: 'Picked', state: 'not-yet' });
    expect(timelineOf('visual', asked, UNREAD)[1]).toMatchObject({ label: 'Picked', state: 'unknown' });
  });

  it('reads unknown for each moment GitHub could not answer, and for all of them without GitHub', () => {
    const states = (fix: FixSummary | null) => timelineOf('bug', fix, 'none').map((m) => m.state);
    expect(states(null)).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
    expect(states({ issue: UNREAD, pull: UNREAD, approvals: UNREAD, release: UNREAD })).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
    expect(states({ ...shipped, approvals: UNREAD, release: UNREAD })).toEqual(['done', 'unknown', 'done', 'unknown']);
    expect(timelineOf('visual', null, PICKED)[1].state).toBe('done');
  });
});
