import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../data/supabase-server', () => ({ supabaseEnv: () => ({ url: 'https://db.example', key: 'anon' }) }));

import type { PrdNumber } from 'omni-loop/kit/lib/ids.ts';
import { DEMO_TEAMMATE, demoQuestion } from '../ask/page/demo';
import type { WaitingApproval, WaitingQuestion } from '../waiting/waiting';
import { inboxOf, type InboxFilter } from './inbox';
import { inputOf, nextOpen, problemsOf, type InboxParts } from './InboxScreen.model';
import { InboxOpenView } from './InboxScreen.open';
import { QuestionPanel } from './InboxScreen.panel';

// The Open tab (PRD omni-loop-23, s5): the kind pills, the rows on the shared anatomy, the panel, and the one
// selected style. Rendered to static markup; no test reads GitHub or the database.

const NOW = Date.parse('2026-11-22T10:00:00Z');
const MIN = 60_000;
const ROUND = demoQuestion(NOW);
const ROUND_ID = ROUND.round.id;
const NONE = { questions: false, outbox: false, documents: false, business: false, approvals: false, reviews: false, runners: false };
const question: WaitingQuestion = { kind: 'question', id: ROUND_ID, sessionTitle: 'acme/web-app', question: 'Ship CSV only?', askedAt: NOW - 4 * MIN, sharedBy: null };
const approval: WaitingApproval = { kind: 'approval', id: 'ap1', prd: 41 as PrdNumber, dossierId: 'dossier-41', title: 'Reusable widget themes', repo: 'acme/widgets', askedAt: NOW - 120 * MIN };
const parts: InboxParts = { list: { questions: [question], outbox: [] }, approvals: [approval], reviews: [], documents: [], business: 0, runners: 0, unread: NONE, unreadPrds: 0 };

function openTab(filter: InboxFilter = { kind: 'all', shared: false }) {
  const inbox = inboxOf(inputOf(parts, NOW), filter);
  const open = nextOpen([], inbox, null, new Set());
  const counts = { questions: 1, approvals: 1, outbox: 0, reviews: 0, shared: 0, total: inbox.count };
  return renderToStaticMarkup(createElement(InboxOpenView, {
    inbox, problems: problemsOf(parts.unread, parts.unreadPrds), counts, filter, now: NOW, open, sent: new Set<string>(), wide: true, notice: null,
    panelOf: (row) => (row.kind === 'question'
      ? createElement(QuestionPanel, { roundId: row.item.id, context: row.item.sessionTitle, source: { kind: 'demo' }, me: DEMO_TEAMMATE, onSent: () => {}, initial: ROUND, now: NOW, place: { n: 1, of: 1 } })
      : null),
  }));
}

const css = readFileSync(new URL('./inbox-open.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const inboxCss = readFileSync(new URL('./inbox.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rule = (sheet: string, selector: string) => new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(sheet)?.[1] ?? '';

describe('the Open tab, restyled', () => {
  it('AC-2: the kind filter is pills on the toolbar line, the chosen one marked and counted, and the keys sit on its right', () => {
    const html = openTab({ kind: 'question', shared: false });
    const bar = html.slice(html.indexOf('class="inbox-toolbar"'), html.indexOf('class="inbox-split"'));
    expect(bar).toContain('omni-segmented--pills');
    expect(bar).toMatch(/omni-segment omni-segment--chosen"[^>]*aria-current="page"[^>]*>Questions<span class="omni-segment__count">1<\/span>/);
    expect(bar.indexOf('omni-segmented')).toBeLessThan(bar.indexOf('inbox-toolbar-end'));
    expect(bar).toContain('move');
  });

  it('AC-2: the open row carries aria-current on the shared row, whose current style is the signal tint with no border, bar or rule', () => {
    const html = openTab();
    expect(html).toContain(`class="inbox-r" href="/ask/q/${ROUND_ID}" data-key="question:${ROUND_ID}" aria-current="true"`);
    const current = rule(inboxCss, ".inbox-r[aria-current='true']");
    expect(current).toContain('var(--color-signal-soft)');
    expect(current).not.toMatch(/border-(left|inline|top)|box-shadow|outline/);
  });

  it('AC-2: the picked answer option takes the same tint, a signal key and a check, with no border', () => {
    const picked = rule(css, '.inbox-panel .ask-opt:has(input:checked)');
    expect(picked).toContain('var(--color-signal-soft)');
    expect(picked).toContain('border-color: transparent');
    expect(picked).not.toMatch(/box-shadow|border-left|border-inline/);
    expect(css).toContain("content: '✓'");
    expect(rule(css, '.inbox-panel .ask-opt:has(input:checked) .ask-key')).toContain('var(--color-signal)');
  });

  it('draws a kind icon, the title and one quiet line with the kind word, on the shared anatomy', () => {
    const html = openTab();
    expect(html).toContain('<span class="inbox-r-title">Ship CSV only?</span>');
    expect(html).toContain('<span class="inbox-r-flag">Blocking</span>');
    expect(html).toContain('<span class="inbox-r-kind">Approval</span>');
    expect(html).toContain('class="inbox-r-anchor"');
    expect(html).not.toContain('omni-badge');
  });

  it('puts the panel’s top line first: Blocking, its place among the questions, and its page with the o key', () => {
    const html = openTab();
    const panel = html.slice(html.indexOf('class="inbox-panel"'));
    expect(panel.indexOf('inbox-panel-top')).toBeLessThan(panel.indexOf('ask-round'));
    expect(panel).toContain('Blocking</span><span>Question 1 of 1</span>');
    expect(panel).toContain(`href="/ask/q/${ROUND_ID}"`);
    expect(panel).toContain('Open its page');
    expect(panel).toMatch(/Send to the agent/);
    expect(panel.match(/ask-button/g)).toHaveLength(1);
  });

  it('writes every value as a token', () => {
    expect(css.replace(/@media[^{]*/g, '')).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|\b(?!1px\b|2px\b)\d+px/);
  });
});
