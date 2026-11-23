import { readFileSync } from 'node:fs';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({ supabaseEnv: () => ({ url: 'https://db.example', key: 'anon' }) }));

import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { DEMO_TEAMMATE, demoQuestion } from '../ask/page/demo';
import type { DocumentGroup } from '../waiting/documents';
import type { WaitingApproval, WaitingQuestion } from '../waiting/waiting';
import { inboxOf, type InboxFilter, type InboxRow } from './inbox';
import { InboxScreen } from './InboxScreen';
import { InboxDone } from './InboxScreen.done';
import { InboxHeadView } from './InboxScreen.header';
import { inputOf, nextOpen, problemsOf, type InboxParts } from './InboxScreen.model';
import { InboxOpenView } from './InboxScreen.open';
import { ItemPanel, QuestionPanel } from './InboxScreen.panel';

// The Inbox (PRD omni-loop-22, s5) as the server renders it, to static markup: what a person sees before
// any script runs. The waiting list is a fixture: no test reads GitHub or the database.

const NOW = Date.parse('2026-11-22T10:00:00Z');
const MIN = 60_000;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// The panel's round is the demo's open round, asked a minute before NOW, its first question about access.
const ROUND = demoQuestion(NOW);
const ROUND_ID = ROUND.round.id;
const FIRST_OPTION = 'Google sign-in through the galaxy';

const question = (id: string, minutesAgo: number): WaitingQuestion => ({ kind: 'question', id, sessionTitle: `Session ${id}`, question: `Question ${id}?`, askedAt: NOW - minutesAgo * MIN, sharedBy: null });
const approval: WaitingApproval = { kind: 'approval', id: 'ap1', prd: 41 as PrdNumber, dossierId: 'dossier-41', title: 'Reusable widget themes', repo: 'acme/widgets', askedAt: NOW - 120 * MIN };
const plan: DocumentGroup = { dossierId: 'dossier-44', prd: 44 as PrdNumber, title: 'Faster gears', kinds: ['plan'], newestId: 'v1', newestAt: NOW - 5 * MIN };

const NONE = { questions: false, outbox: false, documents: false, business: false, approvals: false, reviews: false, runners: false };
const parts = (part: Partial<InboxParts>): InboxParts => ({ list: { questions: [], outbox: [] }, approvals: [], reviews: [], documents: [], business: 0, runners: 0, unread: NONE, unreadPrds: 0, ...part });
const ALL: InboxFilter = { kind: 'all', shared: false };

/** The panel each row opens: a question in today's form, any other item with its link. */
const panelOf = (row: InboxRow): ReactNode => (row.kind === 'question'
  ? createElement(QuestionPanel, { roundId: row.item.id, context: row.item.sessionTitle, source: { kind: 'demo' }, me: DEMO_TEAMMATE, onSent: () => {}, initial: { ...ROUND, round: { ...ROUND.round, id: row.item.id } }, now: NOW })
  : createElement(ItemPanel, { row, now: NOW }));

/** The Open tab drawn from the given parts, its open row the one a landing opens. */
function openTab(part: Partial<InboxParts>, wide = true) {
  const p = parts(part);
  const inbox = inboxOf(inputOf(p, NOW), ALL);
  const open = nextOpen([], inbox, null, new Set());
  const counts = { questions: p.list.questions.length, approvals: p.approvals.length, outbox: p.list.outbox.length, reviews: p.reviews.length, shared: 0, total: inbox.count };
  const html = renderToStaticMarkup(createElement(InboxOpenView, { inbox, problems: problemsOf(p.unread, p.unreadPrds), counts, filter: ALL, now: NOW, open, sent: new Set<string>(), wide, notice: null, panelOf }));
  const head = renderToStaticMarkup(createElement(InboxHeadView, { tab: 'open', count: inbox.count, words: inbox.count === 0 ? 'Nothing waits on you' : `${inbox.count} ${inbox.count === 1 ? 'waits' : 'wait'} on you` }));
  return { html, head, t: text(html) };
}

const sectionOrder = (html: string) => [...html.matchAll(/data-section="([a-z]+)"/g)].map((m) => m[1]);
const sidePanel = (html: string) => html.slice(html.indexOf('class="inbox-side"'));

