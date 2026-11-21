import { createElement } from 'react';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommanderBody, RAIL_AT_REST, type CommanderBodyProps } from './CommanderTab';
import type { Card, CommanderView } from './commander.contract';
import { NORTHWIND } from './commander.fake';
import { cardKey, cardsAfter, problemsAfter } from './WaitingRail';

// The Waiting on you rail as drawn (PRD 3107 s2, the `fleet-commander` screen): beside the thread of 2.A with a card
// waiting, an approval and a card answered by another member; with the Commander out of tokens (2.C) and off (2.D), the
// rail still answers; at zero (2.E, 2.F), Nothing waits on you.; confirming an answer (2.G); and a route that refused.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const NOW = new Date('2026-11-21T09:30:00Z');

const WAITING: Card = {
  source: 'job', id: '4f2a1b2c-0000-4000-8000-000000000001', ref: 'job 4f2a1b2c', prd: parsePrd(2817), question: 'Old quotes API or v2?',
  choices: ['Keep old API', 'Use v2'], href: '/app/runners#job-4f2a1b2c-0000-4000-8000-000000000001', at: '2026-11-21T08:40:00Z', answered: null,
};
const APPROVAL: Card = {
  source: 'approval', id: 'eeeeeeee-0000-4000-8000-000000002820', ref: null, prd: parsePrd(2820), question: 'Quotes export v2', choices: [],
  href: '/prd/at/northwind/quotes/2820?to=page', at: '2026-11-21T08:30:00Z', answered: null,
};
const OUTBOX: Card = {
  source: 'outbox', id: 'northwind/quotes#2817/s2-01-keep', ref: null, prd: parsePrd(2817), question: 'Keep the CSV export?', choices: [],
  href: '/prd/at/northwind/quotes/2817?to=page', at: '2026-11-21T08:45:00Z', answered: null,
};
const DONE: Card = {
  source: 'job', id: '3e90aaaa-0000-4000-8000-000000000002', ref: 'job 3e90aaaa', prd: parsePrd(2809), question: 'Keep the retry?', choices: ['Keep', 'Drop'],
  href: '/app/runners#job-3e90aaaa-0000-4000-8000-000000000002', at: '2026-11-21T08:00:00Z', answered: { login: 'paul-n', at: '2026-11-21T08:58:00Z', choice: 'Keep' },
};

const view = (over: Partial<CommanderView> = {}): CommanderView => ({
  workspace: NORTHWIND, fleet: 'blue-fleet', state: { kind: 'ready' }, status: { running: 2, waiting: 1, paused: 0, spent: 410, cap: 1000 },
  messages: [], suggestions: ['What waits on me?'], reading: { missions: 2, jobs: 3 }, cards: [WAITING, APPROVAL, OUTBOX, DONE], notebooks: { fleet: [], missions: [], count: 0 }, me: 'mira-k', ...over,
});
const render = (v: CommanderView, rail: Partial<CommanderBodyProps['rail']> = {}) => renderToStaticMarkup(createElement(CommanderBody, {
  view: v, now: NOW, pending: null, draft: '', problem: null, onDraft: () => undefined, onAsk: () => undefined,
  rail: { ...RAIL_AT_REST, onPick: () => undefined, onConfirm: () => undefined, onCancel: () => undefined, ...rail },
}));
/** The rail's own markup. */
const railOf = (html: string) => html.slice(html.indexOf('<aside class="commander-rail"'));

