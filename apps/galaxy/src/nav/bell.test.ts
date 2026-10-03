import { describe, expect, it } from 'vitest';
import type { DocumentGroup } from '../waiting/documents';
import { EMPTY_WAITING, type WaitingOutbox, type WaitingQuestion } from '../waiting/waiting';
import { bell, bellName, bellPanel, CLOSED_BELL, waitedFor } from './bell';
import { item } from '../ask/test-item';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

// The top bar's bell (PRD 499), as pure functions: its accessible name, how long a question has
// waited, the panel's groups and lines, and the panel's open and close.

const NOW = Date.parse('2026-09-28T10:00:00Z');
const MIN = 60_000;

const q = (id: string, ago: number, sharedBy: string | null = null): WaitingQuestion => ({
  kind: 'question', id, sessionTitle: `terminal ${id}`, question: `question ${id}`, askedAt: NOW - ago, sharedBy,
});
const o = (id: string, prd: number, rank: WaitingOutbox['rank'] = 'high'): WaitingOutbox => ({
  kind: 'outbox', id, prd: parsePrd(prd), dossierId: `d-${prd}`, title: `PRD title ${prd}`, rank, question: `outbox ${id}?`,
});

describe('the bell\'s accessible name', () => {
  it('says how many wait, or that nothing does', () => {
    expect(bellName(0)).toBe('Nothing waiting for you');
    expect(bellName(3)).toBe('Waiting for you: 3');
  });
});

describe('how long a question has waited', () => {
  it('reads in minutes, then hours, then days', () => {
    expect(waitedFor(20_000)).toBe('just now');
    expect(waitedFor(3 * MIN)).toBe('3 min');
    expect(waitedFor(59 * MIN)).toBe('59 min');
    expect(waitedFor(2 * 60 * MIN + 5 * MIN)).toBe('2 h');
    expect(waitedFor(3 * 24 * 60 * MIN)).toBe('3 d');
    expect(waitedFor(-5000)).toBe('just now');
  });
});

describe('the panel', () => {
  it('says nothing waits when both groups are empty and both parts were read', () => {
    expect(bellPanel(EMPTY_WAITING, {}, NOW)).toEqual({ groups: [], empty: true });
  });

  it('lists the Questions group then the Outbox group, each oldest first, with their links', () => {
    const panel = bellPanel({ questions: [q('late', MIN), q('early', 5 * MIN, 'Bob')], outbox: [o('i1', 459), o('i2', 460, 'human-action')] }, {}, NOW);
    expect(panel.empty).toBe(false);
    expect(panel.groups.map((g) => g.label)).toEqual(['Questions', 'Outbox']);
    expect(item(panel.groups, 0).lines).toEqual([
      { id: 'early', href: '/ask/q/early', head: 'terminal early', text: 'question early', meta: '5 min', sharedBy: { name: 'Bob', face: { kind: 'initial', letter: 'B' } } },
      { id: 'late', href: '/ask/q/late', head: 'terminal late', text: 'question late', meta: '1 min' },
    ]);
    expect(item(panel.groups, 1).lines).toEqual([
      { id: 'i1', href: '/prd/d-459?tab=outbox', head: 'PRD 459 · PRD title 459', text: 'outbox i1?', meta: 'high' },
      { id: 'i2', href: '/prd/d-460?tab=outbox', head: 'PRD 460 · PRD title 460', text: 'outbox i2?', meta: 'human-action' },
    ]);
  });

  it('carries who shared a question with the face the list read for them (PRD 652)', () => {
    const face = { kind: 'photo' as const, url: 'https://a.test/bob.png' };
    const panel = bellPanel({ questions: [{ ...q('x', MIN, 'Bob'), sharedByFace: face }], outbox: [] }, {}, NOW);
    expect(item(panel.groups, 0).lines[0]).toMatchObject({ meta: '1 min', sharedBy: { name: 'Bob', face } });
  });

  it('shows only a group that has items', () => {
    const panel = bellPanel({ questions: [], outbox: [o('i1', 459)] }, {}, NOW);
    expect(panel.groups.map((g) => g.label)).toEqual(['Outbox']);
  });

  it('keeps a part that could not be read, saying it is retried, with the items it last had', () => {
    const panel = bellPanel({ questions: [q('a', MIN)], outbox: [] }, { outbox: true }, NOW);
    expect(panel.empty).toBe(false);
    expect(panel.groups).toEqual([
      expect.objectContaining({ label: 'Questions', problem: null }),
      { label: 'Outbox', problem: 'Outbox couldn\'t be read — retrying.', lines: [] },
    ]);
    const kept = bellPanel({ questions: [q('a', MIN)], outbox: [] }, { questions: true }, NOW);
    expect(kept.groups[0]).toMatchObject({ label: 'Questions', problem: 'Questions couldn\'t be read — retrying.' });
    expect(item(kept.groups, 0).lines).toHaveLength(1);
  });

  it('says how many PRDs could not be read beside the outbox items it did read', () => {
    const panel = bellPanel({ questions: [], outbox: [o('i1', 459)] }, { outboxPrds: 2 }, NOW);
    expect(panel.groups[0]).toMatchObject({ label: 'Outbox', problem: '2 PRDs couldn\'t be read' });
    expect(item(bellPanel({ questions: [], outbox: [] }, { outboxPrds: 1 }, NOW).groups, 0).problem).toBe('1 PRD couldn\'t be read');
  });
});

