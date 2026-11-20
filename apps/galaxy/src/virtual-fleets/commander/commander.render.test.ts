import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CommanderBody, CommanderTab, RAIL_AT_REST } from './CommanderTab';
import type { CommanderView, Message } from './commander.contract';
import { NORTHWIND } from './commander.fake';

// The Commander tab as drawn (PRD 3107 s1, the `fleet-commander` screen): 2.A's thread (a member's question by their
// login, the Commander's reply signed `Commander · agent` with its glyph and no face, a bold verdict, a chip per source
// whose hover shows the record's own line, and the footer), 2.C tokens used up, 2.D off, 2.E a first visit and 2.F
// reading the record, one test per state.

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const NOW = new Date('2026-11-21T09:30:00Z');
const Q1: Message = { kind: 'question', id: 'cccccccc-0000-4000-8000-000000000001', at: '2026-11-21T09:02:00Z', login: 'mira-k', text: 'What is waiting on me?' };
const R1: Message = {
  kind: 'reply', id: 'cccccccc-0000-4000-8000-000000000002', at: '2026-11-21T09:02:30Z', replyTo: Q1.id,
  reply: {
    verdict: '2 things wait on a person.', read: 100, removed: 0,
    claims: [
      { text: 'PRD 2817 waits on its Engineer.', sources: [{ label: 'job 4f2a1b2c', href: '/app/runners#job-4f2a1b2c', line: '2026-11-21 06:00 · /omni:yolo 2817 · done · ready' }] },
      { text: 'PRD 2820 waits on approval.', sources: [{ label: 'PRD 2820', href: '/prd/at/northwind/quotes/2820?to=page', line: 'PRD 2820 of northwind/quotes' }] },
    ],
  },
};
const Q2: Message = { kind: 'question', id: 'cccccccc-0000-4000-8000-000000000003', at: '2026-11-21T09:11:00Z', login: 'paul-n', text: 'Why did PRD 2809 stop?' };
const R2: Message = {
  kind: 'reply', id: 'cccccccc-0000-4000-8000-000000000004', at: '2026-11-21T09:11:20Z', replyTo: Q2.id,
  reply: { verdict: 'QA found two bugs.', read: 12, removed: 1, claims: [{ text: 'QA sent PRD 2809 back.', sources: [{ label: 'event 08:41', href: '/app/fleet?fleet=blue-fleet&tab=room', line: '2026-11-21 08:41 · qa · held · PRD 2809 · QA sent PRD 2809 back.' }] }] },
};
const view = (over: Partial<CommanderView> = {}): CommanderView => ({
  workspace: NORTHWIND, fleet: 'blue-fleet', state: { kind: 'ready' },
  status: { running: 2, waiting: 1, paused: 0, spent: 410, cap: 1000 },
  messages: [Q1, R1, Q2, R2], suggestions: ['What waits on me?', 'What happened overnight?', 'Why did PRD 2817 stop?'], reading: { missions: 2, jobs: 3 }, cards: [], notebooks: { fleet: [], missions: [], count: 0 }, me: 'mira-k', ...over,
});
const render = (v: CommanderView, pending: string | null = null) =>
  renderToStaticMarkup(createElement(CommanderBody, { view: v, now: NOW, pending, draft: '', problem: null, onDraft: () => undefined, onAsk: () => undefined, rail: { ...RAIL_AT_REST, onPick: () => undefined, onConfirm: () => undefined, onCancel: () => undefined } }));