describe('the Open tab, landing', () => {
  it('AC-2: Questions is the first section, and the question asked 11 minutes ago is open in the panel with its options', () => {
    const { html } = openTab({ list: { questions: [question(ROUND_ID, 11), question('later', 3)], outbox: [] } });
    expect(sectionOrder(html)[0]).toBe('questions');
    const side = sidePanel(html);
    expect(side).toContain(`data-open="question:${ROUND_ID}"`);
    expect(side).toContain(FIRST_OPTION);
    expect(side).toMatch(/<input type="radio"/);
    expect(html).toMatch(new RegExp(`<a class="inbox-row" href="/ask/q/${ROUND_ID}" data-key="question:${ROUND_ID}" aria-current="true"`));
  });

  it('AC-3: with no question, the approval is open in the panel with a link to its PRD’s review', () => {
    const { html } = openTab({ approvals: [approval] });
    const side = sidePanel(html);
    expect(side).toContain('data-open="approval:ap1"');
    expect(side).toMatch(/<a class="omni-button omni-button--primary omni-button--md" href="\/prd\/dossier-41" data-primary="">Open its review<\/a>/);
  });

  it('AC-5: runner jobs and updates are listed below the counted sections, and the count is 1', () => {
    const { html, head, t } = openTab({ list: { questions: [question(ROUND_ID, 2)], outbox: [] }, runners: 1, documents: [plan] });
    expect(sectionOrder(html)).toEqual(['questions', 'anyone', 'updates']);
    expect(t).toContain('Anyone can answer 1 · not counted');
    expect(t).toContain('Updates 1 · not counted');
    expect(t).toContain('1 runner job waits for an answer');
    expect(text(head)).toContain('1 waits on you');
    expect(head).toMatch(/Open<span class="omni-tab__count omni-tab__count--attention omni-tab__count--filled" aria-hidden="true">1<\/span>/);
  });

  it('marks each question Blocking and gives each row its own page', () => {
    const { html } = openTab({ list: { questions: [question(ROUND_ID, 2)], outbox: [] }, approvals: [approval] });
    expect(html).toMatch(/<span class="omni-badge omni-badge--info">Blocking<\/span>/);
    expect(html).toContain('href="/prd/dossier-41" data-key="approval:ap1"');
  });

  it('draws the list keys’ hint under the list', () => {
    expect(openTab({ approvals: [approval] }).t).toContain('j k move · ↵ open · o its page · e clears an update');
  });
});

describe('the Open tab, below 1280 px', () => {
  it('AC-10: a question opens in place in the list, under its row, not beside it', () => {
    const { html } = openTab({ list: { questions: [question(ROUND_ID, 2)], outbox: [] } }, false);
    expect(html).not.toContain('class="inbox-side"');
    const item = html.slice(html.indexOf(`data-key="question:${ROUND_ID}"`));
    expect(item.indexOf('class="inbox-inplace"')).toBeGreaterThan(0);
    expect(item.slice(item.indexOf('class="inbox-inplace"'))).toContain(FIRST_OPTION);
    expect(html).toMatch(/<div class="inbox-stack">/);
  });

  it('AC-10: each option and the Send button is at least 44 px tall there', () => {
    const css = readFileSync(new URL('./inbox.css', import.meta.url), 'utf8');
    expect(css).toMatch(/\.inbox-inplace \.ask-opt,\s*\.inbox-inplace \.ask-button \{ min-height: calc\(var\(--space-7\) - var\(--space-1\)\); \}/);
    const Step = z.object({ $value: z.object({ value: z.number() }) });
    const Scale = z.object({ space: z.object({ 1: Step, 7: Step }) });
    const { space } = Scale.parse(JSON.parse(readFileSync(new URL('../../../../packages/design/tokens/scale.tokens.json', import.meta.url), 'utf8')));
    expect(space[7].$value.value - space[1].$value.value).toBe(44);
  });
});

describe('the Open tab, with nothing counted', () => {
  it('AC-13: says Nothing waits on you., the header too, and the Open tab carries no count', () => {
    const { t, head } = openTab({});
    expect(t).toContain('Nothing waits on you.');
    expect(t).toContain('New questions land here the moment an agent asks.');
    expect(text(head)).toContain('Nothing waits on you');
    expect(head).not.toContain('omni-tab__count');
  });

  it('AC-13: still lists what anyone can answer, below, as not counted', () => {
    const { html, t } = openTab({ runners: 1 });
    expect(t).toContain('Nothing waits on you.');
    expect(sectionOrder(html)).toEqual(['anyone']);
    expect(html).toContain('href="/app/inbox/workspace"');
  });
});

describe('a part that could not be read', () => {
  it('says so in its section, and never says nothing waits', () => {
    const { html, t } = openTab({ unread: { ...NONE, questions: true } });
    expect(sectionOrder(html)).toEqual(['questions']);
    expect(html).toContain('<p class="inbox-problem" role="status">Questions couldn’t be read — retrying.</p>');
    expect(t).not.toContain('Nothing waits on you.');
  });
});