const d = (prd: number, ago: number, kinds: DocumentGroup['kinds'] = ['spec', 'before-after']): DocumentGroup => ({
  dossierId: `d-${prd}`, prd: parsePrd(prd), title: `PRD title ${prd}`, kinds, newestId: `v-${prd}`, newestAt: NOW - ago,
});

describe('the panel\'s New documents group (PRD 579)', () => {
  it('comes after Outbox, one line per PRD as the part holds them (newest first), linking to the PRD page', () => {
    const panel = bellPanel({ questions: [q('a', MIN)], outbox: [o('i1', 459)] }, {}, NOW, [d(579, 20_000, ['spec', 'plan', 'before-after']), d(572, 3 * MIN, ['plan'])]);
    expect(panel.groups.map((g) => g.label)).toEqual(['Questions', 'Outbox', 'New documents']);
    expect(panel.groups[2]).toEqual({
      label: 'New documents',
      problem: null,
      lines: [
        { id: 'docs-d-579', href: '/prd/d-579', head: 'PRD 579 · PRD title 579', text: 'New spec, plan, before/after', meta: 'just now' },
        { id: 'docs-d-572', href: '/prd/d-572', head: 'PRD 572 · PRD title 572', text: 'New plan', meta: '3 min' },
      ],
    });
  });

  it('shows only with lines or a problem', () => {
    expect(bellPanel(EMPTY_WAITING, {}, NOW, [])).toEqual({ groups: [], empty: true });
    expect(bellPanel(EMPTY_WAITING, {}, NOW)).toEqual({ groups: [], empty: true });
    const unread = bellPanel(EMPTY_WAITING, { documents: true }, NOW, []);
    expect(unread).toEqual({ groups: [{ label: 'New documents', problem: 'New documents couldn\'t be read — retrying.', lines: [] }], empty: false });
  });

  it('alone, the panel is not empty', () => {
    expect(bellPanel(EMPTY_WAITING, {}, NOW, [d(579, MIN)]).empty).toBe(false);
  });
});

describe('the panel\'s open and close', () => {
  it('opens on the bell, and closes on the bell again, Escape, a click outside or choosing an item', () => {
    const open = bell(CLOSED_BELL, 'toggle');
    expect(open).toEqual({ open: true, focus: 'none' });
    expect(bell(open, 'toggle')).toEqual({ open: false, focus: 'none' });
    expect(bell(open, 'escape')).toEqual({ open: false, focus: 'bell' });
    expect(bell(open, 'outside')).toEqual({ open: false, focus: 'none' });
    expect(bell(open, 'choose')).toEqual({ open: false, focus: 'none' });
  });

  it('stays closed on anything but the bell while closed', () => {
    for (const event of ['escape', 'outside', 'choose'] as const) expect(bell(CLOSED_BELL, event)).toBe(CLOSED_BELL);
  });
});
