import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { RoomTab } from './RoomTab';
import { bugLinesOf, ledgerOf, nowLines, type EventRow, type HeroLine, type RoomView } from './room';
import { repairLinesOf, type RepairEvent, type RepairFacts, type RepairRow } from '../repair';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

// The Omni Loop bug team in the Operation room (PRD 3088 s6, the `fleet-room` screen, before-after 1.A to 1.D): one row per bug the team
// holds, the three event sentences, and a waiting PRD's row once its bug is fixed, needs a kit update, resumed or will not be fixed.

const M = '11111111-1111-4111-8111-111111111111';
const JOB = '33333333-3333-4333-8333-333333333333';
const ISSUE = (n: number) => `https://github.com/vertuoza/vertuo-omni-loop/issues/${String(n)}`;
const team = (over: Partial<EventRow>): EventRow => ({ id: crypto.randomUUID(), mission: M, at: '2026-11-18T06:40:00Z', role: 'supervisor', actor: 'agent', kind: 'bug-taken', prd: null, job: JOB, link: ISSUE(3102), sentence: 'x', ...over });

const taken = team({ sentence: 'Took Omni Loop bug #3102 (reported 7×): sent /omni:bug-fix 3102, try 1 of 3.' });
const open = team({ at: '2026-11-18T06:12:00Z', role: 'engineer', kind: 'job-ended', link: 'https://github.com/vertuoza/vertuo-omni-loop/pull/3111', sentence: 'Omni Loop bug #3097 (reported 4×): fix PR #3111 is open; it waits for a person\'s merge.' });
const asked = team({ at: '2026-11-18T05:55:00Z', kind: 'bug-asked', link: ISSUE(3090), sentence: 'Omni Loop bug #3090 (reported 2×) is set aside: its bug fix says it may not be a bug, and its question waits for a person.' });

describe('the bug team\'s room rows', () => {
  it('AC-9: reads one row per bug it holds: Fixing, a PR to merge, and asked with its why', () => {
    expect(bugLinesOf([asked, open, taken])).toEqual([
      { issue: 3102, role: 'engineer', words: 'Fixing #3102 · reported 7×', chip: 'Fixing', link: ISSUE(3102) },
      { issue: 3097, role: 'engineer', words: '#3097 · 4× · PR #3111 to merge', chip: 'Waiting for a merge', link: 'https://github.com/vertuoza/vertuo-omni-loop/pull/3111' },
      { issue: 3090, role: 'supervisor', words: '#3090 · asked: its bug fix says it may not be a bug', chip: 'Asked', link: ISSUE(3090) },
    ]);
  });

  it('keeps a bug\'s newest event only, and none for a bug back in line or one a PRD of this fleet saw fixed', () => {
    const back = team({ at: '2026-11-18T07:00:00Z', role: 'engineer', kind: 'job-ended', sentence: 'Omni Loop bug #3102 (reported 7×): its bug fix ended cancelled, 1 of 3 tries spent; it goes back in line.' });
    const fixed = team({ at: '2026-11-18T08:00:00Z', kind: 'bug-fixed', prd: parsePrd(412), sentence: 'Omni Loop bug #3097 is fixed in v0.0.690.' });
    expect(bugLinesOf([taken, back, open, fixed])).toEqual([]);
  });

  it('reads the asked row of a bug set aside after its tries by the tries it spent', () => {
    const spent = team({ kind: 'bug-asked', sentence: 'Omni Loop bug #3090 (reported 2×) is set aside after 3 tries (cancelled, cancelled, cancelled): it waits for a person.' });
    expect(bugLinesOf([spent])[0]?.words).toBe('#3090 · asked: 3 tries');
  });

  it('draws the rows in the Now list with their chip and the linked issue', () => {
    const view: RoomView = { fleet: 'f', color: null, now: [], cleanUp: 'x', bugs: bugLinesOf([taken, asked]), stopped: [], missions: [], ledger: [], filter: { role: null, mission: null }, empty: false };
    const out = renderToStaticMarkup(createElement(RoomTab, { view, keep: {} }));
    expect(out).toContain('Fixing #3102 · reported 7×');
    expect(out).toContain('Omni Loop bug #3102');
    expect(out).toContain('#3090 · asked: its bug fix says it may not be a bug');
    expect(out).toContain('Asked');
  });
});

