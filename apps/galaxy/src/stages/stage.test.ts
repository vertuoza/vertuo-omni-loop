import { describe, expect, it } from 'vitest';
import { currentStage, STAGES, storedStageOf, STORED_STAGES, type StageRow } from './stage';

// Where a PRD is (PRD 587), from its stored stages alone: the current stage, the track and the questions
// badge. A draft is read from its rounds, a numbered PRD with no rows is not synced yet.

const row = (stage: StageRow['stage'], reached_at = '2026-09-20T09:00:00Z', synced_at = '2026-09-29T09:15:00Z'): StageRow =>
  ({ stage, reached_at, synced_at });
const track = (view: ReturnType<typeof storedStageOf>) => view.track.map((s) => `${s.id}:${s.state}`).join(' ');

describe('the seven stages', () => {
  it('go idea, PRD, inbox, building, outbox, shipped, retro, and every one but idea is stored', () => {
    expect(STAGES).toEqual(['idea', 'prd', 'inbox', 'building', 'outbox', 'shipped', 'retro']);
    expect(STORED_STAGES).toEqual(STAGES.slice(1));
  });
});

describe('the current stage', () => {
  it('is the latest stage on the track that was reached, whatever the dates say', () => {
    expect(currentStage([])).toBeNull();
    expect(currentStage([row('shipped', '2026-09-01T00:00:00Z'), row('inbox', '2026-09-20T00:00:00Z')])).toBe('shipped');
    expect(currentStage([row('prd'), row('building'), row('inbox')])).toBe('building');
  });
});

describe('the stage of a PRD', () => {
  it('reads Brainstorming with nothing lit for a draft with no answer, and lights idea once it has one', () => {
    const idle = storedStageOf({ prd: null, answered: false, rows: [] });
    expect(idle).toMatchObject({ id: 'brainstorming', words: 'Brainstorming', badge: null, syncedAt: null });
    expect(idle.track.every((s) => s.state === 'ahead')).toBe(true);
    const answered = storedStageOf({ prd: null, answered: true, rows: [] });
    expect(answered).toMatchObject({ id: 'idea', words: 'Stage: idea' });
    expect(track(answered)).toBe('idea:current prd:ahead inbox:ahead building:ahead outbox:ahead shipped:ahead retro:ahead');
  });

  it('reads Syncing… with nothing lit for a numbered PRD with no rows yet', () => {
    const view = storedStageOf({ prd: 587, rows: [] });
    expect(view).toMatchObject({ id: 'syncing', words: 'Syncing…', badge: null, syncedAt: null });
    expect(view.track.every((s) => s.state === 'ahead')).toBe(true);
  });

  it('lights each stored stage with every earlier stop passed', () => {
    for (const [i, stage] of STORED_STAGES.entries()) {
      const view = storedStageOf({ prd: 587, rows: [row(stage)] });
      expect(view.id).toBe(stage);
      expect(view.track.map((s) => s.state)).toEqual(STAGES.map((_, j) => (j < i + 1 ? 'passed' : j === i + 1 ? 'current' : 'ahead')));
    }
    expect(storedStageOf({ prd: 587, rows: [row('outbox')] }).words).toBe('Stage: outbox');
    expect(storedStageOf({ prd: 587, rows: [row('prd')] }).words).toBe('Stage: PRD');
  });

  it('shows every earlier stop passed for retro alone, a PRD whose earlier stages were never seen', () => {
    expect(track(storedStageOf({ prd: 587, rows: [row('retro')] })))
      .toBe('idea:passed prd:passed inbox:passed building:passed outbox:passed shipped:passed retro:current');
  });

  it('says when it was last synced: the latest synced_at of its rows', () => {
    expect(storedStageOf({ prd: 587, rows: [row('prd', undefined, '2026-09-29T09:00:00Z'), row('inbox', undefined, '2026-09-29T09:15:00Z')] }).syncedAt)
      .toBe('2026-09-29T09:15:00Z');
  });

  it('shows N questions waiting at building when the feature PR has open outbox items, linking to the outbox comment', () => {
    const at = 'https://github.com/acme/widgets/pull/9#issuecomment-1';
    expect(storedStageOf({ prd: 587, rows: [row('building')], openOutbox: { count: 3, href: at } }).badge)
      .toEqual({ label: '3 questions waiting', href: at });
    expect(storedStageOf({ prd: 587, rows: [row('building')], openOutbox: { count: 1, href: at } }).badge?.label).toBe('1 question waiting');
    expect(storedStageOf({ prd: 587, rows: [row('building')], openOutbox: { count: 0, href: at } }).badge).toBeNull();
    expect(storedStageOf({ prd: 587, rows: [row('building')], openOutbox: null }).badge).toBeNull();
    // Only building carries it: at outbox the feature PR is already waiting for a person.
    expect(storedStageOf({ prd: 587, rows: [row('outbox')], openOutbox: { count: 3, href: at } }).badge).toBeNull();
  });
});
