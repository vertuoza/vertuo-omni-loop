import { describe, expect, it } from 'vitest';
import { demoChat, demoFinding, demoOpen, demoSeat, demoSupervisor } from './demo';
import {
  NO_CHECK, chatOf, checkOf, chipsOf, evidenceOf, headerOf, highCount, hrefOf, lastSaid, nextWords, openFinding, phoneSide, queryOf, sectionsOf,
  limitOf, spanWords, suggestionsOf, threadOf, tokenWords,
} from './model';

// The Supervisor page's words (PRD omni-loop-34 s5), against the before/after page's 2.A to 2.G.

const NOW = '2026-11-25T14:42:00.000Z';
const RUNNER = { name: 'atlas-01', slots: 4 };
const minutesAgo = (m: number) => new Date(Date.parse(NOW) - m * 60_000).toISOString();

describe('the words for numbers and times', () => {
  it('says tokens, spans and the wait in short', () => {
    expect([tokenWords(980), tokenWords(412_000), tokenWords(5_000_000), tokenWords(1_250_000)]).toEqual(['980', '412k', '5M', '1.3M']);
    expect([spanWords(40_000), spanWords(12 * 60_000), spanWords(80 * 60_000), spanWords(120 * 60_000)]).toEqual(['40 s', '12 min', '1 h 20', '2 h']);
    expect([limitOf('5'), limitOf(' 2,5 '), limitOf('0.001'), limitOf('1000')]).toEqual([5_000_000, 2_500_000, 1000, 1_000_000_000]);
    expect([limitOf(''), limitOf('lots'), limitOf('0'), limitOf('1001')]).toEqual([null, null, null, null]);
    expect([nextWords(80_000), nextWords(40_000), nextWords(120_000), nextWords(-5)]).toEqual(['1 min 20', '40 s', '2 min', 'now']);
  });
});

describe('headerOf', () => {
  it('reads Watching with the seat, the last look, the next one and the tokens of the day (2.A)', () => {
    const header = headerOf(demoSeat(NOW), RUNNER, NOW);
    expect(header.state).toBe('watching');
    expect(header.label).toBe('Watching');
    expect(header.meta).toEqual([
      { before: 'seat', value: 'atlas-01 · slot 4' }, { before: 'last look', value: '40 s ago' }, { before: 'next in', value: '1 min 20' },
      { value: '412k', after: 'tokens today of 5M' },
    ]);
    expect(header.short).toBe('atlas-01 · last look 40 s');
    expect(header.offline).toBeNull();
  });

  it('reads Paused by you when an owner paused it', () => {
    expect(headerOf(demoSeat(NOW, { paused: true }), RUNNER, NOW)).toMatchObject({ state: 'paused', label: 'Paused by you' });
  });

  it('AC-7: reads "Thinking paused until midnight: 5M tokens used" past the daily limit', () => {
    const header = headerOf(demoSeat(NOW, { tokensToday: 5_000_000, thinking: false }), RUNNER, NOW);
    expect(header).toMatchObject({ state: 'limit', label: 'Thinking paused until midnight: 5M tokens used' });
  });

  it('reads Offline since its last look once it missed 3 looks, or as long, checks still running (2.E)', () => {
    const missed = headerOf(demoSeat(NOW, { lastLookAt: '2026-11-25T14:02:00.000Z', missedLooks: 3 }), RUNNER, NOW);
    expect(missed).toMatchObject({ state: 'offline', label: 'Offline since 14:02', offline: 'Offline since 14:02 on atlas-01.' });
    expect(missed.meta).toEqual([{ before: 'seat', value: 'atlas-01 · slot 4' }, { before: 'last look', value: '14:02' }, { after: 'checks still run every 2 min' }]);
    expect(headerOf(demoSeat(NOW, { lastLookAt: minutesAgo(7), missedLooks: 0 }), RUNNER, NOW).state).toBe('offline');
    expect(headerOf(demoSeat(NOW, { lastLookAt: null }), RUNNER, NOW)).toMatchObject({ state: 'offline', label: 'Offline: no look yet' });
    expect(headerOf(demoSeat(NOW, { lastLookAt: minutesAgo(5) }), RUNNER, NOW).state).toBe('watching');
  });

  it('puts offline before paused, and paused before the limit', () => {
    expect(headerOf(demoSeat(NOW, { paused: true, missedLooks: 3 }), RUNNER, NOW).state).toBe('offline');
    expect(headerOf(demoSeat(NOW, { paused: true, thinking: false }), RUNNER, NOW).state).toBe('paused');
  });

  it('reads No seat yet with no seat placed', () => {
    expect(headerOf(null, null, NOW)).toMatchObject({ state: 'none', label: 'No seat yet' });
  });
});