describe('the three event sentences in the ledger', () => {
  const at = (kind: string, sentence: string, over: Partial<EventRow> = {}) => ledgerOf([team({ kind, sentence, ...over })], { role: null, mission: null })[0];

  it('AC-9: bug-taken, bug-asked and bug-fixed each carry their word and the issue link', () => {
    expect(at('bug-taken', taken.sentence)).toMatchObject({ state: 'Fixing', linkLabel: '#3102', sentence: taken.sentence });
    expect(at('bug-asked', asked.sentence, { link: ISSUE(3090) })).toMatchObject({ state: 'Asked', linkLabel: '#3090' });
    expect(at('bug-fixed', 'Omni Loop bug #3102 is fixed in v0.0.690.', { prd: parsePrd(412) })).toMatchObject({ state: 'Fixed', linkLabel: '#3102' });
  });

  it('AC-6: reads the update-kit line as Fixed, and the resumed line as Resumed', () => {
    expect(at('bug-fixed', 'Omni Loop bug #3102 is fixed in v0.0.690. Fixed in v0.0.690: update the kit to resume (omni update).', { prd: parsePrd(412) })?.state).toBe('Fixed');
    expect(at('bug-fixed', 'PRD 412 resumed: the kit is at v0.0.690.', { prd: parsePrd(412), link: ISSUE(3102) })?.state).toBe('Resumed');
  });

  it('AC-8: reads the won\'t-fix line as Won\'t fix', () => {
    expect(at('bug-fixed', 'Omni Loop bug #3102 won\'t be fixed: take this PRD by hand.', { prd: parsePrd(412) })?.state).toBe('Won\'t fix');
  });

  it('reads the open fix pull request of a bug as waiting for a merge', () => {
    expect(at('job-ended', open.sentence, { role: 'engineer' })?.state).toBe('Waiting for a merge');
  });
});

describe('a waiting PRD\'s row once its bug moved (1.B, 1.C, 1.D)', () => {
  const PRD = parsePrd(412);
  const row = (): RepairRow => ({ mission: M, prd: PRD, trigger: 'failure', fingerprint: '9c41e0b2'.padEnd(64, '0'), round: 1, number: 1, job: JOB, fixPr: null, outcome: 'stopped', startedAt: '2026-11-18T02:00:00Z', retro: { cause: 'The kit', class: 'omni-loop', proposedFix: 'x' } });
  const ev = (kind: string, at: string, sentence: string, link: string | null = ISSUE(3102)): RepairEvent => ({ mission: M, kind, prd: PRD, job: JOB, link, at, sentence });
  const lineWith = (moved: string): ReturnType<typeof repairLinesOf>[number] | undefined => {
    const events = [ev('repair-started', '2026-11-18T02:00:00Z', 'Sent'), ev('bug-reported', '2026-11-18T02:14:00Z', 'met'), ev('bug-fixed', '2026-11-18T09:03:00Z', moved)];
    const facts: RepairFacts = { rows: [row()], events: events.toSorted((a, b) => b.at.localeCompare(a.at)), statuses: new Map([[M, 'running' as const]]) };
    return repairLinesOf(facts)[0];
  };
  const engineer: HeroLine = { id: 'e', name: 'e', role: 'engineer', skills: ['yolo'] };
  const sent: EventRow = { id: 'a', mission: M, at: '2026-11-18T02:00:00Z', role: 'engineer', actor: 'agent', kind: 'dispatched', prd: PRD, job: JOB, link: null, sentence: 'Sent PRD 412.' };
  const nowOf = (moved: string) => nowLines([engineer], [sent], [], [lineWith(moved) ?? (() => { throw new Error('no line'); })()])[0];

  it('AC-6: a fix a kit must be updated for reads fixed in v0.0.690 · update kit, Waiting for you', () => {
    expect(nowOf('Omni Loop bug #3102 is fixed in v0.0.690. Fixed in v0.0.690: update the kit to resume (omni update).')).toMatchObject({ words: 'PRD 412 · fixed in v0.0.690 · update kit', state: 'waiting', repair: { chip: 'Waiting for you', bug: 'update-kit' } });
  });

  it('AC-7: the PRD that went again reads resumed, Building', () => {
    expect(nowOf('PRD 412 resumed: the kit is at v0.0.690.')).toMatchObject({ words: 'PRD 412 · resumed · bug #3102 fixed', state: 'working', repair: { chip: 'Building' } });
  });

  it('AC-8: a bug that will not be fixed reads Stopped', () => {
    expect(nowOf('Omni Loop bug #3102 won\'t be fixed: take this PRD by hand.')).toMatchObject({ words: 'PRD 412 · bug #3102 won\'t be fixed', state: 'stopped', repair: { chip: 'Stopped' } });
  });

  it('a fix the kit already runs reads fixed, waiting for its next step, and each line is seven words or fewer before its link', () => {
    const fixed = lineWith('Omni Loop bug #3102 is fixed in v0.0.690.');
    expect(fixed).toMatchObject({ bug: 'fixed', headline: 'PRD 412 · fixed in v0.0.690 · waits for its next step' });
    for (const line of ['PRD 412 · fixed in v0.0.690 · update kit', 'PRD 412 · resumed · bug #3102 fixed', 'PRD 412 · bug #3102 won\'t be fixed']) expect(line.split(' ').filter((w) => w !== '·').length).toBeLessThanOrEqual(7);
  });

  it('still reads Waits on Omni Loop bug while the bug is open', () => {
    const facts: RepairFacts = { rows: [row()], events: [ev('bug-reported', '2026-11-18T02:14:00Z', 'met'), ev('repair-started', '2026-11-18T02:00:00Z', 'Sent')], statuses: new Map([[M, 'running' as const]]) };
    expect(repairLinesOf(facts)[0]).toMatchObject({ headline: 'Waits on Omni Loop bug #3102' });
  });
});