describe('the Waiting on you rail', () => {
  it('2.A: one card per question, built from its record: the count, where it comes from, its choices, who answers', () => {
    const rail = railOf(render(view()));
    const t = text(rail);
    expect(rail).toContain('aria-label="Waiting on you"');
    expect(t).toContain('Waiting on you · 3');
    expect(t).toContain('Question · job 4f2a1b2c · PRD 2817 Old quotes API or v2? Keep old API Use v2 Answers as mira-k');
    expect(t).toContain('Approval · PRD 2820 Approve on its page. Open PRD 2820');
    expect(rail).toContain('<a href="/prd/at/northwind/quotes/2820?to=page">Open PRD 2820</a>');
    expect(t).toContain('Outbox · PRD 2817 Keep the CSV export? Answer on its page');
    expect(rail).not.toMatch(/Confirm|data-primary/);
  });

  it('AC-12, 2.A: a card answered by another member reads Answered by them, the time and the choice, with no choice left', () => {
    const rail = railOf(render(view({ cards: [DONE] })));
    expect(text(rail)).toContain('Waiting on you · 0 Question · job 3e90aaaa · PRD 2809 Keep the retry? Answered by paul-n · 08:58 · Keep');
    expect(rail).toContain('<b>Keep</b>');
    expect(rail).toContain('commander-card-done');
    expect(rail).not.toContain('<button');
  });

  it('AC-16, 2.D: off with no model key, the rail is there and answers', () => {
    const html = render(view({ state: { kind: 'off' }, cards: [WAITING] }));
    expect(text(html)).toContain('The Commander is off: no model key.');
    expect(text(railOf(html))).toContain('Old quotes API or v2? Keep old API Use v2 Answers as mira-k');
    expect(railOf(html)).toMatch(/<button[^>]*>Use v2<\/button>/);
  });

  it('2.C: out of tokens, the rail still answers', () => {
    const html = render(view({ state: { kind: 'used-up', backAt: '2026-11-22T00:00:00.000Z' }, cards: [WAITING] }));
    expect(text(html)).toContain('Tokens used up. Back at 00:00 UTC.');
    expect(railOf(html)).toMatch(/<button[^>]*>Keep old API<\/button>/);
  });

  it('2.E, 2.F: at zero, Nothing waits on you.', () => {
    expect(text(railOf(render(view({ cards: [] }))))).toBe('Waiting on you · 0 Nothing waits on you.');
  });

  it('2.G: confirming an answer: the choice picked, Answer as <login>?, Confirm and Cancel', () => {
    const rail = railOf(render(view({ cards: [WAITING] }), { confirming: { key: cardKey(WAITING), choice: 'Use v2' } }));
    const t = text(rail);
    expect(t).toContain('Old quotes API or v2? Use v2 Answer as mira-k? Confirm Cancel');
    expect(t).not.toContain('Keep old API');
    expect(rail).toMatch(/<button[^>]*disabled=""[^>]*>Use v2<\/button>/);
  });

  it('a route that refused: the card stays open and says Not sent: try again.', () => {
    const rail = railOf(render(view({ cards: [WAITING] }), { problems: new Map([[cardKey(WAITING), 'Not sent: try again.']]) }));
    expect(text(rail)).toContain('Use v2 Answers as mira-k Not sent: try again.');
    expect(rail).toContain('role="alert"');
  });
});

describe('the rail once an answer came back', () => {
  const key = cardKey(WAITING);
  const answered = { ...WAITING, answered: { login: 'mira-k', at: '2026-11-21T09:30:00Z', choice: 'Use v2' } };
  const elsewhere = { ...WAITING, answered: { login: 'paul-n', at: '2026-11-21T09:29:00Z', choice: 'Keep old API' } };

  it('AC-4: the card answered by the member replaces the one that waited, and its refusal goes', () => {
    expect(cardsAfter([WAITING, DONE], key, { ok: true, card: answered })).toEqual([answered, DONE]);
    expect(problemsAfter(new Map([[key, 'Not sent: try again.']]), key, { ok: true, card: answered }).size).toBe(0);
  });

  it('AC-12: a card answered elsewhere reads the other member, with no refusal on it', () => {
    const sent = { ok: false as const, message: 'This question was answered already.', card: elsewhere };
    expect(cardsAfter([WAITING], key, sent)).toEqual([elsewhere]);
    expect(problemsAfter(new Map(), key, sent).size).toBe(0);
  });

  it('a route that refused keeps the card open and says Not sent: try again.', () => {
    const sent = { ok: false as const, message: 'Not sent: try again.', card: null };
    expect(cardsAfter([WAITING], key, sent)).toEqual([WAITING]);
    expect([...problemsAfter(new Map(), key, sent)]).toEqual([[key, 'Not sent: try again.']]);
  });
});