describe('the list', () => {
  it('counts each kind on its chip', () => {
    expect(chipsOf(demoOpen(NOW)).map((c) => [c.label, c.count])).toEqual([['All', 4], ['Stuck work', 2], ['Omni Loop bug', 1], ['Runner health', 1]]);
  });

  it('puts high findings under Needs you now and medium ones under When you have a minute, newest first (2.A)', () => {
    const sections = sectionsOf('open', demoOpen(NOW), 'all', NOW);
    expect(sections.map((s) => [s.title, s.rows.map((r) => r.id)])).toEqual([
      ['Needs you now', ['f-silent', 'f-route']], ['When you have a minute', ['f-disk', 'f-queue']],
    ]);
    const [high] = sections;
    expect(high?.rows[0]).toMatchObject({ context: 'Stuck work', title: 'PRD 3232’s job silent for 52 min', line: 'Silent job · No line for 52 min · 3× the 2.5 min usual', age: '52 min', late: true, sprite: 'menu-waiting', ended: null });
  });

  it('filters by the chip and leaves an empty section out', () => {
    expect(sectionsOf('open', demoOpen(NOW), 'health', NOW).map((s) => s.title)).toEqual(['When you have a minute']);
    expect(sectionsOf('open', [], 'all', NOW)).toEqual([]);
  });

  it('lists Done in one section, the last closed first, each with how it ended', () => {
    const done = sectionsOf('done', [
      demoFinding(NOW, { id: 'a', state: 'dismissed', closedAt: minutesAgo(200) }), demoFinding(NOW, { id: 'b', state: 'acted', closedAt: minutesAgo(10) }),
    ], 'all', NOW);
    expect(done.map((s) => [s.title, s.rows.map((r) => [r.id, r.ended, r.late])])).toEqual([['Done', [['b', 'Acted', false], ['a', 'Not a problem', false]]]]);
  });

  it('counts the open high findings for the menu', () => {
    expect(highCount(demoOpen(NOW))).toBe(2);
  });
});

describe('the pane', () => {
  it('shows the check that fired, split into its name and figures, or says no check fired', () => {
    expect(checkOf('Silent job: no line for 52 min, 3× the 2.5 min usual')).toEqual({ name: 'Silent job', figures: ['No line for 52 min', '3× the 2.5 min usual'], fired: true });
    expect(checkOf('Late schedule')).toEqual({ name: 'Late schedule', figures: [], fired: true });
    expect(checkOf(null)).toEqual({ name: NO_CHECK, figures: [], fired: false });
  });

  it('writes the evidence one line each', () => {
    expect(evidenceOf(['Heartbeat fine.', { runner: 'atlas-01', free: '22 GB' }, 3, null, { jobs: ['a', 'b'] }])).toEqual([
      'Heartbeat fine.', 'runner atlas-01 · free 22 GB', '3', 'jobs ["a","b"]',
    ]);
  });

  it('lists at most two suggestions', () => {
    expect(suggestionsOf(demoFinding(NOW))).toEqual(['Stop and resume the job', 'Open Terminal']);
  });

  it('opens the thread with the Supervisor\'s explanation, signed as an agent, then the messages', () => {
    const thread = threadOf(demoFinding(NOW), [{ id: 'r', finding: 'f-silent', kind: 'result', by: null, body: 'Resumed.', replyTo: null, remembered: null, at: '2026-11-25T14:40:00.000Z' }]);
    expect(thread.map((s) => [s.who, s.agent, s.at, s.paragraphs.length])).toEqual([['Supervisor', true, '14:10', 3], ['Result', false, '14:40', 1]]);
    expect(threadOf(demoFinding(NOW, { lookedAt: null }), [])).toEqual([]);
  });

  it('writes the general chat with each author and the remembered note', () => {
    const chat = chatOf(demoChat(NOW));
    expect(chat.map((s) => [s.who, s.agent, s.remembered])).toEqual([['Supervisor', true, null], ['demo', false, null], ['Supervisor', true, 'box-3 kit drift']]);
    expect(lastSaid(demoChat(NOW)).line).toBe('Last: “Fix both: 9 free slots.”');
    expect(lastSaid([])).toEqual({ line: 'No message yet', at: null });
  });

  it('opens the finding the address names, on either tab', () => {
    const data = demoSupervisor(NOW);
    expect(openFinding(data, 'f-route')?.title).toBe('runner ask answers 500 since v0.0.705');
    expect(openFinding(data, 'f-kit')?.state).toBe('resolved');
    expect(openFinding(data, 'nope')).toBeNull();
    expect(openFinding(data, null)).toBeNull();
  });
});

describe('the address', () => {
  it('reads the tab, the chip, the finding and the phone side, unknown values as defaults', () => {
    expect(queryOf({})).toEqual({ tab: 'open', kind: 'all', finding: null, view: 'list' });
    expect(queryOf({ tab: 'done', kind: 'bug', finding: 'f1', view: 'chat' })).toEqual({ tab: 'done', kind: 'bug', finding: 'f1', view: 'chat' });
    expect(queryOf({ tab: 'x', kind: 'y', view: 'z' })).toEqual({ tab: 'open', kind: 'all', finding: null, view: 'list' });
  });

  it('writes the page\'s address with the defaults left out', () => {
    const query = queryOf({});
    expect(hrefOf(query)).toBe('/app/supervisor');
    expect(hrefOf(query, { kind: 'stuck', finding: 'f1' })).toBe('/app/supervisor?kind=stuck&finding=f1');
    expect(hrefOf(query, { tab: 'done', view: 'chat' })).toBe('/app/supervisor?tab=done&view=chat');
  });

  it('shows one side below 900 px: the list, or the pane once a finding or the chat is asked for (2.G)', () => {
    expect(phoneSide(queryOf({}), false)).toBe('list');
    expect(phoneSide(queryOf({ finding: 'f1' }), true)).toBe('pane');
    expect(phoneSide(queryOf({ finding: 'gone' }), false)).toBe('list');
    expect(phoneSide(queryOf({ view: 'chat' }), false)).toBe('pane');
  });
});