describe('the Commander tab', () => {
  it('2.A: the status line, then the thread: each question by its login, each reply signed Commander · agent with its sources', () => {
    const html = render(view());
    const t = text(html);
    expect(t).toContain('2 running · 1 waiting · 0 paused · tokens 41% today');
    expect(html).toContain('href="/app/fleet?fleet=blue-fleet&amp;tab=missions"');
    expect(t).toContain('Today mira-k · 09:02 What is waiting on me? Commander agent · 09:02 2 things wait on a person.');
    expect(t).toContain('PRD 2817 waits on its Engineer. job 4f2a1b2c PRD 2820 waits on approval. PRD 2820 Read 100 events · 09:02');
    expect(t).toContain('paul-n · 09:11 Why did PRD 2809 stop? Commander agent · 09:11 QA found two bugs. QA sent PRD 2809 back. event 08:41 Read 12 events · 09:11 1 sentence removed: no link.');
    expect(html).toContain('<a class="commander-chip" href="/app/runners#job-4f2a1b2c" title="2026-11-21 06:00 · /omni:yolo 2817 · done · ready">job 4f2a1b2c</a>');
    expect(html).toMatch(/<svg class="commander-glyph"[^>]*aria-hidden="true"/);
    expect(html).not.toMatch(/<img|avatar/i);
    expect(t).toContain('Ask');
    expect(html).toContain('placeholder="Ask the Commander"');
  });

  it('2.A: says it found nothing rather than that all is well, and that a question got no answer', () => {
    const empty: Message = { ...R1, reply: { verdict: null, claims: [], read: 40, removed: 2 } };
    const t = text(render(view({ messages: [Q1, empty, Q2] })));
    expect(t).toContain('Commander agent · 09:02 I could not find that in the fleet’s record. Read 40 events · 09:02 2 sentences removed: no link.');
    expect(t).toContain('Why did PRD 2809 stop? No answer: try again.');
  });

  it('2.C: tokens used up: the notice in place of the box, the thread kept', () => {
    const html = render(view({ state: { kind: 'used-up', backAt: '2026-11-22T00:00:00.000Z' }, status: { running: 2, waiting: 0, paused: 0, spent: 1000, cap: 1000 } }));
    expect(text(html)).toContain('tokens 100% today');
    expect(text(html)).toContain('Tokens used up. Back at 00:00 UTC.');
    expect(text(html)).toContain('2 things wait on a person.');
    expect(html).not.toContain('<textarea');
  });

  it('AC-11, 2.D: off with no model key: says so and links Settings, with no box', () => {
    const html = render(view({ state: { kind: 'off' } }));
    expect(text(html)).toContain('The Commander is off: no model key.');
    expect(html).toMatch(/<a[^>]*href="\/app\/settings"[^>]*>Settings<\/a>/);
    expect(html).not.toContain('<textarea');
    expect(html).not.toContain('commander-thread');
  });

  it('2.E: a first visit: Ask about this fleet. and three questions to ask', () => {
    const html = render(view({ messages: [], status: { running: 1, waiting: 0, paused: 0, spent: 120, cap: 1000 } }));
    const t = text(html);
    expect(t).toContain('1 running · 0 waiting · 0 paused · tokens 12% today');
    expect(t).toContain('Ask about this fleet. What waits on me? What happened overnight? Why did PRD 2817 stop?');
    expect(html).toContain('<textarea');
  });

  it('2.F: reading the record: the question, a pending row naming what it reads, the box disabled', () => {
    const html = render(view({ messages: [] }), 'What happened overnight?');
    const t = text(html);
    expect(t).toContain('Today What happened overnight? Commander agent Reading the record · 2 missions · 3 jobs');
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/<textarea[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
    expect(t).not.toContain('Ask about this fleet.');
  });

  it('2.A: Message fleet: its message is tagged To the fleet and waits for the next job, then reads which job read it', () => {
    const waiting: Message = { kind: 'fleet', id: 'dddddddd-0000-4000-8000-000000000001', at: '2026-11-21T09:20:00Z', login: 'mira-k', text: 'the design review moved to Thursday', reads: [] };
    const read: Message = { ...waiting, id: 'dddddddd-0000-4000-8000-000000000002', at: '2026-11-21T09:21:00Z', reads: [{ role: 'engineer', job: '4f2a1b2c-0000-4000-8000-000000000001', at: '2026-11-21T09:25:00Z' }] };
    const html = render(view({ messages: [waiting, read] }));
    const t = text(html);
    expect(t).toContain('mira-k · 09:20 To the fleet the design review moved to Thursday Waiting for next job');
    expect(t).toContain('mira-k · 09:21 To the fleet the design review moved to Thursday Read by engineer · job 4f2a1b2c');
    expect(html).toContain('<a href="/app/runners#job-4f2a1b2c-0000-4000-8000-000000000001">Read by engineer · job 4f2a1b2c</a>');
  });

  it('the box offers Ask and Message fleet; in Message fleet it has its placeholder, its button and, with no mission running, the warning (AC-14)', () => {
    const body = (v: CommanderView, mode: 'ask' | 'message') => renderToStaticMarkup(createElement(CommanderBody, {
      view: v, now: NOW, pending: null, draft: '', problem: null, onDraft: () => undefined, onAsk: () => undefined, mode,
      rail: { ...RAIL_AT_REST, onPick: () => undefined, onConfirm: () => undefined, onCancel: () => undefined },
    }));
    const asking = body(view(), 'ask');
    expect(text(asking)).toContain('Ask Message fleet');
    expect(asking).toContain('placeholder="Ask the Commander"');
    expect(text(asking)).not.toContain('No mission running');
    const messaging = body(view(), 'message');
    expect(messaging).toContain('placeholder="Agents read this at their next job"');
    expect(text(messaging)).toContain('Send to fleet');
    expect(text(messaging)).not.toContain('No mission running');
    const idle = body(view({ status: { running: 0, waiting: 1, paused: 0, spent: 0, cap: 1000 } }), 'message');
    expect(text(idle)).toContain('No mission running: no agent will read this.');
  });

  it('says the fleet has no daily cap rather than a share of none', () => {
    expect(text(render(view({ status: { running: 0, waiting: 0, paused: 0, spent: 5, cap: null } })))).toContain('0 paused · no daily token cap');
  });

  it('draws what it was given, and waits for its read otherwise', () => {
    expect(text(renderToStaticMarkup(createElement(CommanderTab, { workspace: NORTHWIND, fleet: 'blue-fleet', view: view(), now: NOW })))).toContain('2 things wait on a person.');
    expect(renderToStaticMarkup(createElement(CommanderTab, { workspace: NORTHWIND, fleet: 'blue-fleet' }))).toContain('Loading the Commander');
  });
});
