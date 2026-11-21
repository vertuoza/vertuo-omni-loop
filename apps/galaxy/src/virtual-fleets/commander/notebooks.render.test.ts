import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommanderBody, RAIL_AT_REST } from './CommanderTab';
import type { CommanderView, Notebooks } from './commander.contract';
import { NORTHWIND } from './commander.fake';
import { notebooksAfter, NotebooksBody, undoQueue, UNDO_MS, type NotebooksProps } from './Notebooks';

// The Notebooks drawer as drawn (PRD 3107 s4, the `fleet-commander` screen's 2.B): `Notebooks · <n>` at the end of the status
// line; inside, the fleet notebook, then one notebook per mission, a delivered one folded; each line with its day, its words,
// its events' chip and Delete; a line deleted reads `Deleted by <login> · <time>` with Undo for 5 seconds, then the deletion
// is sent and the line leaves the drawer (AC-8).

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const NOW = new Date('2026-11-21T09:30:00Z');
const ROOM = '/app/fleet?fleet=blue-fleet&tab=room&mission=aaaaaaaa-0000-4000-8000-000000003110';
const line = (n: number, day: string, words: string, events = 1) => ({ id: `dddddddd-0000-4000-8000-00000000000${String(n)}`, day, line: words, events, href: ROOM });
const BOOKS: Notebooks = {
  fleet: [line(1, '2026-11-19', 'Quotes e2e needs the long timeout.', 3), line(2, '2026-11-14', 'Reviewer sent back loosened tests twice.', 2)],
  missions: [
    { mission: 'aaaaaaaa-0000-4000-8000-000000003110', number: 3110, title: 'Quotes export', status: 'running', lines: [line(3, '2026-11-21', 'PRD 2817 waited one day.'), line(4, '2026-11-20', 'QA sent PRD 2817 back.')] },
    { mission: 'aaaaaaaa-0000-4000-8000-000000003098', number: 3098, title: 'Invoices', status: 'delivered', lines: [line(5, '2026-11-12', 'Invoices shipped.'), line(6, '2026-11-11', 'The export ran twice.'), line(7, '2026-11-10', 'One.'), line(8, '2026-11-09', 'Two.')] },
  ],
  count: 8,
};
const props = (over: Partial<NotebooksProps> = {}): NotebooksProps => ({
  notebooks: BOOKS, me: 'mira-k', pending: new Map(), shown: new Set(), problem: null, onDelete: () => undefined, onUndo: () => undefined, onShow: () => undefined, ...over,
});
const drawn = (over: Partial<NotebooksProps> = {}) => renderToStaticMarkup(createElement(NotebooksBody, props(over)));

afterEach(() => { vi.useRealTimers(); });

describe('the Notebooks drawer', () => {
  it('2.B: Notebooks · <n> ends the status line', () => {
    const view: CommanderView = {
      workspace: NORTHWIND, fleet: 'blue-fleet', state: { kind: 'ready' }, status: { running: 2, waiting: 1, paused: 0, spent: 410, cap: 1000 },
      messages: [], suggestions: ['What waits on me?'], reading: { missions: 2, jobs: 3 }, cards: [], notebooks: { ...BOOKS, count: 14 }, me: 'mira-k',
    };
    const html = renderToStaticMarkup(createElement(CommanderBody, {
      view, now: NOW, pending: null, draft: '', problem: null, onDraft: () => undefined, onAsk: () => undefined,
      rail: { ...RAIL_AT_REST, onPick: () => undefined, onConfirm: () => undefined, onCancel: () => undefined },
    }));
    expect(text(html)).toContain('2 running · 1 waiting · 0 paused · tokens 41% today Notebooks · 14');
  });

  it('2.B: the fleet notebook, then each mission\'s, a delivered one folded; each line with its day, its events and Delete', () => {
    const html = drawn();
    const t = text(html);
    expect(t).toContain('Fleet notebook 11-19 Quotes e2e needs the long timeout. 3 events Delete 11-14 Reviewer sent back loosened tests twice. 2 events Delete');
    expect(t).toContain('Mission 3110 · Quotes export 11-21 PRD 2817 waited one day. 1 event Delete 11-20 QA sent PRD 2817 back. 1 event Delete');
    expect(t).toContain('Mission 3098 · Delivered 4 lines · Show');
    expect(t).not.toContain('Invoices shipped.');
    expect(html).toContain(`<a class="commander-chip" href="${ROOM.replace(/&/g, '&amp;')}">3 events</a>`);
    expect(t.indexOf('Fleet notebook')).toBeLessThan(t.indexOf('Mission 3110'));
  });

  it('2.B: Show opens a folded notebook', () => {
    expect(text(drawn({ shown: new Set(['aaaaaaaa-0000-4000-8000-000000003098']) }))).toContain('Mission 3098 · Delivered 11-12 Invoices shipped. 1 event Delete');
  });

  it('2.B, AC-8: a line deleted reads Deleted by its member and the time, with Undo, in its place', () => {
    const t = text(drawn({ pending: new Map([['dddddddd-0000-4000-8000-000000000003', '2026-11-21T09:20:00Z']]) }));
    expect(t).toContain('Mission 3110 · Quotes export Deleted by mira-k · 09:20 Undo 11-20 QA sent PRD 2817 back.');
    expect(t).not.toContain('PRD 2817 waited one day.');
  });

  it('says so when the fleet notebook holds no line yet, and a refusal under the notebooks', () => {
    const t = text(drawn({ notebooks: { fleet: [], missions: [], count: 0 }, problem: 'Not deleted: try again.' }));
    expect(t).toBe('Fleet notebook No line yet: the notebook job writes once a mission’s day ends. Not deleted: try again.');
  });

  it('AC-8: a line deleted leaves the drawer and the count; a mission\'s notebook with no line left goes', () => {
    const after = notebooksAfter(notebooksAfter(BOOKS, 'dddddddd-0000-4000-8000-000000000001'), 'dddddddd-0000-4000-8000-000000000003');
    expect(after.fleet.map((l) => l.line)).toEqual(['Reviewer sent back loosened tests twice.']);
    expect(after.missions[0]?.lines.map((l) => l.line)).toEqual(['QA sent PRD 2817 back.']);
    expect(after.count).toBe(6);
    const empty = notebooksAfter(after, 'dddddddd-0000-4000-8000-000000000004');
    expect(empty.missions.map((b) => b.number)).toEqual([3098]);
  });

  it('AC-8: a deletion is sent after 5 seconds, never when undone before, and at once when the tab is left', () => {
    vi.useFakeTimers();
    const sent: string[] = [];
    const queue = undoQueue((note) => { sent.push(note); });
    queue.hold('a');
    queue.hold('b');
    queue.hold('a');
    vi.advanceTimersByTime(UNDO_MS - 1);
    expect(sent).toEqual([]);
    queue.undo('b');
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(['a']);
    vi.advanceTimersByTime(UNDO_MS);
    expect(sent).toEqual(['a']);
    queue.hold('c');
    queue.flush();
    expect(sent).toEqual(['a', 'c']);
    vi.advanceTimersByTime(UNDO_MS);
    expect(sent).toEqual(['a', 'c']);
  });
});