describe('the frame', () => {
  it('signed out, shows only the sign-in card, coming back to the Inbox', () => {
    const html = renderToStaticMarkup(createElement(InboxScreen, { view: { kind: 'sign-in' }, tab: 'open', signinError: null }));
    expect(text(html)).toContain('Sign in to see your Inbox');
    expect(html).not.toContain('data-screen="inbox"');
  });

  it('with no database, says the Inbox is not open here', () => {
    const html = renderToStaticMarkup(createElement(InboxScreen, { view: { kind: 'closed' }, tab: 'open', signinError: null }));
    expect(text(html)).toContain('The Inbox is not open here');
  });

  it('signed in, heads every tab with Inbox and the three tabs, the current one marked', () => {
    const html = renderToStaticMarkup(createElement(InboxScreen, { view: { kind: 'answering', source: { kind: 'demo' }, me: null }, tab: 'done', signinError: null }));
    expect(html).toContain('<h1 class="inbox-vh">Inbox</h1>');
    expect(html).toMatch(/href="\/app\/inbox">Open<\/a>/);
    expect(html).toMatch(/<a class="omni-tab omni-tab--current"(?=[^>]*aria-current="page")[^>]*href="\/app\/inbox\/done"[^>]*>Done<\/a>/);
    expect(html).toContain('href="/app/inbox/workspace">Workspace</a>');
    expect(html).toContain('data-screen="inbox" data-tab="done"');
  });
});

describe('the Done tab', () => {
  const done = (view: Parameters<typeof InboxDone>[0]['view']) => text(renderToStaticMarkup(createElement(InboxDone, { view, signinError: null })));

  it('is today’s Questions history', () => {
    const filters = {};
    expect(done({ kind: 'history', items: [], choices: { repos: [], prds: [], skills: [], askedBy: [], answeredBy: [] }, filters, categories: [], all: 0, now: 0 })).not.toBe('');
  });

  it('says why it could not be read', () => {
    expect(done({ kind: 'signed-out', supabase: { url: 'https://db.example', key: 'anon' } })).toContain('Sign in');
    expect(done({ kind: 'unavailable' })).not.toBe('');
    expect(done({ kind: 'unreachable' })).not.toBe('');
  });
});

describe('the Alerts popover', () => {
  it('sits in the header while the switches are kept, and is gone without them', () => {
    const alerts = { desktop: 'off' as const, chime: false, onDesktop: () => {}, onChime: () => {} };
    const html = renderToStaticMarkup(createElement(InboxHeadView, { tab: 'open', count: 0, words: 'Nothing waits on you', alerts }));
    expect(html).toMatch(/<span class="omni-tabs__end"><span class="inbox-alerts-button"><button[^>]*aria-label="Alerts"/);
    expect(renderToStaticMarkup(createElement(InboxHeadView, { tab: 'open', count: 0, words: 'x' }))).not.toContain('Alerts');
  });
});

describe('the header (PRD omni-loop-23)', () => {
  const alerts = { desktop: 'off' as const, chime: false, onDesktop: () => {}, onChime: () => {} };
  const head = (count: number, tab: 'open' | 'done' | 'workspace' = 'open') => renderToStaticMarkup(createElement(InboxHeadView, { tab, count, words: `${count} wait on you`, alerts }));
  const css = readFileSync(new URL('./inbox.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('AC-1: draws no visible title, names the Open count "12 wait on you" and ends the tabs line with Alerts as an icon button', () => {
    const html = head(12);
    expect(html).not.toContain('inbox-title');
    expect(html).toContain('<h1 class="inbox-vh">Inbox</h1>');
    expect(html).toMatch(/aria-hidden="true">12<\/span><span class="omni-tab__count-label"> 12 wait on you<\/span>/);
    const nav = html.slice(html.indexOf('<nav'), html.indexOf('</nav>'));
    expect(nav.lastIndexOf('Workspace')).toBeLessThan(nav.indexOf('omni-tabs__end'));
    expect(nav.slice(nav.indexOf('omni-tabs__end'))).toMatch(/<button[^>]*omni-icon-button[^>]*aria-label="Alerts"|<button[^>]*aria-label="Alerts"[^>]*omni-icon-button/);
    expect(css).not.toMatch(/\.inbox-title|\.inbox-count/);
  });

  it('AC-3: the Open tab’s count is the only filled signal shape, on every tab', () => {
    for (const tab of ['open', 'done', 'workspace'] as const) {
      const html = head(12, tab);
      expect(html.match(/omni-tab__count--filled/g)).toHaveLength(1);
    }
    expect(css).not.toMatch(/background:\s*var\(--color-signal\)/);
  });

  it('shares one toolbar line and one row anatomy, with no raw colour', () => {
    for (const name of ['inbox-toolbar', 'inbox-toolbar-end', 'inbox-r', 'inbox-r-anchor', 'inbox-r-main', 'inbox-r-title', 'inbox-r-line', 'inbox-r-quiet', 'inbox-r-end', 'inbox-group', 'inbox-group-head']) {
      expect(css).toContain(`.${name}`);
    }
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
